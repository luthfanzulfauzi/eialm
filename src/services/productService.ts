import { prisma } from "@/lib/prisma";
import {
  ProductFormValues,
  ProductOptionFormValues,
  ProductOptionUpdateValues,
  ProductUpdateValues,
} from "@/lib/validations/product";
import { ProductOptionType } from "@prisma/client";

const productInclude = {
  categoryOption: {
    select: { id: true, type: true, value: true },
  },
  businessDomainOption: {
    select: { id: true, type: true, value: true },
  },
  supportTeamOption: {
    select: { id: true, type: true, value: true },
  },
  businessOwnerOption: {
    select: { id: true, type: true, value: true },
  },
  technicalOwnerUser: {
    select: { id: true, name: true, email: true, role: true },
  },
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

const requiredProductOptionTypes = {
  categoryOptionId: ProductOptionType.CATEGORY,
  businessOwnerOptionId: ProductOptionType.BUSINESS_OWNER,
} as const;

const optionalProductOptionTypes = {
  businessDomainOptionId: ProductOptionType.BUSINESS_DOMAIN,
  supportTeamOptionId: ProductOptionType.SUPPORT_TEAM,
} as const;

const groupProductOptions = async () => {
  const options = await prisma.productOption.findMany({
    orderBy: [
      { type: "asc" },
      { sortOrder: "asc" },
      { value: "asc" },
    ],
  });

  return {
    all: options,
    byType: {
      CATEGORY: options.filter((option) => option.type === ProductOptionType.CATEGORY),
      BUSINESS_DOMAIN: options.filter((option) => option.type === ProductOptionType.BUSINESS_DOMAIN),
      SUPPORT_TEAM: options.filter((option) => option.type === ProductOptionType.SUPPORT_TEAM),
      BUSINESS_OWNER: options.filter((option) => option.type === ProductOptionType.BUSINESS_OWNER),
      TECHNICAL_OWNER: [],
    },
  };
};

const ensureRelationsExist = async (
  data: Partial<
    Pick<
      ProductFormValues,
      | "assetIds"
      | "licenseIds"
      | "categoryOptionId"
      | "businessDomainOptionId"
      | "supportTeamOptionId"
      | "businessOwnerOptionId"
      | "technicalOwnerUserId"
    >
  >
) => {
  const assetIds = data.assetIds || [];
  const licenseIds = data.licenseIds || [];

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

  for (const [fieldName, optionType] of Object.entries(requiredProductOptionTypes)) {
    const optionId = data[fieldName as keyof typeof requiredProductOptionTypes];
    const count = await prisma.productOption.count({
      where: {
        id: optionId,
        type: optionType,
      },
    });

    if (!optionId || count !== 1) {
      throw new Error(`Selected ${optionType.toLowerCase().replace(/_/g, " ")} is invalid.`);
    }
  }

  for (const [fieldName, optionType] of Object.entries(optionalProductOptionTypes)) {
    const optionId = data[fieldName as keyof typeof optionalProductOptionTypes];
    if (!optionId) continue;

    const count = await prisma.productOption.count({
      where: {
        id: optionId,
        type: optionType,
      },
    });

    if (count !== 1) {
      throw new Error(`Selected ${optionType.toLowerCase().replace(/_/g, " ")} is invalid.`);
    }
  }

  if ("technicalOwnerUserId" in data) {
    const userId = data.technicalOwnerUserId;
    const userCount = await prisma.user.count({
      where: { id: userId },
    });

    if (!userId || userCount !== 1) {
      throw new Error("Selected technical owner is invalid.");
    }
  }
};

export const ProductService = {
  async getProductManagerData() {
    const [products, assets, licenses, options, technicalOwners] = await Promise.all([
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
      groupProductOptions(),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: [
          { name: "asc" },
          { email: "asc" },
        ],
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

    return { products, assets, licenses, options, technicalOwners, summary };
  },

  async createProduct(data: ProductFormValues) {
    await ensureRelationsExist(data);

    return prisma.product.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        environment: data.environment,
        lifecycle: data.lifecycle,
        criticality: data.criticality,
        documentationUrl: data.documentationUrl || null,
        notes: data.notes || null,
        categoryOptionId: data.categoryOptionId,
        businessDomainOptionId: data.businessDomainOptionId || null,
        supportTeamOptionId: data.supportTeamOptionId || null,
        businessOwnerOptionId: data.businessOwnerOptionId,
        technicalOwnerUserId: data.technicalOwnerUserId,
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
    if (
      data.assetIds !== undefined ||
      data.licenseIds !== undefined ||
      data.categoryOptionId !== undefined ||
      data.businessDomainOptionId !== undefined ||
      data.supportTeamOptionId !== undefined ||
      data.businessOwnerOptionId !== undefined ||
      data.technicalOwnerUserId !== undefined
    ) {
      const currentProduct = await prisma.product.findUnique({
        where: { id },
        select: {
          categoryOptionId: true,
          businessDomainOptionId: true,
          supportTeamOptionId: true,
          businessOwnerOptionId: true,
          technicalOwnerUserId: true,
          assets: { select: { id: true } },
          licenses: { select: { id: true } },
        },
      });

      if (!currentProduct) {
        throw new Error("Product not found.");
      }

      await ensureRelationsExist({
        assetIds: data.assetIds ?? currentProduct.assets.map((asset) => asset.id),
        licenseIds: data.licenseIds ?? currentProduct.licenses.map((license) => license.id),
        categoryOptionId: data.categoryOptionId ?? currentProduct.categoryOptionId,
        businessDomainOptionId:
          data.businessDomainOptionId !== undefined
            ? data.businessDomainOptionId
            : currentProduct.businessDomainOptionId || undefined,
        supportTeamOptionId:
          data.supportTeamOptionId !== undefined
            ? data.supportTeamOptionId
            : currentProduct.supportTeamOptionId || undefined,
        businessOwnerOptionId: data.businessOwnerOptionId ?? currentProduct.businessOwnerOptionId,
        ...(data.technicalOwnerUserId !== undefined
          ? { technicalOwnerUserId: data.technicalOwnerUserId }
          : currentProduct.technicalOwnerUserId
            ? { technicalOwnerUserId: currentProduct.technicalOwnerUserId }
            : {}),
      });
    }

    const payload: Record<string, unknown> = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.code !== undefined) payload.code = data.code;
    if (data.description !== undefined) payload.description = data.description || null;
    if (data.environment !== undefined) payload.environment = data.environment;
    if (data.lifecycle !== undefined) payload.lifecycle = data.lifecycle;
    if (data.criticality !== undefined) payload.criticality = data.criticality;
    if (data.documentationUrl !== undefined) payload.documentationUrl = data.documentationUrl || null;
    if (data.notes !== undefined) payload.notes = data.notes || null;
    if (data.categoryOptionId !== undefined) payload.categoryOptionId = data.categoryOptionId;
    if (data.businessDomainOptionId !== undefined) payload.businessDomainOptionId = data.businessDomainOptionId || null;
    if (data.supportTeamOptionId !== undefined) payload.supportTeamOptionId = data.supportTeamOptionId || null;
    if (data.businessOwnerOptionId !== undefined) payload.businessOwnerOptionId = data.businessOwnerOptionId;
    if (data.technicalOwnerUserId !== undefined) payload.technicalOwnerUserId = data.technicalOwnerUserId;
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

  async getProductOptions() {
    return groupProductOptions();
  },

  async createProductOption(data: ProductOptionFormValues) {
    return prisma.productOption.create({
      data: {
        type: data.type,
        value: data.value.trim(),
        sortOrder: data.sortOrder ?? 0,
      },
    });
  },

  async updateProductOption(id: string, data: ProductOptionUpdateValues) {
    const payload: Record<string, unknown> = {};

    if (data.type !== undefined) payload.type = data.type;
    if (data.value !== undefined) payload.value = data.value.trim();
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;

    return prisma.productOption.update({
      where: { id },
      data: payload,
    });
  },

  async deleteProductOption(id: string) {
    return prisma.productOption.delete({
      where: { id },
    });
  },
};
