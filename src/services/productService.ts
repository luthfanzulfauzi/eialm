import { prisma } from "@/lib/prisma";
import { ProductFormValues, ProductUpdateValues } from "@/lib/validations/product";

const productInclude = {
  assets: {
    select: {
      id: true,
      name: true,
      serialNumber: true,
      status: true,
      category: true,
    },
    orderBy: {
      name: "asc" as const,
    },
  },
  licenses: {
    select: {
      id: true,
      name: true,
      key: true,
      isExpired: true,
      expiryDate: true,
    },
    orderBy: {
      name: "asc" as const,
    },
  },
} as const;

const ensureRelationsExist = async (assetIds: string[], licenseIds: string[]) => {
  const [assetCount, licenseCount] = await Promise.all([
    prisma.asset.count({
      where: {
        id: { in: assetIds },
      },
    }),
    prisma.license.count({
      where: {
        id: { in: licenseIds },
      },
    }),
  ]);

  if (assetCount !== assetIds.length) {
    throw new Error("One or more selected assets no longer exist.");
  }

  if (licenseCount !== licenseIds.length) {
    throw new Error("One or more selected licenses no longer exist.");
  }
};

export const ProductService = {
  async getProductManagerData() {
    const [products, assets, licenses] = await Promise.all([
      prisma.product.findMany({
        include: productInclude,
        orderBy: [
          { criticality: "desc" },
          { name: "asc" },
        ],
      }),
      prisma.asset.findMany({
        select: {
          id: true,
          name: true,
          serialNumber: true,
          status: true,
          category: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.license.findMany({
        select: {
          id: true,
          name: true,
          key: true,
          isExpired: true,
          expiryDate: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const summary = products.reduce(
      (acc, product) => {
        acc.total += 1;
        if (product.lifecycle === "ACTIVE") acc.active += 1;
        if (product.lifecycle === "PLANNING") acc.planning += 1;
        if (product.criticality === "CRITICAL") acc.critical += 1;
        if (product.assets.length === 0 && product.licenses.length === 0) acc.unmapped += 1;
        return acc;
      },
      {
        total: 0,
        active: 0,
        planning: 0,
        critical: 0,
        unmapped: 0,
      }
    );

    return { products, assets, licenses, summary };
  },

  async createProduct(data: ProductFormValues) {
    await ensureRelationsExist(data.assetIds, data.licenseIds);

    return prisma.product.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        category: data.category,
        businessDomain: data.businessDomain || null,
        environment: data.environment,
        lifecycle: data.lifecycle,
        criticality: data.criticality,
        businessOwner: data.businessOwner,
        technicalOwner: data.technicalOwner,
        supportTeam: data.supportTeam || null,
        documentationUrl: data.documentationUrl || null,
        notes: data.notes || null,
        assets: {
          connect: data.assetIds.map((id) => ({ id })),
        },
        licenses: {
          connect: data.licenseIds.map((id) => ({ id })),
        },
      },
      include: productInclude,
    });
  },

  async updateProduct(id: string, data: ProductUpdateValues) {
    if (data.assetIds || data.licenseIds) {
      await ensureRelationsExist(data.assetIds || [], data.licenseIds || []);
    }

    const payload: Record<string, unknown> = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.code !== undefined) payload.code = data.code;
    if (data.description !== undefined) payload.description = data.description || null;
    if (data.category !== undefined) payload.category = data.category;
    if (data.businessDomain !== undefined) payload.businessDomain = data.businessDomain || null;
    if (data.environment !== undefined) payload.environment = data.environment;
    if (data.lifecycle !== undefined) payload.lifecycle = data.lifecycle;
    if (data.criticality !== undefined) payload.criticality = data.criticality;
    if (data.businessOwner !== undefined) payload.businessOwner = data.businessOwner;
    if (data.technicalOwner !== undefined) payload.technicalOwner = data.technicalOwner;
    if (data.supportTeam !== undefined) payload.supportTeam = data.supportTeam || null;
    if (data.documentationUrl !== undefined) payload.documentationUrl = data.documentationUrl || null;
    if (data.notes !== undefined) payload.notes = data.notes || null;
    if (data.assetIds !== undefined) {
      payload.assets = {
        set: data.assetIds.map((relationId) => ({ id: relationId })),
      };
    }
    if (data.licenseIds !== undefined) {
      payload.licenses = {
        set: data.licenseIds.map((relationId) => ({ id: relationId })),
      };
    }

    return prisma.product.update({
      where: { id },
      data: payload,
      include: productInclude,
    });
  },

  async deleteProduct(id: string) {
    return prisma.product.delete({
      where: { id },
    });
  },
};
