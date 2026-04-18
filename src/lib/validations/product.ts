import { ProductCriticality, ProductEnvironment, ProductLifecycle } from "@prisma/client";
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
  category: z.string().trim().min(2, "Category must be at least 2 characters."),
  businessDomain: optionalTrimmedString,
  environment: z.nativeEnum(ProductEnvironment),
  lifecycle: z.nativeEnum(ProductLifecycle),
  criticality: z.nativeEnum(ProductCriticality),
  businessOwner: z.string().trim().min(2, "Business owner is required."),
  technicalOwner: z.string().trim().min(2, "Technical owner is required."),
  supportTeam: optionalTrimmedString,
  documentationUrl: optionalUrl,
  notes: optionalTrimmedString,
  assetIds: relationIdList,
  licenseIds: relationIdList,
});

export const productUpdateSchema = productSchema.partial().refine((data) => {
  return Object.values(data).some((value) => value !== undefined);
}, {
  message: "At least one field must be provided.",
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type ProductUpdateValues = z.infer<typeof productUpdateSchema>;
