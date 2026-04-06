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
  locationId: optionalId,
  rackId: optionalId,
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
}).refine((data) => { // TS will now recognize 'data' correctly after Zod is installed
  const rackRequiredCategories = ['server', 'network device', 'switch', 'router'];
  if (rackRequiredCategories.includes(data.category.toLowerCase())) {
    return !!data.rackId;
  }
  return true;
}, {
  message: "Rack location is required for server and network hardware",
  path: ["rackId"],
});

// Add this line to export the type for use in your forms
export type AssetFormValues = z.infer<typeof assetSchema>;
