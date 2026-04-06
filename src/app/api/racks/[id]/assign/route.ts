import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
  return aStart <= bEnd && bStart <= aEnd;
};

const normalizeFace = (v: unknown): "FRONT" | "BACK" | "BOTH" => {
  if (v === "FRONT" || v === "BACK" || v === "BOTH") return v;
  return "FRONT";
};

const facesIntersect = (
  a: "FRONT" | "BACK" | "BOTH" | null,
  b: "FRONT" | "BACK" | "BOTH" | null
) => {
  const aFaces = a === "BOTH" ? ["FRONT", "BACK"] : [a ?? "FRONT"];
  const bFaces = b === "BOTH" ? ["FRONT", "BACK"] : [b ?? "FRONT"];
  return aFaces.some((f) => bFaces.includes(f));
};

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!session.user.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const assetId = body.assetId;
    const rackUnitStart = body.rackUnitStart;
    const rackUnitSize = body.rackUnitSize;
    const rackFace = normalizeFace(body.rackFace);
    const removeFromRack = body.removeFromRack === true;

    if (typeof assetId !== "string" || assetId.trim().length === 0) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const rack = await prisma.rack.findUnique({
      where: { id: params.id },
      select: { id: true, locationId: true, totalUnits: true, name: true },
    });

    if (!rack) {
      return NextResponse.json({ error: "Rack not found" }, { status: 404 });
    }

    return await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          name: true,
          serialNumber: true,
          rackId: true,
          locationId: true,
          rackUnitStart: true,
          rackUnitSize: true,
          rackFace: true,
          rack: { select: { name: true } },
        },
      });

      if (!asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      if (removeFromRack) {
        const updated = await tx.asset.update({
          where: { id: assetId },
          data: {
            rackId: null,
            rackUnitStart: null,
            rackUnitSize: null,
            rackFace: null,
          },
        });

        await tx.auditLog.create({
          data: {
            action: "MOVE",
            userId: session.user.id,
            assetId: assetId,
            details: `Removed from rack ${asset.rack?.name || "N/A"}`,
          },
        });

        return NextResponse.json(updated);
      }

      if (
        typeof rackUnitStart !== "number" ||
        !Number.isFinite(rackUnitStart) ||
        typeof rackUnitSize !== "number" ||
        !Number.isFinite(rackUnitSize)
      ) {
        return NextResponse.json(
          { error: "rackUnitStart and rackUnitSize must be numbers" },
          { status: 400 }
        );
      }

      if (rackUnitStart < 1 || rackUnitSize < 1) {
        return NextResponse.json(
          { error: "rackUnitStart and rackUnitSize must be positive" },
          { status: 400 }
        );
      }

      const endU = rackUnitStart + rackUnitSize - 1;
      if (endU > rack.totalUnits) {
        return NextResponse.json(
          { error: `Placement ${rackUnitStart}-${endU} exceeds rack height (1-${rack.totalUnits})` },
          { status: 400 }
        );
      }

      const otherAssets = await tx.asset.findMany({
        where: {
          rackId: rack.id,
          NOT: { id: assetId },
          rackUnitStart: { not: null },
          rackUnitSize: { not: null },
        },
        select: { id: true, rackUnitStart: true, rackUnitSize: true, rackFace: true },
      });

      for (const other of otherAssets) {
        const oStart = other.rackUnitStart as number;
        const oEnd = oStart + (other.rackUnitSize as number) - 1;
        if (facesIntersect(rackFace, (other as any).rackFace ?? null) && rangesOverlap(rackUnitStart, endU, oStart, oEnd)) {
          return NextResponse.json(
            { error: `Placement overlaps with another asset occupying ${oStart}-${oEnd}` },
            { status: 400 }
          );
        }
      }

      const updated = await tx.asset.update({
        where: { id: assetId },
        data: {
          rackId: rack.id,
          locationId: rack.locationId,
          rackUnitStart,
          rackUnitSize,
          rackFace,
        },
      });

      const fromRackName = asset.rack?.name || "N/A";
      await tx.auditLog.create({
        data: {
          action: "MOVE",
          userId: session.user.id,
          assetId: assetId,
          details: `Placed in rack ${rack.name} (${rackFace}) (U${rackUnitStart}-U${endU}), moved from ${fromRackName}`,
        },
      });

      return NextResponse.json(updated);
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to assign asset to rack" }, { status: 400 });
  }
}
