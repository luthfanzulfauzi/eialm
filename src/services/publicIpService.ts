import { prisma } from "@/lib/prisma";
import {
  cidrToIPv4Range,
  compareIPv4Addresses,
  formatBigIntToIPv4,
  isPrivateIPv4,
  parseIPv4ToBigInt,
} from "@/lib/ip";
import { IPAssignmentTargetType, IPStatus } from "@prisma/client";

const MAX_GENERATED_IPS = BigInt(4096);

function toCidr(network: string, prefix: number) {
  return `${network}/${prefix}`;
}

function buildRangePayload(input: { network: string; prefix: number }) {
  const prefix = input.prefix;
  if (parseIPv4ToBigInt(input.network) === null) {
    throw new Error("Invalid network address");
  }

  const range = cidrToIPv4Range(input.network, prefix);
  if (!range) {
    throw new Error("Invalid network/prefix");
  }
  if (range.size > MAX_GENERATED_IPS) {
    throw new Error("Range too large");
  }

  return {
    prefix,
    range,
    cidr: toCidr(input.network, prefix),
    startAddress: formatBigIntToIPv4(range.start),
    endAddress: formatBigIntToIPv4(range.end),
    size: Number(range.size),
  };
}

async function buildPublicAssignmentPayload(input: {
  status: IPStatus;
  assetId?: string | null;
  assignmentTargetType?: IPAssignmentTargetType | null;
  assignmentTargetLabel?: string | null;
}) {
  const assetId =
    typeof input.assetId === "string" && input.assetId.trim().length > 0 ? input.assetId : null;
  const targetType = input.assignmentTargetType ?? null;
  const targetLabel =
    typeof input.assignmentTargetLabel === "string" && input.assignmentTargetLabel.trim().length > 0
      ? input.assignmentTargetLabel.trim()
      : null;

  if (input.status === IPStatus.AVAILABLE) {
    return {
      status: IPStatus.AVAILABLE,
      assetId: null,
      assignmentTargetType: null,
      assignmentTargetLabel: null,
    };
  }

  if ((input.status === IPStatus.ASSIGNED || input.status === IPStatus.RESERVED) && !targetType) {
    const err: any = new Error("Target required");
    err.code = "TARGET_REQUIRED";
    throw err;
  }

  if (!targetType && !targetLabel && !assetId) {
    return {
      status: input.status,
      assetId: null,
      assignmentTargetType: null,
      assignmentTargetLabel: null,
    };
  }

  if (targetType === IPAssignmentTargetType.HARDWARE) {
    if (!assetId) {
      const err: any = new Error("Asset required");
      err.code = "ASSET_REQUIRED";
      throw err;
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, name: true, serialNumber: true },
    });
    if (!asset) {
      const err: any = new Error("Asset not found");
      err.code = "ASSET_NOT_FOUND";
      throw err;
    }

    return {
      status: input.status,
      assetId: asset.id,
      assignmentTargetType: IPAssignmentTargetType.HARDWARE,
      assignmentTargetLabel: `${asset.name} (${asset.serialNumber})`,
    };
  }

  if (!targetLabel && (input.status === IPStatus.ASSIGNED || input.status === IPStatus.RESERVED)) {
    const err: any = new Error("Target detail required");
    err.code = "TARGET_LABEL_REQUIRED";
    throw err;
  }

  return {
    status: input.status,
    assetId: null,
    assignmentTargetType: targetType,
    assignmentTargetLabel: targetLabel,
  };
}

