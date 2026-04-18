import { prisma } from "@/lib/prisma";
import { LicenseFormValues, LicenseUpdateValues } from "@/lib/validations/license";

const EXPIRING_SOON_DAYS = 30;

const getExpiringSoonDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + EXPIRING_SOON_DAYS);
  return date;
};

const toStoredExpiry = (expiryDate?: Date) => {
  if (!expiryDate) {
    return {
      expiryDate: null,
      isExpired: false,
    };
  }

  return {
    expiryDate,
    isExpired: expiryDate < new Date(),
  };
};

export const LicenseService = {
  async refreshExpiryStatuses() {
    const now = new Date();

    await prisma.$transaction([
      prisma.license.updateMany({
        where: {
          expiryDate: {
            lt: now,
          },
          isExpired: false,
        },
        data: {
          isExpired: true,
        },
      }),
      prisma.license.updateMany({
        where: {
          OR: [
            { expiryDate: null },
            {
              expiryDate: {
                gte: now,
              },
            },
          ],
          isExpired: true,
        },
        data: {
          isExpired: false,
        },
      }),
    ]);
  },

  async getLicenses() {
    await this.refreshExpiryStatuses();

    return await prisma.license.findMany({
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true, status: true },
        },
      },
      orderBy: [
        { isExpired: "desc" },
        { expiryDate: "asc" },
        { name: "asc" },
      ],
    });
  },

  async getLicenseManagerData() {
    const [licenses, assets] = await Promise.all([
      this.getLicenses(),
      prisma.asset.findMany({
        select: {
          id: true,
          name: true,
          serialNumber: true,
          status: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const expiringThreshold = getExpiringSoonDate();
    const summary = licenses.reduce(
      (acc, license) => {
        const expiryDate = license.expiryDate ? new Date(license.expiryDate) : null;
        const isExpiringSoon =
          !!expiryDate && !license.isExpired && expiryDate <= expiringThreshold;

        acc.total += 1;
        if (license.isExpired) acc.expired += 1;
        if (isExpiringSoon) acc.expiringSoon += 1;
        if (!license.assetId) acc.unassigned += 1;
        if (!license.isExpired && !isExpiringSoon) acc.active += 1;
        return acc;
      },
      {
        total: 0,
        active: 0,
        expiringSoon: 0,
        expired: 0,
        unassigned: 0,
      }
    );

    return { licenses, assets, summary };
  },

  async createLicense(data: LicenseFormValues) {
    const normalized = toStoredExpiry(data.expiryDate);

    return await prisma.license.create({
      data: {
        name: data.name,
        key: data.key || null,
        licenseFile: data.licenseFile || null,
        expiryDate: normalized.expiryDate,
        assetId: data.assetId || null,
        isExpired: normalized.isExpired,
      },
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true, status: true },
        },
      },
    });
  },

  async updateLicense(id: string, data: LicenseUpdateValues) {
    const payload: Record<string, unknown> = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.key !== undefined) payload.key = data.key || null;
    if (data.licenseFile !== undefined) payload.licenseFile = data.licenseFile || null;
    if (data.assetId !== undefined) payload.assetId = data.assetId || null;
    if (data.expiryDate !== undefined) {
      const normalized = toStoredExpiry(data.expiryDate);
      payload.expiryDate = normalized.expiryDate;
      payload.isExpired = normalized.isExpired;
    }

    return await prisma.license.update({
      where: { id },
      data: payload,
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true, status: true },
        },
      },
    });
  },

  async deleteLicense(id: string) {
    return await prisma.license.delete({
      where: { id },
    });
  },

  async assignLicense(id: string, assetId?: string) {
    if (assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { id: true },
      });

      if (!asset) {
        throw new Error("Asset not found");
      }
    }

    return await prisma.license.update({
      where: { id },
      data: {
        assetId: assetId || null,
      },
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true, status: true },
        },
      },
    });
  },

  async getExpiringSoon() {
    await this.refreshExpiryStatuses();

    return await prisma.license.findMany({
      where: {
        expiryDate: {
          lte: getExpiringSoonDate(),
          gte: new Date()
        }
      }
    });
  }
};
