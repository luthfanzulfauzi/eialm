import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const computeUtilization = (params: {
  totalUnits: number;
  assets: Array<{
    id: string;
    rackUnitStart: number | null;
    rackUnitSize: number | null;
    rackFace: "FRONT" | "BACK" | "BOTH" | null;
  }>;
}) => {
  const { totalUnits, assets } = params;
  const frontUsed = new Array<boolean>(Math.max(totalUnits, 0)).fill(false);
  const backUsed = new Array<boolean>(Math.max(totalUnits, 0)).fill(false);
  const issues: Array<{ type: "OVERLAP" | "OUT_OF_BOUNDS"; assetId: string; message: string }> = [];

  for (const a of assets) {
    if (!a.rackUnitStart || !a.rackUnitSize) continue;
    const start = a.rackUnitStart;
    const size = a.rackUnitSize;
    const end = start + size - 1;
    const face = a.rackFace ?? "FRONT";
    const affectsFront = face === "FRONT" || face === "BOTH";
    const affectsBack = face === "BACK" || face === "BOTH";

    if (start < 1 || size < 1 || end > totalUnits) {
      issues.push({
        type: "OUT_OF_BOUNDS",
        assetId: a.id,
        message: `Asset placement ${start}-${end} (${face}) is outside rack range 1-${totalUnits}`,
      });
      continue;
    }

    for (let u = start; u <= end; u++) {
      if (affectsFront) {
        if (frontUsed[u - 1]) {
          issues.push({
            type: "OVERLAP",
            assetId: a.id,
            message: `Asset placement overlaps on FRONT at U${u}`,
          });
          break;
        }
        frontUsed[u - 1] = true;
      }
      if (affectsBack) {
        if (backUsed[u - 1]) {
          issues.push({
            type: "OVERLAP",
            assetId: a.id,
            message: `Asset placement overlaps on BACK at U${u}`,
          });
          break;
        }
        backUsed[u - 1] = true;
      }
    }
  }

  const combinedUsed = frontUsed.map((v, idx) => v || backUsed[idx]);
  const frontUsedUnits = frontUsed.reduce((acc, v) => acc + (v ? 1 : 0), 0);
  const backUsedUnits = backUsed.reduce((acc, v) => acc + (v ? 1 : 0), 0);
  const combinedUsedUnits = combinedUsed.reduce((acc, v) => acc + (v ? 1 : 0), 0);

  const frontFreeUnits = Math.max(totalUnits - frontUsedUnits, 0);
  const backFreeUnits = Math.max(totalUnits - backUsedUnits, 0);
  const combinedFreeUnits = Math.max(totalUnits - combinedUsedUnits, 0);

  const frontPercentUsed = totalUnits > 0 ? Math.round((frontUsedUnits / totalUnits) * 100) : 0;
  const backPercentUsed = totalUnits > 0 ? Math.round((backUsedUnits / totalUnits) * 100) : 0;
  const combinedPercentUsed = totalUnits > 0 ? Math.round((combinedUsedUnits / totalUnits) * 100) : 0;

  return {
    totalUnits,
    frontUsedUnits,
    frontFreeUnits,
    frontPercentUsed,
    backUsedUnits,
    backFreeUnits,
    backPercentUsed,
    combinedUsedUnits,
    combinedFreeUnits,
    combinedPercentUsed,
    issues,
  };
};

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
    const rack = await prisma.rack.findUnique({
      where: { id },
      include: {
        location: true,
        assets: {
          include: { ips: true, rack: true, location: true },
          orderBy: [{ rackUnitStart: "asc" }, { name: "asc" }],
        },
      },
    });

    if (!rack) {
      return NextResponse.json({ error: "Rack not found" }, { status: 404 });
    }

    const assetsAtLocation = await prisma.asset.findMany({
      where: {
        OR: [
          { locationId: rack.locationId },
          { rackId: rack.id },
          { rackId: null },
        ],
      },
      include: { rack: true, ips: true, location: true },
      orderBy: [{ rackId: "asc" }, { location: { name: "asc" } }, { name: "asc" }],
    });

    const utilization = computeUtilization({
      totalUnits: rack.totalUnits,
      assets: rack.assets.map((a) => ({
        id: a.id,
        rackUnitStart: a.rackUnitStart,
        rackUnitSize: a.rackUnitSize,
        rackFace: a.rackFace ?? null,
      })),
    });

    return NextResponse.json({
      rack,
      assetsAtLocation,
      utilization,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch rack details" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const totalUnits = body.totalUnits;

    if (name !== undefined && name.length === 0) {
      return NextResponse.json({ error: "Rack name is required" }, { status: 400 });
    }

    if (
      totalUnits !== undefined &&
      (typeof totalUnits !== "number" || !Number.isFinite(totalUnits) || totalUnits < 1)
    ) {
      return NextResponse.json({ error: "totalUnits must be a positive number" }, { status: 400 });
    }

    const rack = await prisma.rack.findUnique({
      where: { id },
      include: { assets: true, location: { select: { id: true, name: true } } },
    });

    if (!rack) {
      return NextResponse.json({ error: "Rack not found" }, { status: 404 });
    }

    if (totalUnits !== undefined) {
      const maxEndU = rack.assets.reduce((acc, a) => {
        if (!a.rackUnitStart || !a.rackUnitSize) return acc;
        return Math.max(acc, a.rackUnitStart + a.rackUnitSize - 1);
      }, 0);

      if (totalUnits < maxEndU) {
        return NextResponse.json(
          { error: `Cannot reduce rack to ${totalUnits}U because assets occupy up to U${maxEndU}` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.rack.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(totalUnits !== undefined ? { totalUnits } : {}),
      },
    });

    await writeAuditLog({
      action: "RACK_UPDATE",
      userId: session.user.id,
      details: {
        rackId: updated.id,
        locationId: rack.location.id,
        locationName: rack.location.name,
        before: {
          name: rack.name,
          totalUnits: rack.totalUnits,
        },
        after: {
          name: updated.name,
          totalUnits: updated.totalUnits,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A rack with this name already exists in this datacenter" }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || "Failed to update rack" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const rack = await prisma.rack.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true } },
        _count: { select: { assets: true } },
      },
    });

    if (!rack) {
      return NextResponse.json({ error: "Rack not found" }, { status: 404 });
    }

    if (rack._count.assets > 0) {
      return NextResponse.json(
        { error: "Cannot delete a rack that still has assigned assets" },
        { status: 400 }
      );
    }

    await prisma.rack.delete({ where: { id } });

    await writeAuditLog({
      action: "RACK_DELETE",
      userId: session.user.id,
      details: {
        rackId: rack.id,
        name: rack.name,
        totalUnits: rack.totalUnits,
        locationId: rack.location.id,
        locationName: rack.location.name,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete rack" }, { status: 400 });
  }
}
