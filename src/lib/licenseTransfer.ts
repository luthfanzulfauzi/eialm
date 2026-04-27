import { type PrismaClient } from "@prisma/client";
import { parseCsv, toCsv } from "@/lib/csv";
import { LicenseService } from "@/services/licenseService";

const LICENSE_TRANSFER_HEADERS = [
  "id",
  "name",
  "key",
  "licenseFile",
  "poSiSoNumber",
  "expiryDate",
  "assetSerialNumber",
  "productCodes",
] as const;

type ImportErrorRow = {
  row: number;
  error: string;
};

const normalize = (value: string | undefined) => (value ?? "").trim();
const lower = (value: string | undefined) => normalize(value).toLowerCase();

const parseDateValue = (value: string | undefined) => {
  const normalized = normalize(value);
  if (!normalized) return undefined;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const parseProductCodes = (value: string | undefined) =>
  Array.from(
    new Set(
      normalize(value)
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

async function resolveAssetId(prisma: PrismaClient, serialNumber: string, cache: Map<string, string | null>) {
  const normalized = normalize(serialNumber);
  if (!normalized) return null;
  if (cache.has(normalized)) {
    return cache.get(normalized) ?? null;
  }

  const asset = await prisma.asset.findUnique({
    where: { serialNumber: normalized },
    select: { id: true },
  });
  cache.set(normalized, asset?.id ?? null);
  return asset?.id ?? null;
}

async function resolveProductIds(prisma: PrismaClient, codes: string[], cache: Map<string, string | null>) {
  const productIds: string[] = [];

  for (const code of codes) {
    if (cache.has(code)) {
      const cached = cache.get(code);
      if (!cached) {
        throw new Error(`Product not found for code "${code}"`);
      }
      productIds.push(cached);
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { code },
      select: { id: true },
    });

    cache.set(code, product?.id ?? null);
    if (!product) {
      throw new Error(`Product not found for code "${code}"`);
    }
    productIds.push(product.id);
  }

  return productIds;
}

export async function exportLicenseCsv(prisma: PrismaClient) {
  const licenses = await prisma.license.findMany({
    include: {
      asset: {
        select: { serialNumber: true },
      },
      products: {
        select: { code: true },
        orderBy: { code: "asc" },
      },
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });

  return toCsv([
    LICENSE_TRANSFER_HEADERS as unknown as string[],
    ...licenses.map((license) => [
      license.id,
      license.name,
      license.key ?? "",
      license.licenseFile ?? "",
      license.poSiSoNumber ?? "",
      license.expiryDate ? license.expiryDate.toISOString().slice(0, 10) : "",
      license.asset?.serialNumber ?? "",
      license.products.map((product) => product.code).join("|"),
    ]),
  ]);
}

export async function importLicenseCsv(
  prisma: PrismaClient,
  content: string
) {
  const raw = parseCsv(content).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (raw.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const header = raw[0].map((value) => lower(value));
  const indexOf = (name: string) => header.indexOf(lower(name));
  const get = (row: string[], name: string) => {
    const idx = indexOf(name);
    return idx >= 0 ? row[idx] : "";
  };

  const rows = raw.slice(1);
  const errors: ImportErrorRow[] = [];
  const assetCache = new Map<string, string | null>();
  const productCache = new Map<string, string | null>();
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];

    const id = normalize(get(row, "id"));
    const name = normalize(get(row, "name"));
    const key = normalize(get(row, "key"));
    const licenseFile = normalize(get(row, "licenseFile"));
    const poSiSoNumber = normalize(get(row, "poSiSoNumber"));
    const expiryDate = parseDateValue(get(row, "expiryDate"));
    const assetSerialNumber = normalize(get(row, "assetSerialNumber"));
    const productCodes = parseProductCodes(get(row, "productCodes"));

    if (!name) {
      errors.push({ row: rowNumber, error: "Missing required field: name" });
      continue;
    }

    if (expiryDate === null) {
      errors.push({ row: rowNumber, error: "Invalid expiryDate. Use YYYY-MM-DD format." });
      continue;
    }

    try {
      const assetId = assetSerialNumber
        ? await resolveAssetId(prisma, assetSerialNumber, assetCache)
        : null;

      if (assetSerialNumber && !assetId) {
        errors.push({ row: rowNumber, error: `Asset not found for serial number "${assetSerialNumber}"` });
        continue;
      }

      const productIds = await resolveProductIds(prisma, productCodes, productCache);

      let existingId: string | null = null;
      if (id) {
        const existingById = await prisma.license.findUnique({
          where: { id },
          select: { id: true },
        });
        existingId = existingById?.id ?? null;
      }

      if (!existingId && key) {
        const existingByKey = await prisma.license.findUnique({
          where: { key },
          select: { id: true },
        });
        existingId = existingByKey?.id ?? null;
      }

      const payload = {
        name,
        key: key || undefined,
        licenseFile: licenseFile || undefined,
        poSiSoNumber: poSiSoNumber || undefined,
        expiryDate,
        assetId: assetId || undefined,
        productIds,
      };

      if (existingId) {
        await LicenseService.updateLicense(existingId, payload);
        updated += 1;
      } else {
        await LicenseService.createLicense(payload);
        created += 1;
      }
    } catch (error: any) {
      errors.push({ row: rowNumber, error: error?.message || "Failed to import row" });
    }
  }

  return {
    created,
    updated,
    failed: errors.length,
    errors,
  };
}
