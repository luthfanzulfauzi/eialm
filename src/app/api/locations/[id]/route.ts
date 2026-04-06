import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const location = await prisma.location.findUnique({
      where: { id: params.id },
      include: {
        racks: {
          include: {
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
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  // Security check: VIEWERS cannot edit infrastructure
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const updatedLocation = await prisma.location.update({
      where: { id: params.id },
      data: {
        name: body.name,
        address: body.address,
      }
    });

    return NextResponse.json(updatedLocation);
  } catch (error) {
    console.error("Location PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await prisma.location.delete({
      where: { id: params.id }
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: "Cannot delete location with active assets" }, { status: 400 });
  }
}