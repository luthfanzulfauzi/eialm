import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LocationType } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as LocationType | null;
  
  try {
    const locations = await prisma.location.findMany({
      where: type ? { type } : undefined,
      include: {
        _count: {
          select: { assets: true, racks: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error("Location GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const location = await prisma.location.create({
      data: {
        name: body.name,
        type: body.type, // DATACENTER or WAREHOUSE
        address: body.address,
      }
    });

    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create location" }, { status: 400 });
  }
}