import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }

    return value;
  },
  z.string().min(1).optional()
);

const optionalDate = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return new Date(value);
  }

  return value;
}, z.date().optional());

export const licenseSchema = z.object({
  name: z.string().trim().min(2, "License name must be at least 2 characters."),
  key: optionalTrimmedString,
  licenseFile: optionalTrimmedString,
  expiryDate: optionalDate,
  assetId: optionalTrimmedString,
});

export const licenseUpdateSchema = licenseSchema.partial().refine((data) => {
  return Object.values(data).some((value) => value !== undefined);
}, {
  message: "At least one field must be provided.",
});

export const licenseAssignmentSchema = z.object({
  assetId: optionalTrimmedString.nullable().transform((value) => value ?? undefined),
});

export type LicenseFormValues = z.infer<typeof licenseSchema>;
export type LicenseUpdateValues = z.infer<typeof licenseUpdateSchema>;
