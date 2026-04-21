import { z } from 'zod';

const optionalTrimmedString = z.preprocess(
  (v) => (typeof v === "string" && v.trim().length === 0 ? undefined : v),
  z.string().min(1).optional()
);

const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().positive().optional()
);

const optionalId = z.preprocess(
  (v) => (typeof v === "string" && v.trim().length === 0 ? undefined : v),
  z.string().optional()
);

export const assetSchema = z.object({
  name: z.string().min(2),
  serialNumber: z.string().min(1),
  category: z.string().min(1),
  status: z.enum(['PLAN', 'PURCHASED', 'INSTALLING', 'ACTIVE', 'MAINTENANCE', 'BROKEN', 'DECOMMISSIONED']),
  locationType: z.enum(['DATACENTER', 'WAREHOUSE']).optional(),
  locationId: optionalId,
  rackId: optionalId,
  rackFace: z.enum(['FRONT', 'BACK', 'BOTH']).optional(),
  rackUnitStart: optionalPositiveInt,
  rackUnitSize: optionalPositiveInt,
  serverType: optionalTrimmedString,
  cpuType: optionalTrimmedString,
  cpuSocketNumber: optionalPositiveInt,
  cpuCore: optionalPositiveInt,
  memoryType: optionalTrimmedString,
  memorySize: optionalPositiveInt,
  memorySlotUsed: optionalPositiveInt,
  memorySpeed: optionalPositiveInt,
  diskOsType: optionalTrimmedString,
  diskOsNumber: optionalPositiveInt,
  diskOsSize: optionalPositiveInt,
  diskDataType: optionalTrimmedString,
  diskDataNumber: optionalPositiveInt,
  diskDataSize: optionalPositiveInt,
}).superRefine((data, ctx) => {
  const rackRequiredCategories = ['server', 'network device', 'switch', 'router'];
  if (data.locationType === 'WAREHOUSE' && data.rackId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Warehouse assets cannot be assigned to a rack",
      path: ["rackId"],
    });
  }

  if (data.locationType === 'DATACENTER' && rackRequiredCategories.includes(data.category.toLowerCase()) && !data.rackId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Server and network hardware in a datacenter must be assigned to a rack",
      path: ["rackId"],
    });
  }
});

// Add this line to export the type for use in your forms
export type AssetFormValues = z.infer<typeof assetSchema>;
