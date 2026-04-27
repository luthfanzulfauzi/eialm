import { IPAssignmentTargetType, IPStatus, type PrismaClient } from "@prisma/client";
import { parseCsv, toCsv } from "@/lib/csv";
import { compareIPv4Addresses } from "@/lib/ip";
import { PublicIpService } from "@/services/publicIpService";
import { NetworkService } from "@/services/networkService";

export type NetworkTransferType = "public" | "private";

const NETWORK_TRANSFER_HEADERS = [
  "address",
  "status",
  "assignmentTargetType",
  "assignmentTargetLabel",
  "assetSerialNumber",
  "rangeCidr",
] as const;

type ImportErrorRow = {
  row: number;
  error: string;
};

const normalize = (value: string | undefined) => (value ?? "").trim();
const lower = (value: string | undefined) => normalize(value).toLowerCase();
const upper = (value: string | undefined) => normalize(value).toUpperCase();

const asStatus = (value: string | undefined): IPStatus | null => {
  const normalized = upper(value);
  if (normalized === "AVAILABLE" || normalized === "RESERVED" || normalized === "ASSIGNED" || normalized === "BLOCKED") {
    return normalized as IPStatus;
  }
  return null;
};

const asTargetType = (value: string | undefined): IPAssignmentTargetType | null => {
  const normalized = upper(value);
  if (normalized === "HARDWARE" || normalized === "VM" || normalized === "OTHER") {
    return normalized as IPAssignmentTargetType;
  }
  return null;
};

const parseRangeCidr = (value: string) => {
  const [network, rawPrefix] = value.split("/");
  if (!network || !rawPrefix) return null;
  const prefix = Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  return {
    network: network.trim(),
    prefix,
    cidr: `${network.trim()}/${prefix}`,
  };
};

async function ensureRanges(prisma: PrismaClient, type: NetworkTransferType, cidrs: string[]) {
  const uniqueCidrs = Array.from(new Set(cidrs.map((value) => normalize(value)).filter(Boolean)));

  for (const cidr of uniqueCidrs) {
    const parsed = parseRangeCidr(cidr);
    if (!parsed) {
      throw new Error(`Invalid range CIDR: ${cidr}`);
    }

    if (type === "public") {
      const existing = await prisma.publicIPRange.findUnique({
        where: { cidr: parsed.cidr },
        select: { id: true },
      });
      if (!existing) {
        await PublicIpService.createRange({ network: parsed.network, prefix: parsed.prefix });
      }
      continue;
    }

    const existing = await prisma.privateIPRange.findUnique({
      where: { cidr: parsed.cidr },
      select: { id: true },
    });
    if (!existing) {
      await NetworkService.createPrivateIPs({
        mode: "cidr",
        address: parsed.network,
        prefix: parsed.prefix,
        status: IPStatus.AVAILABLE,
      });
    }
  }
}

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

export async function exportNetworkCsv(prisma: PrismaClient, type: NetworkTransferType) {
  const items = await prisma.iPAddress.findMany({
    where: { isPublic: type === "public" },
    include: {
      asset: {
        select: { serialNumber: true },
      },
      publicRange: {
        select: { cidr: true },
      },
      privateRange: {
        select: { cidr: true },
      },
    },
  });

  const rows = [
    NETWORK_TRANSFER_HEADERS as unknown as string[],
    ...items
      .sort((a, b) => compareIPv4Addresses(a.address, b.address))
      .map((item) => [
        item.address,
        item.status,
        item.assignmentTargetType ?? "",
        item.assignmentTargetLabel ?? "",
        item.asset?.serialNumber ?? "",
        type === "public" ? item.publicRange?.cidr ?? "" : item.privateRange?.cidr ?? "",
      ]),
  ];

  return toCsv(rows);
}

export async function importNetworkCsv(
  prisma: PrismaClient,
  type: NetworkTransferType,
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
  let created = 0;
  let updated = 0;

  try {
    await ensureRanges(
      prisma,
      type,
      rows.map((row) => get(row, "rangeCidr"))
    );
  } catch (error: any) {
    throw new Error(error?.message || "Failed to prepare managed ranges for import");
  }

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];

    const address = normalize(get(row, "address"));
    const status = asStatus(get(row, "status")) ?? IPStatus.AVAILABLE;
    const assetSerialNumber = normalize(get(row, "assetSerialNumber"));
    const assignmentTargetLabel = normalize(get(row, "assignmentTargetLabel")) || null;
    const explicitTargetType = asTargetType(get(row, "assignmentTargetType"));
    const assignmentTargetType =
      assetSerialNumber.length > 0 ? IPAssignmentTargetType.HARDWARE : explicitTargetType;

    if (!address) {
      errors.push({ row: rowNumber, error: "Missing required field: address" });
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

      const existing = await prisma.iPAddress.findUnique({
        where: { address },
        select: { id: true, isPublic: true },
      });

      if (existing && existing.isPublic !== (type === "public")) {
        errors.push({
          row: rowNumber,
          error: `Address ${address} already exists in the ${existing.isPublic ? "public" : "private"} inventory`,
        });
        continue;
      }

      if (existing) {
        if (type === "public") {
          await PublicIpService.updateIpStatus(existing.id, {
            status,
            assetId,
            assignmentTargetType,
            assignmentTargetLabel,
          });
        } else {
          await NetworkService.updatePrivateIpStatus(existing.id, {
            status,
            assetId,
            assignmentTargetType,
            assignmentTargetLabel,
          });
        }
        updated += 1;
        continue;
      }

      if (type === "public") {
        await PublicIpService.createIp({
          address,
          status,
          assetId,
          assignmentTargetType,
          assignmentTargetLabel,
        });
      } else {
        const result = await NetworkService.createPrivateIPs({
          mode: "single",
          address,
          status,
          assetId,
          assignmentTargetType,
          assignmentTargetLabel,
        });
        created += result.created.length;
        continue;
      }

      created += 1;
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
