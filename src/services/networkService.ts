import { prisma } from "@/lib/prisma";
import {
  cidrToIPv4Range,
  compareIPv4Addresses,
  expandIPv4CidrHosts,
  formatBigIntToIPv4,
  getPrivateRangeLabel,
  isPrivateIPv4,
  parseIPv4ToBigInt,
} from "@/lib/ip";
import { IPAssignmentTargetType, IPStatus } from "@prisma/client";

const MAX_PRIVATE_CIDR_HOSTS = 1024;

type CreatePrivateIpInput = {
  mode: "single" | "cidr";
  name?: string | null;
  address: string;
  prefix?: number;
  assetId?: string | null;
  assignmentTargetType?: IPAssignmentTargetType | null;
  assignmentTargetLabel?: string | null;
  status?: IPStatus;
};

type IpStateInput = {
  status: IPStatus;
  assetId?: string | null;
  assignmentTargetType?: IPAssignmentTargetType | null;
  assignmentTargetLabel?: string | null;
};

const EMPTY_COUNTS = {
  AVAILABLE: 0,
  RESERVED: 0,
  ASSIGNED: 0,
  BLOCKED: 0,
};

function toSubnetKey(address: string) {
  const [a, b, c] = address.split(".");
  return `${a}.${b}.${c}.0/24`;
}

function toCidr(network: string, prefix: number) {
  return `${network}/${prefix}`;
}

function buildPrivateRangePayload(input: { network: string; prefix: number }) {
  const parsed = parseIPv4ToBigInt(input.network);
  if (parsed === null || !isPrivateIPv4(parsed)) {
    const error: any = new Error("Invalid private network");
    error.code = "INVALID_PRIVATE_RANGE";
    throw error;
  }

  const addresses = expandIPv4CidrHosts(input.network, input.prefix, MAX_PRIVATE_CIDR_HOSTS);
  const baseRange = cidrToIPv4Range(input.network, input.prefix);
  if (!addresses || !baseRange) {
    const error: any = new Error("Invalid private range");
    error.code = "INVALID_PRIVATE_RANGE";
    throw error;
  }

  return {
    prefix: input.prefix,
    cidr: toCidr(input.network, input.prefix),
    startInt: baseRange.start,
    endInt: baseRange.end,
    startAddress: formatBigIntToIPv4(baseRange.start),
    endAddress: formatBigIntToIPv4(baseRange.end),
    size: addresses.length,
    addresses,
  };
}

async function ensureAssetExists(assetId?: string | null) {
  if (!assetId) return null;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true },
  });

  if (!asset) {
    const error: any = new Error("Asset not found");
    error.code = "ASSET_NOT_FOUND";
    throw error;
  }

  return asset.id;
}

async function buildAssignmentPayload(input: IpStateInput) {
  const assetId = await ensureAssetExists(input.assetId);
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

  const needsMandatoryTarget = input.status === IPStatus.ASSIGNED || input.status === IPStatus.RESERVED;
  const hasAnyTarget = targetType !== null || targetLabel !== null || assetId !== null;

  if (needsMandatoryTarget && targetType === null) {
    const error: any = new Error("Assignment target type is required");
    error.code = "TARGET_REQUIRED";
    throw error;
  }

  if (!needsMandatoryTarget && !hasAnyTarget) {
    return {
      status: input.status,
      assetId: null,
      assignmentTargetType: null,
      assignmentTargetLabel: null,
    };
  }

  if (targetType === IPAssignmentTargetType.HARDWARE) {
    if (!assetId) {
      const error: any = new Error("Hardware assignment requires an asset");
      error.code = "ASSET_REQUIRED";
      throw error;
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { name: true, serialNumber: true },
    });

    return {
      status: input.status,
      assetId,
      assignmentTargetType: IPAssignmentTargetType.HARDWARE,
      assignmentTargetLabel: asset ? `${asset.name} (${asset.serialNumber})` : null,
    };
  }

  if (!targetType) {
    const error: any = new Error("Assignment target type is required");
    error.code = "TARGET_REQUIRED";
    throw error;
  }

  if (!targetLabel && needsMandatoryTarget) {
    const error: any = new Error("Assignment target detail is required");
    error.code = "TARGET_LABEL_REQUIRED";
    throw error;
  }

  return {
    status: input.status,
    assetId: null,
    assignmentTargetType: targetType,
    assignmentTargetLabel: targetLabel,
  };
}

