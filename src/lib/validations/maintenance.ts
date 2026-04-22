import { z } from "zod";

const optionalTrimmedString = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return value;
}, z.string().min(1).optional());

const requiredDate = z.preprocess((value) => {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim().length > 0) return new Date(value);
  return value;
}, z.date());

export const maintenanceTypes = ["PREVENTIVE", "INSPECTION", "REPAIR", "OTHER"] as const;
export const maintenanceStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const maintenancePriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const maintenanceSchema = z.object({
  assetId: z.string().trim().min(1, "Asset is required."),
  title: z.string().trim().min(2, "Title must be at least 2 characters."),
  type: z.enum(maintenanceTypes),
  status: z.enum(maintenanceStatuses).default("SCHEDULED"),
  priority: z.enum(maintenancePriorities),
  description: optionalTrimmedString,
  scheduledAt: requiredDate,
  resolution: optionalTrimmedString,
});

export const maintenanceUpdateSchema = z.object({
  title: z.string().trim().min(2).optional(),
  type: z.enum(maintenanceTypes).optional(),
  status: z.enum(maintenanceStatuses).optional(),
  priority: z.enum(maintenancePriorities).optional(),
  description: optionalTrimmedString,
  scheduledAt: requiredDate.optional(),
  resolution: optionalTrimmedString,
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "At least one field must be provided.",
});

export type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;
export type MaintenanceUpdateValues = z.infer<typeof maintenanceUpdateSchema>;