export const PublicIpService = {
  async getInventory() {
    const [items, ranges, assets] = await Promise.all([
      prisma.iPAddress.findMany({
        where: { isPublic: true },
        include: {
          asset: {
            select: { id: true, name: true, serialNumber: true, category: true },
          },
        },
      }),
      this.listRanges(),
      prisma.asset.findMany({
        select: {
          id: true,
          name: true,
          serialNumber: true,
          category: true,
        },
        orderBy: [{ name: "asc" }, { serialNumber: "asc" }],
      }),
    ]);

    const sortedItems = [...items].sort((a, b) => compareIPv4Addresses(a.address, b.address));
    const summary = {
      total: sortedItems.length,
      available: 0,
      reserved: 0,
      assigned: 0,
      blocked: 0,
      assignedAssets: 0,
      unassigned: 0,
      rangeCount: ranges.length,
    };

    const subnetMap = new Map<
      string,
      {
        cidr: string;
        counts: Record<IPStatus, number>;
        assignedAssets: number;
      }
    >();

    for (const ip of sortedItems) {
      if (ip.status === IPStatus.AVAILABLE) summary.available += 1;
      if (ip.status === IPStatus.RESERVED) summary.reserved += 1;
      if (ip.status === IPStatus.ASSIGNED) summary.assigned += 1;
      if (ip.status === IPStatus.BLOCKED) summary.blocked += 1;
      if (ip.status === IPStatus.ASSIGNED && (ip.assetId || ip.assignmentTargetType)) summary.assignedAssets += 1;
      else summary.unassigned += 1;

      const parts = ip.address.split(".");
      const subnetKey = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      const existing = subnetMap.get(subnetKey) ?? {
        cidr: subnetKey,
        counts: {
          AVAILABLE: 0,
          RESERVED: 0,
          ASSIGNED: 0,
          BLOCKED: 0,
        },
        assignedAssets: 0,
      };

      existing.counts[ip.status] += 1;
      if (ip.status === IPStatus.ASSIGNED && (ip.assetId || ip.assignmentTargetType)) {
        existing.assignedAssets += 1;
      }
      subnetMap.set(subnetKey, existing);
    }

    const subnets = Array.from(subnetMap.values()).sort((a, b) =>
      a.cidr.localeCompare(b.cidr, undefined, { numeric: true })
    );

    return {
      items: sortedItems,
      summary,
      subnets,
      ranges,
      assignableAssets: assets,
    };
  },

  async listRanges() {
    const ranges = await prisma.publicIPRange.findMany({
      orderBy: [{ startInt: "asc" }, { prefix: "asc" }],
    });

    const rangeIds = ranges.map((r) => r.id);
    const grouped = rangeIds.length
      ? await prisma.iPAddress.groupBy({
          by: ["publicRangeId", "status"],
          where: { publicRangeId: { in: rangeIds }, isPublic: true },
          _count: { _all: true },
        })
      : [];

    const countsByRange: Record<
      string,
      Record<IPStatus, number>
    > = {};

    for (const r of ranges) {
      countsByRange[r.id] = {
        AVAILABLE: 0,
        RESERVED: 0,
        ASSIGNED: 0,
        BLOCKED: 0,
      };
    }

    for (const row of grouped) {
      if (!row.publicRangeId) continue;
      countsByRange[row.publicRangeId][row.status] = row._count._all;
    }

    return ranges.map((r) => ({
      id: r.id,
      name: r.name,
      network: r.network,
      prefix: r.prefix,
      cidr: r.cidr,
      startAddress: r.startAddress,
      endAddress: r.endAddress,
      size: r.size,
      counts: countsByRange[r.id],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async createRange(input: { name?: string | null; network: string; prefix: number }) {
    const { prefix, range, cidr, startAddress, endAddress, size } = buildRangePayload(input);
    const name = typeof input.name === "string" ? input.name.trim() : "";

    const existingOverlap = await prisma.publicIPRange.findFirst({
      where: {
        AND: [{ startInt: { lte: range.end } }, { endInt: { gte: range.start } }],
      },
      select: { id: true, cidr: true },
    });
    if (existingOverlap) {
      const err: any = new Error("Overlapping range");
      err.code = "OVERLAP";
      err.overlap = existingOverlap;
      throw err;
    }

    const created = await prisma.$transaction(async (tx) => {
      const rangeRow = await tx.publicIPRange.create({
        data: {
          name,
          network: input.network,
          prefix,
          cidr,
          startInt: range.start,
          endInt: range.end,
          startAddress,
          endAddress,
          size,
        },
      });

      const addresses: { address: string; isPublic: boolean; status: IPStatus; publicRangeId: string }[] =
        [];
      for (let v = range.start; v <= range.end; v++) {
        addresses.push({
          address: formatBigIntToIPv4(v),
          isPublic: true,
          status: IPStatus.AVAILABLE,
          publicRangeId: rangeRow.id,
        });
      }

      const CHUNK = 1000;
      for (let i = 0; i < addresses.length; i += CHUNK) {
        await tx.iPAddress.createMany({
          data: addresses.slice(i, i + CHUNK),
          skipDuplicates: true,
        });
      }

      return rangeRow;
    });

    return created;
  },

  async updateRange(rangeId: string, input: { name?: string | null; network: string; prefix: number }) {
    const existing = await prisma.publicIPRange.findUnique({
      where: { id: rangeId },
      select: { id: true },
    });
    if (!existing) {
      const err: any = new Error("Not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    const activeIp = await prisma.iPAddress.findFirst({
      where: {
        publicRangeId: rangeId,
        OR: [
          { status: { not: IPStatus.AVAILABLE } },
          { assignmentTargetType: { not: null } },
          { assetId: { not: null } },
        ],
      },
      select: { id: true, address: true, status: true },
    });
    if (activeIp) {
      const err: any = new Error("Range in use");
      err.code = "RANGE_IN_USE";
      err.ip = activeIp;
      throw err;
    }

    const { prefix, range, cidr, startAddress, endAddress, size } = buildRangePayload(input);
    const name = typeof input.name === "string" ? input.name.trim() : "";

    const overlap = await prisma.publicIPRange.findFirst({
      where: {
        id: { not: rangeId },
        AND: [{ startInt: { lte: range.end } }, { endInt: { gte: range.start } }],
      },
      select: { id: true, cidr: true },
    });
    if (overlap) {
      const err: any = new Error("Overlapping range");
      err.code = "OVERLAP";
      err.overlap = overlap;
      throw err;
    }

    return await prisma.$transaction(async (tx) => {
      await tx.iPAddress.deleteMany({ where: { publicRangeId: rangeId } });

      const updated = await tx.publicIPRange.update({
        where: { id: rangeId },
        data: {
          name,
          network: input.network,
          prefix,
          cidr,
          startInt: range.start,
          endInt: range.end,
          startAddress,
          endAddress,
          size,
        },
      });

      const addresses: { address: string; isPublic: boolean; status: IPStatus; publicRangeId: string }[] = [];
      for (let value = range.start; value <= range.end; value++) {
        addresses.push({
          address: formatBigIntToIPv4(value),
          isPublic: true,
          status: IPStatus.AVAILABLE,
          publicRangeId: rangeId,
        });
      }

      const CHUNK = 1000;
      for (let i = 0; i < addresses.length; i += CHUNK) {
        await tx.iPAddress.createMany({ data: addresses.slice(i, i + CHUNK), skipDuplicates: true });
      }

      return updated;
    });
  },

  async deleteRange(rangeId: string) {
    const existing = await prisma.publicIPRange.findUnique({
      where: { id: rangeId },
      select: { id: true },
    });
    if (!existing) {
      const err: any = new Error("Not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    const activeIp = await prisma.iPAddress.findFirst({
      where: {
        publicRangeId: rangeId,
        OR: [
          { status: { not: IPStatus.AVAILABLE } },
          { assignmentTargetType: { not: null } },
          { assetId: { not: null } },
        ],
      },
      select: { address: true, status: true },
    });
    if (activeIp) {
      const err: any = new Error("Range in use");
      err.code = "RANGE_IN_USE";
      err.ip = activeIp;
      throw err;
    }

    return await prisma.$transaction(async (tx) => {
      await tx.iPAddress.deleteMany({ where: { publicRangeId: rangeId } });
      await tx.publicIPRange.delete({ where: { id: rangeId } });
      return { ok: true };
    });
  },

  async listRangeIps(rangeId: string) {
    const ips = await prisma.iPAddress.findMany({
      where: { isPublic: true, publicRangeId: rangeId },
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true, category: true },
        },
      },
    });

    return ips.sort((a, b) => compareIPv4Addresses(a.address, b.address));
  },

  async updateIpStatus(
    ipId: string,
    input: {
      status: IPStatus;
      assetId?: string | null;
      assignmentTargetType?: IPAssignmentTargetType | null;
      assignmentTargetLabel?: string | null;
    }
  ) {
    const ip = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, isPublic: true },
    });
    if (!ip) {
      const err: any = new Error("Not found");
      err.code = "NOT_FOUND";
      throw err;
    }
    if (!ip.isPublic) {
      const err: any = new Error("Not public");
      err.code = "NOT_PUBLIC";
      throw err;
    }
    const payload = await buildPublicAssignmentPayload(input);

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: payload,
    });
  },

  async createIp(input: {
    address: string;
    status: IPStatus;
    assetId?: string | null;
    assignmentTargetType?: IPAssignmentTargetType | null;
    assignmentTargetLabel?: string | null;
  }) {
    const parsed = parseIPv4ToBigInt(input.address);
    if (parsed === null || isPrivateIPv4(parsed)) {
      const err: any = new Error("Invalid public IP");
      err.code = "INVALID_PUBLIC_IP";
      throw err;
    }

    const existing = await prisma.iPAddress.findUnique({
      where: { address: input.address },
      select: { id: true },
    });
    if (existing) {
      const err: any = new Error("Duplicate IP");
      err.code = "DUPLICATE_IP";
      err.addresses = [input.address];
      throw err;
    }

    const payload = await buildPublicAssignmentPayload(input);
    return await prisma.iPAddress.create({
      data: {
        address: input.address,
        isPublic: true,
        ...payload,
      },
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true, category: true },
        },
      },
    });
  },

  async deleteIp(ipId: string) {
    const ip = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: {
        id: true,
        isPublic: true,
        status: true,
        assetId: true,
        assignmentTargetType: true,
        publicRangeId: true,
      },
    });
    if (!ip) {
      const err: any = new Error("Not found");
      err.code = "NOT_FOUND";
      throw err;
    }
    if (!ip.isPublic) {
      const err: any = new Error("Not public");
      err.code = "NOT_PUBLIC";
      throw err;
    }
    if (ip.publicRangeId) {
      const err: any = new Error("Managed by range");
      err.code = "RANGE_MANAGED_IP";
      throw err;
    }
    if (ip.status === IPStatus.ASSIGNED) {
      const err: any = new Error("Assigned IP cannot be deleted");
      err.code = "ASSIGNED";
      throw err;
    }

    return await prisma.iPAddress.delete({ where: { id: ipId } });
  },
};
