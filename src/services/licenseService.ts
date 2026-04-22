import { prisma } from "@/lib/prisma";
import { LicenseFormValues, LicenseUpdateValues } from "@/lib/validations/license";

const EXPIRING_SOON_DAYS = 30;
const EXPIRATION_REFRESH_JOB_KEY = "license-expiration-refresh";
const EXPIRATION_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

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

const licenseInclude = {
  asset: {
    select: { id: true, name: true, serialNumber: true, status: true },
  },
  products: {
    select: {
      id: true,
      name: true,
      code: true,
      lifecycle: true,
      criticality: true,
    },
    orderBy: {
      name: "asc" as const,
    },
  },
} as const;

const ensureProductsExist = async (productIds: string[]) => {
  const count = await prisma.product.count({
    where: {
      id: { in: productIds },
    },
  });

  if (count !== productIds.length) {
    throw new Error("One or more selected products no longer exist.");
  }
};

export const LicenseService = {
  async runExpirationRefreshJob(options: { force?: boolean } = {}) {
    const currentTime = new Date();
    const previousRun = await prisma.systemJobRun.findUnique({
      where: { key: EXPIRATION_REFRESH_JOB_KEY },
    });

    if (
      !options.force &&
      previousRun &&
      currentTime.getTime() - previousRun.lastRunAt.getTime() < EXPIRATION_REFRESH_INTERVAL_MS
    ) {
      return { skipped: true, refreshedAt: previousRun.lastRunAt };
    }

    await this.refreshExpiryStatuses();

    const [expiredLicenses, expiringLicenses] = await Promise.all([
      prisma.license.findMany({
        where: {
          isExpired: true,
          expiryDate: { not: null },
        },
        select: { id: true, name: true, expiryDate: true },
        orderBy: { expiryDate: "asc" },
      }),
      prisma.license.findMany({
        where: {
          isExpired: false,
          expiryDate: {
            gte: currentTime,
            lte: getExpiringSoonDate(),
          },
        },
        select: { id: true, name: true, expiryDate: true },
        orderBy: { expiryDate: "asc" },
      }),
    ]);

    await prisma.$transaction([
      prisma.operationalNotification.updateMany({
        where: {
          type: "LICENSE_EXPIRATION",
          resolvedAt: null,
          dedupeKey: {
            notIn: [
              ...expiredLicenses.map((license) => `license-expired:${license.id}`),
              ...expiringLicenses.map((license) => `license-expiring:${license.id}`),
            ],
          },
        },
        data: { resolvedAt: currentTime },
      }),
      ...expiredLicenses.map((license) =>
        prisma.operationalNotification.upsert({
          where: { dedupeKey: `license-expired:${license.id}` },
          update: {
            severity: "CRITICAL",
            title: `License expired: ${license.name}`,
            message: license.expiryDate
              ? `Expired on ${license.expiryDate.toISOString().slice(0, 10)}.`
              : "Expired license needs review.",
            href: "/licenses",
            resolvedAt: null,
          },
          create: {
            type: "LICENSE_EXPIRATION",
            severity: "CRITICAL",
            title: `License expired: ${license.name}`,
            message: license.expiryDate
              ? `Expired on ${license.expiryDate.toISOString().slice(0, 10)}.`
              : "Expired license needs review.",
            href: "/licenses",
            dedupeKey: `license-expired:${license.id}`,
          },
        })
      ),
      ...expiringLicenses.map((license) =>
        prisma.operationalNotification.upsert({
          where: { dedupeKey: `license-expiring:${license.id}` },
          update: {
            severity: "WARNING",
            title: `License expiring soon: ${license.name}`,
            message: license.expiryDate
              ? `Expires on ${license.expiryDate.toISOString().slice(0, 10)}.`
              : "Expiring license needs review.",
            href: "/licenses",
            resolvedAt: null,
          },
          create: {
            type: "LICENSE_EXPIRATION",
            severity: "WARNING",
            title: `License expiring soon: ${license.name}`,
            message: license.expiryDate
              ? `Expires on ${license.expiryDate.toISOString().slice(0, 10)}.`
              : "Expiring license needs review.",
            href: "/licenses",
            dedupeKey: `license-expiring:${license.id}`,
          },
        })
      ),
      prisma.systemJobRun.upsert({
        where: { key: EXPIRATION_REFRESH_JOB_KEY },
        update: { lastRunAt: currentTime },
        create: { key: EXPIRATION_REFRESH_JOB_KEY, lastRunAt: currentTime },
      }),
    ]);

    return {
      skipped: false,
      refreshedAt: currentTime,
      expired: expiredLicenses.length,
      expiringSoon: expiringLicenses.length,
    };
  },

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
      include: licenseInclude,
      orderBy: [
        { isExpired: "desc" },
        { expiryDate: "asc" },
        { name: "asc" },
      ],
    });
  },

  async getLicenseManagerData() {
    const [licenses, assets, products] = await Promise.all([
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
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          lifecycle: true,
          criticality: true,
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
        if (!license.assetId && license.products.length === 0) acc.unassigned += 1;
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

    return { licenses, assets, products, summary };
  },

  async createLicense(data: LicenseFormValues) {
    await ensureProductsExist(data.productIds);
    const normalized = toStoredExpiry(data.expiryDate);

    return await prisma.license.create({
      data: {
        name: data.name,
        key: data.key || null,
        licenseFile: data.licenseFile || null,
        expiryDate: normalized.expiryDate,
        assetId: data.assetId || null,
        isExpired: normalized.isExpired,
        products: {
          connect: data.productIds.map((id) => ({ id })),
        },
      },
      include: licenseInclude,
    });
  },

  async updateLicense(id: string, data: LicenseUpdateValues) {
    if (data.productIds !== undefined) {
      await ensureProductsExist(data.productIds);
    }

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
    if (data.productIds !== undefined) {
      payload.products = {
        set: data.productIds.map((relationId) => ({ id: relationId })),
      };
    }

    return await prisma.license.update({
      where: { id },
      data: payload,
      include: licenseInclude,
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
      include: licenseInclude,
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
