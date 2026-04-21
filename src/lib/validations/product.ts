import { ProductCriticality, ProductEnvironment, ProductLifecycle, ProductOptionType } from "@prisma/client";
import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    return value;
  },
  z.string().min(1).optional()
);

const relationIdList = z.preprocess((value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)));
}, z.array(z.string()));

const normalizedCode = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.trim().toUpperCase();
  }

  return value;
}, z
  .string()
  .min(2, "Product code must be at least 2 characters.")
  .max(32, "Product code must be 32 characters or fewer.")
  .regex(/^[A-Za-z0-9._-]+$/, "Product code can only contain letters, numbers, dot, underscore, and hyphen."));

const optionalUrl = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value;
}, z.string().url("Documentation URL must be a valid URL.").optional());

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters."),
  code: normalizedCode,
  description: optionalTrimmedString,
  environment: z.nativeEnum(ProductEnvironment),
  lifecycle: z.nativeEnum(ProductLifecycle),
  criticality: z.nativeEnum(ProductCriticality),
  documentationUrl: optionalUrl,
  notes: optionalTrimmedString,
  categoryOptionId: z.string().trim().min(1, "Category is required."),
  businessDomainOptionId: optionalTrimmedString,
  supportTeamOptionId: optionalTrimmedString,
  businessOwnerOptionId: z.string().trim().min(1, "Business owner is required."),
  technicalOwnerUserId: z.string().trim().min(1, "Technical owner is required."),
  assetIds: relationIdList,
  licenseIds: relationIdList,
});

export const productUpdateSchema = productSchema.partial().refine((data) => {
  return Object.values(data).some((value) => value !== undefined);
}, {
  message: "At least one field must be provided.",
});

export const productOptionSchema = z.object({
  type: z.nativeEnum(ProductOptionType).refine(
    (type) => type !== ProductOptionType.TECHNICAL_OWNER,
    "Technical owners are managed from User Management."
  ),
  value: z.string().trim().min(1, "Value is required.").max(120, "Value must be 120 characters or fewer."),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const productOptionUpdateSchema = productOptionSchema.partial().refine((data) => {
  return Object.values(data).some((value) => value !== undefined);
}, {
  message: "At least one field must be provided.",
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type ProductUpdateValues = z.infer<typeof productUpdateSchema>;
export type ProductOptionFormValues = z.infer<typeof productOptionSchema>;
export type ProductOptionUpdateValues = z.infer<typeof productOptionUpdateSchema>;
