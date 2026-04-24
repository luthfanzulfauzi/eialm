import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const totalUnits = typeof body.totalUnits === "number" ? body.totalUnits : 42;

    if (!name) {
      return NextResponse.json({ error: "Rack name is required" }, { status: 400 });
    }

    if (typeof body.locationId !== "string" || body.locationId.trim().length === 0) {
      return NextResponse.json({ error: "Datacenter location is required" }, { status: 400 });
    }

    if (!Number.isFinite(totalUnits) || totalUnits < 1) {
      return NextResponse.json({ error: "Rack height must be a positive number" }, { status: 400 });
    }

    const location = await prisma.location.findUnique({
      where: { id: body.locationId },
      select: { id: true, name: true, type: true },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    if (location.type !== "DATACENTER") {
      return NextResponse.json({ error: "Racks can only be created inside datacenters" }, { status: 400 });
    }

    const rack = await prisma.rack.create({
      data: {
        name,
        locationId: body.locationId,
        totalUnits,
      }
    });

    await writeAuditLog({
      action: "RACK_CREATE",
      userId: session.user.id,
      details: {
        rackId: rack.id,
        name: rack.name,
        totalUnits: rack.totalUnits,
        locationId: location.id,
        locationName: location.name,
      },
    });

    return NextResponse.json(rack);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A rack with this name already exists in this datacenter" }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || "Failed to create rack" }, { status: 400 });
  }
}
