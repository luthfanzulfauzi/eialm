import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import type { AssetStatus, LocationType } from "@prisma/client";

const dateStamp = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const cat = searchParams.get("cat") || undefined;
  const type = (searchParams.get("type") as LocationType | null) || undefined;
  const status = (searchParams.get("status") as AssetStatus | null) || undefined;

  const where = {
    AND: [
      cat ? { category: { equals: cat, mode: "insensitive" as const } } : {},
      status ? { status } : {},
      type ? { location: { type } } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { serialNumber: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

  const assets = await prisma.asset.findMany({
    where,
    include: { location: true, rack: { include: { location: true } }, ips: true },
    orderBy: { updatedAt: "desc" },
  });

  const header = [
    "name",
    "serialNumber",
    "category",
    "status",
    "locationType",
    "locationName",
    "rackName",
    "rackFace",
    "rackUnitStart",
    "rackUnitSize",
    "serverType",
    "cpuType",
    "cpuSocketNumber",
    "cpuCore",
    "memoryType",
    "memorySize",
    "memorySlotUsed",
    "memorySpeed",
    "diskOsType",
    "diskOsNumber",
    "diskOsSize",
    "diskDataType",
    "diskDataNumber",
    "diskDataSize",
    "ipAddresses",
    "createdAt",
    "updatedAt",
  ];

  const rows = assets.map((a) => {
    const fallbackLocation = (a as any).rack?.location || null;
    const locationType = a.location?.type || fallbackLocation?.type || "";
    const locationName = a.location?.name || fallbackLocation?.name || "";

    return [
    a.name,
    a.serialNumber,
    a.category,
    a.status,
    locationType,
    locationName,
    a.rack?.name || "",
    (a as any).rackFace || "",
    (a as any).rackUnitStart ?? "",
    (a as any).rackUnitSize ?? "",
    (a as any).serverType || "",
    (a as any).cpuType || "",
    (a as any).cpuSocketNumber ?? "",
    (a as any).cpuCore ?? "",
    (a as any).memoryType || "",
    (a as any).memorySize ?? "",
    (a as any).memorySlotUsed ?? "",
    (a as any).memorySpeed ?? "",
    (a as any).diskOsType || "",
    (a as any).diskOsNumber ?? "",
    (a as any).diskOsSize ?? "",
    (a as any).diskDataType || "",
    (a as any).diskDataNumber ?? "",
    (a as any).diskDataSize ?? "",
    a.ips.map((ip) => ip.address).join("|"),
    a.createdAt.toISOString(),
    a.updatedAt.toISOString(),
    ];
  });

  const csv = toCsv([header, ...rows]);
  const filename = `assets-${dateStamp()}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
