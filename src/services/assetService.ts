import { prisma } from "@/lib/prisma";
import { AssetStatus, Prisma, LocationType } from "@prisma/client";
import { AssetFormValues } from "@/lib/validations/asset";

export const AssetService = {
  /**
   * Fetches assets with search, category, status, and location type filtering
   */
  async getAssets(params: {
    search?: string;
    category?: string;
    status?: AssetStatus;
    type?: LocationType; // Add this to the type definition
    page?: number;
  }) {
    const { search, category, status, type, page = 1 } = params;
    const skip = (page - 1) * 10;

    // Build flexible filter
    const where: Prisma.AssetWhereInput = {
      AND: [
        category ? { category: { equals: category, mode: 'insensitive' } } : {},
        status ? { status } : {},
        // Filter by location type (e.g., DATACENTER or WAREHOUSE)
        type ? { location: { type: type } } : {},
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
        take: 10,
        skip,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.asset.count({ where })
    ]);

    return { items, total, pages: Math.ceil(total / 10) };
  },

  // ... rest of the service methods remain the same
  async createAsset(data: AssetFormValues, userId: string) {
    const normalizeId = (v?: unknown) => (typeof v === "string" && v.trim().length > 0 ? v : null);
    const normalizeString = (v?: unknown) => (typeof v === "string" && v.trim().length > 0 ? v : null);
    const normalizeInt = (v?: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

    return await prisma.$transaction(async (tx: any) => {
      const asset = await tx.asset.create({
        data: {
          name: data.name,
          serialNumber: data.serialNumber,
          category: data.category,
          status: data.status,
          locationId: normalizeId(data.locationId),
          rackId: normalizeId(data.rackId),
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
          auditLogs: {
            create: {
              action: 'CREATE',
              userId: userId,
              details: `Initial entry created with status: ${data.status}`
            }
          }
        }
      });
      return asset;
    });
  },

  async updateAsset(assetId: string, data: AssetFormValues, userId: string) {
    const normalizeId = (v?: string) => (typeof v === "string" && v.trim().length > 0 ? v : null);
    const normalizeString = (v?: unknown) => (typeof v === "string" && v.trim().length > 0 ? v : null);
    const normalizeInt = (v?: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

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

      const updated = await tx.asset.update({
        where: { id: assetId },
        data: {
          name: data.name,
          serialNumber: data.serialNumber,
          category: data.category,
          status: data.status,
          locationId: normalizeId(data.locationId as any),
          rackId: normalizeId(data.rackId as any),
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
        },
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
  }
};
