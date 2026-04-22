import { prisma } from "@/lib/prisma";
import { MaintenanceFormValues, MaintenanceUpdateValues } from "@/lib/validations/maintenance";

const maintenanceInclude = {
  asset: {
    select: {
      id: true,
      name: true,
      serialNumber: true,
      category: true,
      status: true,
      location: { select: { name: true, type: true } },
      rack: { select: { name: true } },
    },
  },
} as const;

const now = () => new Date();

const nextAssetStatus = (type?: string, status?: string) => {
  if (status === "COMPLETED") return "ACTIVE";
  if (status === "IN_PROGRESS") return "MAINTENANCE";
  if (type === "REPAIR" && status !== "CANCELLED") return "BROKEN";
  return null;
};

const recordLifecycleDates = (status?: string) => {
  if (status === "IN_PROGRESS") return { startedAt: now(), completedAt: null };
  if (status === "COMPLETED") return { completedAt: now() };
  if (status === "CANCELLED") return { completedAt: null };
  return {};
};

export const MaintenanceService = {
  async getMaintenanceManagerData() {
    const [records, assets, brokenAssets] = await Promise.all([
      prisma.maintenanceRecord.findMany({
        include: maintenanceInclude,
        orderBy: [
          { status: "asc" },
          { scheduledAt: "asc" },
        ],
      }),
      prisma.asset.findMany({
        select: {
          id: true,
          name: true,
          serialNumber: true,
          category: true,
          status: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.asset.findMany({
        where: { status: "BROKEN" },
        select: {
          id: true,
          name: true,
          serialNumber: true,
          category: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const today = now();
    const summary = records.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === "SCHEDULED" || record.status === "IN_PROGRESS") acc.open += 1;
        if (record.status === "COMPLETED") acc.completed += 1;
        if (record.status !== "COMPLETED" && record.status !== "CANCELLED" && record.scheduledAt <= today) {
          acc.due += 1;
        }
        return acc;
      },
      {
        total: 0,
        open: 0,
        due: 0,
        completed: 0,
        brokenAssets: brokenAssets.length,
      }
    );

    return { records, assets, brokenAssets, summary };
  },

  async createMaintenance(data: MaintenanceFormValues, userId: string) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: data.assetId },
        select: { id: true, name: true, status: true },
      });

      if (!asset) {
        throw new Error("Asset not found.");
      }

      const record = await tx.maintenanceRecord.create({
        data: {
          assetId: data.assetId,
          title: data.title,
          type: data.type,
          status: data.status,
          priority: data.priority,
          description: data.description || null,
          scheduledAt: data.scheduledAt,
          resolution: data.resolution || null,
          ...recordLifecycleDates(data.status),
        },
        include: maintenanceInclude,
      });

      const status = nextAssetStatus(data.type, data.status);
      if (status && asset.status !== status) {
        await tx.asset.update({
          where: { id: asset.id },
          data: { status: status as any },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "MAINTENANCE_CREATE",
          userId,
          assetId: asset.id,
          details: JSON.stringify({
            maintenanceId: record.id,
            title: record.title,
            type: record.type,
            status: record.status,
            priority: record.priority,
          }),
        },
      });

      return record;
    });
  },

  async updateMaintenance(id: string, data: MaintenanceUpdateValues, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.maintenanceRecord.findUnique({
        where: { id },
        include: { asset: { select: { id: true, status: true } } },
      });

      if (!existing) {
        throw new Error("Maintenance record not found.");
      }

      const nextStatus = data.status ?? existing.status;
      const nextType = data.type ?? existing.type;

      const record = await tx.maintenanceRecord.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.description !== undefined ? { description: data.description || null } : {}),
          ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt } : {}),
          ...(data.resolution !== undefined ? { resolution: data.resolution || null } : {}),
          ...recordLifecycleDates(data.status),
        },
        include: maintenanceInclude,
      });

      const assetStatus = nextAssetStatus(nextType, nextStatus);
      if (assetStatus && existing.asset.status !== assetStatus) {
        await tx.asset.update({
          where: { id: existing.asset.id },
          data: { status: assetStatus as any },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "MAINTENANCE_UPDATE",
          userId,
          assetId: existing.asset.id,
          details: JSON.stringify({
            maintenanceId: record.id,
            before: {
              status: existing.status,
              priority: existing.priority,
            },
            after: {
              status: record.status,
              priority: record.priority,
            },
          }),
        },
      });

      return record;
    });
  },
};
