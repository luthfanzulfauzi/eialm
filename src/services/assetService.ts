import { prisma } from "@/lib/prisma";
import { AssetStatus, Prisma, LocationType } from "@prisma/client";
import { AssetFormValues } from "@/lib/validations/asset";

const PAGE_SIZE = 10;

export type AssetRackState = "RACKED" | "UNRACKED" | "UNASSIGNED";

const rackRequiredCategories = ["server", "network device", "switch", "router"];

const normalizeId = (v?: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
const normalizeString = (v?: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
const normalizeInt = (v?: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const isRackRequiredCategory = (category: string) =>
  rackRequiredCategories.includes(category.trim().toLowerCase());

const sanitizeAssetInput = (data: AssetFormValues) => ({
  name: data.name.trim(),
  serialNumber: data.serialNumber.trim(),
  category: data.category.trim(),
  status: data.status,
  locationId: normalizeId(data.locationId),
  rackId: normalizeId(data.rackId),
  rackFace: (data as any).rackFace ?? null,
  rackUnitStart: normalizeInt((data as any).rackUnitStart),
  rackUnitSize: normalizeInt((data as any).rackUnitSize),
  serverType: normalizeString(data.serverType),
  cpuType: normalizeString(data.cpuType),
  cpuSocketNumber: normalizeInt(data.cpuSocketNumber),
  cpuCore: normalizeInt(data.cpuCore),
  memoryType: normalizeString(data.memoryType),
  memorySize: normalizeInt(data.memorySize),
  memorySlotUsed: normalizeInt(data.memorySlotUsed),
  memorySpeed: normalizeInt(data.memorySpeed),
  diskOsType: normalizeString(data.diskOsType),
  diskOsNumber: normalizeInt(data.diskOsNumber),
  diskOsSize: normalizeInt(data.diskOsSize),
  diskDataType: normalizeString(data.diskDataType),
  diskDataNumber: normalizeInt(data.diskDataNumber),
  diskDataSize: normalizeInt(data.diskDataSize),
});

const resolvePlacement = async (
  tx: Prisma.TransactionClient,
  data: ReturnType<typeof sanitizeAssetInput>
) => {
  let locationId = data.locationId;
  let rackId = data.rackId;

  if (data.rackUnitStart !== null && data.rackUnitStart <= 0) {
    throw new Error("Rack unit start must be a positive number");
  }

  if (data.rackUnitSize !== null && data.rackUnitSize <= 0) {
    throw new Error("Rack unit size must be a positive number");
  }

  const rack = rackId
    ? await tx.rack.findUnique({
        where: { id: rackId },
        include: { location: true },
      })
    : null;

  if (rackId && !rack) {
    throw new Error("Selected rack was not found");
  }

  if (rack && rack.location.type !== "DATACENTER") {
    throw new Error("Rack placement is only valid inside a datacenter");
  }

  if (rack && locationId && locationId !== rack.locationId) {
    throw new Error("Selected rack does not belong to the selected location");
  }

  if (rack) {
    locationId = rack.locationId;
  }

  const location = locationId
    ? await tx.location.findUnique({ where: { id: locationId } })
    : null;

  if (locationId && !location) {
    throw new Error("Selected location was not found");
  }

  if (location?.type === "WAREHOUSE" && rackId) {
    throw new Error("Warehouse assets cannot be assigned to a rack");
  }

  if (location?.type === "DATACENTER" && isRackRequiredCategory(data.category) && !rackId) {
    throw new Error("Server and network hardware in a datacenter must be assigned to a rack");
  }

  return {
    ...data,
    locationId,
    rackId,
    rackFace: rackId ? (data as any).rackFace ?? null : null,
    rackUnitStart: rackId ? (data as any).rackUnitStart ?? null : null,
    rackUnitSize: rackId ? (data as any).rackUnitSize ?? null : null,
  };
};

export const AssetService = {
  /**
   * Fetches assets with search, category, status, location type, rack-state filtering, and pagination.
   */
  async getAssets(params: {
    search?: string;
    category?: string;
    status?: AssetStatus;
    type?: LocationType;
    rackState?: AssetRackState;
    page?: number;
  }) {
    const { search, category, status, type, rackState, page = 1 } = params;
    const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const skip = (currentPage - 1) * PAGE_SIZE;

    const where: Prisma.AssetWhereInput = {
      AND: [
        category ? { category: { equals: category, mode: 'insensitive' } } : {},
        status ? { status } : {},
        type ? { location: { type: type } } : {},
        rackState === "RACKED" ? { rackId: { not: null } } : {},
        rackState === "UNRACKED" ? { locationId: { not: null }, rackId: null } : {},
        rackState === "UNASSIGNED" ? { locationId: null, rackId: null } : {},
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { serialNumber: { contains: search, mode: 'insensitive' } },
          ]
        } : {},
      ]
    };

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: { 
          location: true, 
          rack: true, 
          ips: true 
        },
        take: PAGE_SIZE,
        skip,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.asset.count({ where })
    ]);

    return { items, total, page: currentPage, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  },

  async createAsset(data: AssetFormValues, userId: string) {
    return await prisma.$transaction(async (tx: any) => {
      const assetData = await resolvePlacement(tx, sanitizeAssetInput(data));
      const asset = await tx.asset.create({
        data: {
          ...assetData,
          auditLogs: {
            create: {
              action: 'CREATE',
              userId: userId,
              details: `Initial entry created with status: ${assetData.status}`
            }
          }
        }
      });
      return asset;
    });
  },

  async updateAsset(assetId: string, data: AssetFormValues, userId: string) {
    return await prisma.$transaction(async (tx: any) => {
      const existing = await tx.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          name: true,
          serialNumber: true,
          category: true,
          status: true,
          locationId: true,
          rackId: true,
        },
      });

      if (!existing) throw new Error("Asset not found");
      const assetData = await resolvePlacement(tx, sanitizeAssetInput(data));

      const updated = await tx.asset.update({
        where: { id: assetId },
        data: assetData,
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          userId,
          assetId,
          details: JSON.stringify({
            before: existing,
            after: {
              name: updated.name,
              serialNumber: updated.serialNumber,
              category: updated.category,
              status: updated.status,
              locationId: updated.locationId,
              rackId: updated.rackId,
            },
          }),
        },
      });

      return updated;
    });
  },

  async deleteAsset(assetId: string, userId: string) {
    return await prisma.$transaction(async (tx: any) => {
      const existing = await tx.asset.findUnique({
        where: { id: assetId },
        select: { id: true, name: true, serialNumber: true, category: true },
      });

      if (!existing) throw new Error("Asset not found");

      await tx.auditLog.create({
        data: {
          action: "DELETE",
          userId,
          details: JSON.stringify({
            assetId: existing.id,
            name: existing.name,
            serialNumber: existing.serialNumber,
            category: existing.category,
          }),
        },
      });

      await tx.asset.delete({ where: { id: assetId } });
      return { ok: true };
    });
  },

  async updateAssetLocation(
    assetId: string, 
    userId: string, 
    newLocation: { locationId?: string; rackId?: string }
  ) {
    return await prisma.$transaction(async (tx: any) => {
      const oldAsset = await tx.asset.findUnique({ 
        where: { id: assetId },
        include: { rack: true } 
      });
      
      const updated = await tx.asset.update({
        where: { id: assetId },
        data: newLocation
      });

      const newRack = newLocation.rackId 
        ? await tx.rack.findUnique({ where: { id: newLocation.rackId } })
        : null;

      await tx.auditLog.create({
        data: {
          action: "MOVE",
          userId,
          assetId,
          details: `Moved from ${oldAsset?.rack?.name || 'N/A'} to ${newRack?.name || 'N/A'}`
        }
      });

      return updated;
    });
  },

  isRackRequiredCategory,
};
