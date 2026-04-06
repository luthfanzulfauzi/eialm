import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import type { AssetStatus, LocationType, RackFace } from "@prisma/client";

const normalize = (v: string | undefined) => (v ?? "").trim();
const upper = (v: string | undefined) => normalize(v).toUpperCase();
const lower = (v: string | undefined) => normalize(v).toLowerCase();

const asInt = (v: string | undefined) => {
  const s = normalize(v);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i;
};

const asStatus = (v: string | undefined): AssetStatus | null => {
  const s = upper(v);
  const allowed: AssetStatus[] = [
    "PLAN",
    "PURCHASED",
    "INSTALLING",
    "ACTIVE",
    "MAINTENANCE",
    "BROKEN",
    "DECOMMISSIONED",
  ];
  return (allowed as string[]).includes(s) ? (s as AssetStatus) : null;
};

const asLocationType = (v: string | undefined): LocationType | null => {
  const s = upper(v);
  return s === "DATACENTER" || s === "WAREHOUSE" ? (s as LocationType) : null;
};

const asRackFace = (v: string | undefined): RackFace | null => {
  const s = upper(v);
  return s === "FRONT" || s === "BACK" || s === "BOTH" ? (s as RackFace) : null;
};

const stripEmpty = (v: string | undefined) => {
  const s = normalize(v);
  return s.length ? s : null;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
    }

    const content = await file.text();
    const raw = parseCsv(content).filter((r) => r.some((c) => c.trim().length > 0));
    if (raw.length < 2) {
      return NextResponse.json({ error: "CSV must include a header row and at least one data row" }, { status: 400 });
    }

    const header = raw[0].map((h) => lower(h));
    const indexOf = (name: string) => header.indexOf(lower(name));
    const get = (row: string[], name: string) => {
      const idx = indexOf(name);
      return idx >= 0 ? row[idx] : "";
    };

    const rows = raw.slice(1);
    const errors: Array<{ row: number; error: string }> = [];
    const warnings: Array<{ row: number; warning: string }> = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const row = rows[i];

      const name = normalize(get(row, "name"));
      const serialNumber = normalize(get(row, "serialNumber"));
      const category = normalize(get(row, "category"));
      const status = asStatus(get(row, "status"));

      if (!name || !serialNumber || !category || !status) {
        errors.push({
          row: rowNumber,
          error: "Missing required fields: name, serialNumber, category, status",
        });
        continue;
      }

      const locationName = normalize(get(row, "locationName"));
      const locationType = asLocationType(get(row, "locationType"));
      const rackName = normalize(get(row, "rackName"));

      let locationId: string | null = null;
      let rackId: string | null = null;

      if (locationName) {
        const location = await prisma.location.findFirst({
          where: {
            name: { equals: locationName, mode: "insensitive" },
            ...(locationType ? { type: locationType } : {}),
          },
          select: { id: true },
        });
        if (!location) {
          warnings.push({ row: rowNumber, warning: `Location not found: "${locationName}" (imported without location)` });
        } else {
          locationId = location.id;
        }
      }

      if (rackName) {
        if (!locationId) {
          warnings.push({ row: rowNumber, warning: `Rack ignored because location is missing/unknown: "${rackName}"` });
        } else {
          const rack = await prisma.rack.findFirst({
            where: {
              name: { equals: rackName, mode: "insensitive" },
              locationId,
            },
            select: { id: true },
          });
          if (!rack) {
            warnings.push({
              row: rowNumber,
              warning: `Rack not found: "${rackName}" in "${locationName}" (imported without rack)`,
            });
          } else {
            rackId = rack.id;
          }
        }
      }

      const rackFace = rackId ? asRackFace(get(row, "rackFace")) : null;
      const rackUnitStart = rackId ? asInt(get(row, "rackUnitStart")) : null;
      const rackUnitSize = rackId ? asInt(get(row, "rackUnitSize")) : null;

      const payload = {
        name,
        serialNumber,
        category,
        status,
        locationId,
        rackId,
        rackFace,
        rackUnitStart,
        rackUnitSize,
        serverType: stripEmpty(get(row, "serverType")),
        cpuType: stripEmpty(get(row, "cpuType")),
        cpuSocketNumber: asInt(get(row, "cpuSocketNumber")),
        cpuCore: asInt(get(row, "cpuCore")),
        memoryType: stripEmpty(get(row, "memoryType")),
        memorySize: asInt(get(row, "memorySize")),
        memorySlotUsed: asInt(get(row, "memorySlotUsed")),
        memorySpeed: asInt(get(row, "memorySpeed")),
        diskOsType: stripEmpty(get(row, "diskOsType")),
        diskOsNumber: asInt(get(row, "diskOsNumber")),
        diskOsSize: asInt(get(row, "diskOsSize")),
        diskDataType: stripEmpty(get(row, "diskDataType")),
        diskDataNumber: asInt(get(row, "diskDataNumber")),
        diskDataSize: asInt(get(row, "diskDataSize")),
      } as any;

      try {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.asset.findUnique({
            where: { serialNumber },
            select: { id: true },
          });

          if (existing) {
            await tx.asset.update({
              where: { id: existing.id },
              data: payload,
            });
            await tx.auditLog.create({
              data: {
                action: "IMPORT_UPDATE",
                userId: session.user.id,
                assetId: existing.id,
                details: JSON.stringify({ serialNumber }),
              },
            });
            updated++;
          } else {
            const createdAsset = await tx.asset.create({ data: payload });
            await tx.auditLog.create({
              data: {
                action: "IMPORT_CREATE",
                userId: session.user.id,
                assetId: createdAsset.id,
                details: JSON.stringify({ serialNumber }),
              },
            });
            created++;
          }
        });
      } catch (e: any) {
        errors.push({ row: rowNumber, error: e?.message || "Failed to import row" });
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      created,
      updated,
      failed: errors.length,
      errors,
      warningsCount: warnings.length,
      warnings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to import assets" }, { status: 400 });
  }
}