export const NetworkService = {
  async listPrivateRanges() {
    const ranges = await prisma.privateIPRange.findMany({
      orderBy: [{ startInt: "asc" }, { prefix: "asc" }],
    });

    const rangeIds = ranges.map((range) => range.id);
    const grouped = rangeIds.length
      ? await prisma.iPAddress.groupBy({
          by: ["privateRangeId", "status"],
          where: { privateRangeId: { in: rangeIds }, isPublic: false },
          _count: { _all: true },
        })
      : [];

    const countsByRange: Record<string, Record<IPStatus, number>> = {};
    for (const range of ranges) {
      countsByRange[range.id] = { ...EMPTY_COUNTS };
    }

    for (const row of grouped) {
      if (!row.privateRangeId) continue;
      countsByRange[row.privateRangeId][row.status] = row._count._all;
    }

    return ranges.map((range) => ({
      id: range.id,
      name: range.name,
      network: range.network,
      prefix: range.prefix,
      cidr: range.cidr,
      startAddress: range.startAddress,
      endAddress: range.endAddress,
      size: range.size,
      counts: countsByRange[range.id],
      createdAt: range.createdAt,
      updatedAt: range.updatedAt,
    }));
  },

  async getIPInventory(type: "public" | "private") {
    const isPublic = type === "public";
    const items = await prisma.iPAddress.findMany({
      where: { isPublic },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            serialNumber: true,
            category: true,
          },
        },
      },
    });

    return items.sort((a, b) => compareIPv4Addresses(a.address, b.address));
  },

  async getPrivateInventory() {
    const [items, assets] = await Promise.all([
      prisma.iPAddress.findMany({
        where: { isPublic: false },
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              serialNumber: true,
              category: true,
            },
          },
        },
      }),
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

    const summary = {
      total: items.length,
      available: 0,
      reserved: 0,
      assigned: 0,
      blocked: 0,
      assignedAssets: 0,
      unassigned: 0,
      subnetCount: 0,
    };

    const subnetMap = new Map<
      string,
      {
        cidr: string;
        counts: typeof EMPTY_COUNTS;
        assignedAssets: number;
      }
    >();

    const sortedItems = [...items].sort((a, b) => compareIPv4Addresses(a.address, b.address));

    for (const ip of sortedItems) {
      const normalizedStatus = ip.status;
      if (normalizedStatus === IPStatus.AVAILABLE) summary.available += 1;
      if (normalizedStatus === IPStatus.RESERVED) summary.reserved += 1;
      if (normalizedStatus === IPStatus.ASSIGNED) summary.assigned += 1;
      if (normalizedStatus === IPStatus.BLOCKED) summary.blocked += 1;
      if (ip.status === IPStatus.ASSIGNED && (ip.assetId || ip.assignmentTargetType)) summary.assignedAssets += 1;
      else summary.unassigned += 1;

      const subnetKey = toSubnetKey(ip.address);
      const existing = subnetMap.get(subnetKey) ?? {
        cidr: subnetKey,
        counts: { ...EMPTY_COUNTS },
        assignedAssets: 0,
      };
      existing.counts[normalizedStatus] += 1;
      if (ip.status === IPStatus.ASSIGNED && (ip.assetId || ip.assignmentTargetType)) existing.assignedAssets += 1;
      subnetMap.set(subnetKey, existing);
    }

    const subnets = Array.from(subnetMap.values()).sort((a, b) =>
      a.cidr.localeCompare(b.cidr, undefined, { numeric: true })
    );

    summary.subnetCount = subnets.length;

    return {
      items: sortedItems,
      summary,
      subnets,
      ranges: await this.listPrivateRanges(),
      privateRanges: Array.from(
        new Set(sortedItems.map((ip) => getPrivateRangeLabel(ip.address)).filter(Boolean))
      ),
      assignableAssets: assets,
    };
  },

  async createIP(data: { address: string; isPublic: boolean; assetId?: string | null }) {
    const assetId = await ensureAssetExists(data.assetId);

    if (!data.isPublic && !isPrivateIPv4(data.address)) {
      const error: any = new Error("Private IP must be in RFC1918 space");
      error.code = "INVALID_PRIVATE_IP";
      throw error;
    }

    const assignment =
      assetId !== null
        ? await buildAssignmentPayload({
            status: IPStatus.ASSIGNED,
            assetId,
            assignmentTargetType: IPAssignmentTargetType.HARDWARE,
          })
        : {
            status: IPStatus.AVAILABLE,
            assetId: null,
            assignmentTargetType: null,
            assignmentTargetLabel: null,
          };

    return await prisma.iPAddress.create({
      data: {
        address: data.address,
        isPublic: data.isPublic,
        ...assignment,
      },
    });
  },

  async createPrivateIPs(input: CreatePrivateIpInput) {
    const addresses =
      input.mode === "cidr"
        ? expandIPv4CidrHosts(input.address, input.prefix ?? -1, MAX_PRIVATE_CIDR_HOSTS)
        : isPrivateIPv4(input.address)
          ? [input.address]
          : null;

    if (!addresses || addresses.length === 0) {
      const error: any = new Error("Invalid private range");
      error.code = "INVALID_PRIVATE_RANGE";
      throw error;
    }

    const uniqueAddresses = Array.from(new Set(addresses));
    const duplicates = await prisma.iPAddress.findMany({
      where: { address: { in: uniqueAddresses } },
      select: { address: true },
    });

    if (duplicates.length) {
      const error: any = new Error("Duplicate IPs");
      error.code = "DUPLICATE_IP";
      error.addresses = duplicates.map((item) => item.address);
      throw error;
    }

    const assignment = await buildAssignmentPayload({
      status: input.status ?? IPStatus.AVAILABLE,
      assetId: input.assetId ?? null,
      assignmentTargetType: input.assignmentTargetType ?? null,
      assignmentTargetLabel: input.assignmentTargetLabel ?? null,
    });

    if (assignment.status === IPStatus.ASSIGNED && uniqueAddresses.length !== 1) {
      const error: any = new Error("Bulk assignment is not supported");
      error.code = "MULTI_ASSIGNMENT_NOT_SUPPORTED";
      throw error;
    }

    if (input.mode === "single") {
      return {
        created: [
          await prisma.iPAddress.create({
            data: {
              address: uniqueAddresses[0],
              isPublic: false,
              ...assignment,
            },
          }),
        ],
      };
    }

    const rangePayload = buildPrivateRangePayload({
      network: input.address,
      prefix: input.prefix ?? -1,
    });

    const overlap = await prisma.privateIPRange.findFirst({
      where: {
        AND: [{ startInt: { lte: rangePayload.endInt } }, { endInt: { gte: rangePayload.startInt } }],
      },
      select: { id: true, cidr: true },
    });
    if (overlap) {
      const error: any = new Error("Overlapping range");
      error.code = "OVERLAP";
      error.overlap = overlap;
      throw error;
    }

    const created = await prisma.$transaction(async (tx) => {
      const rangeRow = await tx.privateIPRange.create({
        data: {
          name: typeof input.name === "string" ? input.name.trim() : "",
          network: input.address,
          prefix: rangePayload.prefix,
          cidr: rangePayload.cidr,
          startInt: rangePayload.startInt,
          endInt: rangePayload.endInt,
          startAddress: rangePayload.startAddress,
          endAddress: rangePayload.endAddress,
          size: rangePayload.size,
        },
      });

      await tx.iPAddress.createMany({
        data: uniqueAddresses.map((address) => ({
          address,
          isPublic: false,
          privateRangeId: rangeRow.id,
          ...assignment,
        })),
      });

      return await tx.iPAddress.findMany({
        where: { privateRangeId: rangeRow.id },
      });
    });

    return { created: created.sort((a, b) => compareIPv4Addresses(a.address, b.address)) };
  },

  async updatePrivateRange(rangeId: string, input: { name?: string | null; network: string; prefix: number }) {
    const existing = await prisma.privateIPRange.findUnique({
      where: { id: rangeId },
      select: { id: true },
    });
    if (!existing) {
      const error: any = new Error("Not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    const activeIp = await prisma.iPAddress.findFirst({
      where: {
        privateRangeId: rangeId,
        OR: [
          { status: { not: IPStatus.AVAILABLE } },
          { assignmentTargetType: { not: null } },
          { assetId: { not: null } },
        ],
      },
      select: { address: true, status: true },
    });
    if (activeIp) {
      const error: any = new Error("Range in use");
      error.code = "RANGE_IN_USE";
      error.ip = activeIp;
      throw error;
    }

    const payload = buildPrivateRangePayload(input);
    const overlap = await prisma.privateIPRange.findFirst({
      where: {
        id: { not: rangeId },
        AND: [{ startInt: { lte: payload.endInt } }, { endInt: { gte: payload.startInt } }],
      },
      select: { id: true, cidr: true },
    });
    if (overlap) {
      const error: any = new Error("Overlapping range");
      error.code = "OVERLAP";
      error.overlap = overlap;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      await tx.iPAddress.deleteMany({ where: { privateRangeId: rangeId } });

      const updated = await tx.privateIPRange.update({
        where: { id: rangeId },
        data: {
          name: typeof input.name === "string" ? input.name.trim() : "",
          network: input.network,
          prefix: payload.prefix,
          cidr: payload.cidr,
          startInt: payload.startInt,
          endInt: payload.endInt,
          startAddress: payload.startAddress,
          endAddress: payload.endAddress,
          size: payload.size,
        },
      });

      await tx.iPAddress.createMany({
        data: payload.addresses.map((address) => ({
          address,
          isPublic: false,
          status: IPStatus.AVAILABLE,
          privateRangeId: rangeId,
        })),
      });

      return updated;
    });
  },

  async deletePrivateRange(rangeId: string) {
    const existing = await prisma.privateIPRange.findUnique({
      where: { id: rangeId },
      select: { id: true },
    });
    if (!existing) {
      const error: any = new Error("Not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    const activeIp = await prisma.iPAddress.findFirst({
      where: {
        privateRangeId: rangeId,
        OR: [
          { status: { not: IPStatus.AVAILABLE } },
          { assignmentTargetType: { not: null } },
          { assetId: { not: null } },
        ],
      },
      select: { address: true, status: true },
    });
    if (activeIp) {
      const error: any = new Error("Range in use");
      error.code = "RANGE_IN_USE";
      error.ip = activeIp;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      await tx.iPAddress.deleteMany({ where: { privateRangeId: rangeId } });
      await tx.privateIPRange.delete({ where: { id: rangeId } });
      return { ok: true };
    });
  },

  async updateIPAssignment(ipId: string, assetId: string | null) {
    const existing = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, status: true, assignmentTargetType: true },
    });
    if (!existing) {
      const error: any = new Error("IP not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    const nextStatus = existing.status === IPStatus.ASSIGNED ? IPStatus.AVAILABLE : existing.status;

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: {
        status: nextStatus,
        assetId: null,
        assignmentTargetType: null,
        assignmentTargetLabel: null,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            serialNumber: true,
            category: true,
          },
        },
      },
    });
  },

  async updatePrivateIpStatus(ipId: string, input: IpStateInput) {
    const ip = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, isPublic: true },
    });

    if (!ip) {
      const error: any = new Error("IP not found");
      error.code = "NOT_FOUND";
      throw error;
    }
    if (ip.isPublic) {
      const error: any = new Error("Public IP cannot be managed here");
      error.code = "NOT_PRIVATE";
      throw error;
    }
    const assignment = await buildAssignmentPayload(input);

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: assignment,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            serialNumber: true,
            category: true,
          },
        },
      },
    });
  },

  async deletePrivateIp(ipId: string) {
    const ip = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, isPublic: true, assetId: true, assignmentTargetType: true, status: true, privateRangeId: true },
    });

    if (!ip) {
      const error: any = new Error("IP not found");
      error.code = "NOT_FOUND";
      throw error;
    }
    if (ip.privateRangeId) {
      const error: any = new Error("Managed by range");
      error.code = "RANGE_MANAGED_IP";
      throw error;
    }
    if (ip.isPublic) {
      const error: any = new Error("Public IP cannot be deleted here");
      error.code = "NOT_PRIVATE";
      throw error;
    }
    if (ip.status === IPStatus.ASSIGNED) {
      const error: any = new Error("Assigned IP cannot be deleted");
      error.code = "ASSIGNED";
      throw error;
    }

    return await prisma.iPAddress.delete({ where: { id: ipId } });
  },

  async getPrivateRangePreview(address: string, prefix: number) {
    const parsed = parseIPv4ToBigInt(address);
    const hosts = expandIPv4CidrHosts(address, prefix, MAX_PRIVATE_CIDR_HOSTS);
    if (parsed === null || !hosts) return null;

    return {
      address,
      prefix,
      privateRange: getPrivateRangeLabel(parsed),
      generatedHosts: hosts.length,
      firstHost: hosts[0] ?? null,
      lastHost: hosts[hosts.length - 1] ?? null,
    };
  },
};
