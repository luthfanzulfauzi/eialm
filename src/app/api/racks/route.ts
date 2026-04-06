import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const rack = await prisma.rack.create({
      data: {
        name: body.name,
        locationId: body.locationId, // This ID comes from the Datacenter URL
        totalUnits: typeof body.totalUnits === "number" ? body.totalUnits : undefined,
      }
    });
    return NextResponse.json(rack);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create rack" }, { status: 400 });
  }
}
