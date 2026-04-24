import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const includeAssets = searchParams.get("includeAssets") === "1";
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        assets: includeAssets
          ? {
              include: { rack: true, ips: true },
              orderBy: [{ rackId: "asc" }, { name: "asc" }],
            }
          : false,
        racks: {
          include: {
            assets: {
              select: {
                id: true,
                rackUnitStart: true,
                rackUnitSize: true,
                rackFace: true,
              },
            },
            _count: {
              select: { assets: true }
            }
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch location details" }, { status: 500 });
  }
}

// ADDED: PATCH method for updating Datacenter/Warehouse details
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  
  // Security check: VIEWERS cannot edit infrastructure
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const existingLocation = await prisma.location.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, address: true },
    });

    if (!existingLocation) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        name: body.name,
        address: body.address,
      }
    });

    await writeAuditLog({
      action: "FACILITY_UPDATE",
      userId: session.user.id,
      details: {
        locationId: updatedLocation.id,
        type: updatedLocation.type,
        before: {
          name: existingLocation.name,
          address: existingLocation.address,
        },
        after: {
          name: updatedLocation.name,
          address: updatedLocation.address,
        },
      },
    });

    return NextResponse.json(updatedLocation);
  } catch (error) {
    console.error("Location PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const existingLocation = await prisma.location.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, address: true },
    });

    if (!existingLocation) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    await prisma.location.delete({ where: { id } });

    await writeAuditLog({
      action: "FACILITY_DELETE",
      userId: session.user.id,
      details: {
        locationId: existingLocation.id,
        name: existingLocation.name,
        type: existingLocation.type,
        address: existingLocation.address,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: "Cannot delete location with active assets" }, { status: 400 });
  }
}
