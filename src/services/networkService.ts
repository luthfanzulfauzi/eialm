import { prisma } from "@/lib/prisma";
import {
  expandIPv4CidrHosts,
  getPrivateRangeLabel,
  isPrivateIPv4,
  parseIPv4ToBigInt,
} from "@/lib/ip";
import { IPStatus } from "@prisma/client";

const MAX_PRIVATE_CIDR_HOSTS = 1024;

type CreatePrivateIpInput = {
  mode: "single" | "cidr";
  address: string;
  prefix?: number;
  assetId?: string | null;
  status?: IPStatus;
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

export const NetworkService = {
  async getIPInventory(type: "public" | "private") {
    const isPublic = type === "public";
    return await prisma.iPAddress.findMany({
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
      orderBy: { address: "asc" },
    });
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
        orderBy: { address: "asc" },
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

    for (const ip of items) {
      const normalizedStatus =
        ip.assetId && ip.status !== IPStatus.ASSIGNED ? IPStatus.ASSIGNED : ip.status;

      if (normalizedStatus === IPStatus.AVAILABLE) summary.available += 1;
      if (normalizedStatus === IPStatus.RESERVED) summary.reserved += 1;
      if (normalizedStatus === IPStatus.ASSIGNED) summary.assigned += 1;
      if (normalizedStatus === IPStatus.BLOCKED) summary.blocked += 1;
      if (ip.assetId) summary.assignedAssets += 1;
      else summary.unassigned += 1;

      const subnetKey = toSubnetKey(ip.address);
      const existing = subnetMap.get(subnetKey) ?? {
        cidr: subnetKey,
        counts: { ...EMPTY_COUNTS },
        assignedAssets: 0,
      };
      existing.counts[normalizedStatus] += 1;
      if (ip.assetId) existing.assignedAssets += 1;
      subnetMap.set(subnetKey, existing);
    }

    const subnets = Array.from(subnetMap.values()).sort((a, b) =>
      a.cidr.localeCompare(b.cidr, undefined, { numeric: true })
    );

    summary.subnetCount = subnets.length;

    return {
      items,
      summary,
      subnets,
      privateRanges: Array.from(
        new Set(items.map((ip) => getPrivateRangeLabel(ip.address)).filter(Boolean))
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

    return await prisma.iPAddress.create({
      data: {
        address: data.address,
        isPublic: data.isPublic,
        assetId,
        status: assetId ? IPStatus.ASSIGNED : IPStatus.AVAILABLE,
      },
    });
  },

  async createPrivateIPs(input: CreatePrivateIpInput) {
    const assetId = await ensureAssetExists(input.assetId);

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

    if (assetId && uniqueAddresses.length !== 1) {
      const error: any = new Error("Bulk assignment is not supported");
      error.code = "MULTI_ASSIGNMENT_NOT_SUPPORTED";
      throw error;
    }

    const status = assetId ? IPStatus.ASSIGNED : input.status ?? IPStatus.AVAILABLE;
    if (!assetId && status === IPStatus.ASSIGNED) {
      const error: any = new Error("Assigned status requires an asset");
      error.code = "INVALID_STATUS";
      throw error;
    }

    if (input.mode === "single") {
      return {
        created: [
          await prisma.iPAddress.create({
            data: {
              address: uniqueAddresses[0],
              isPublic: false,
              assetId,
              status,
            },
          }),
        ],
      };
    }

    await prisma.iPAddress.createMany({
      data: uniqueAddresses.map((address) => ({
        address,
        isPublic: false,
        status,
      })),
    });

    const created = await prisma.iPAddress.findMany({
      where: { address: { in: uniqueAddresses } },
      orderBy: { address: "asc" },
    });

    return { created };
  },

  async updateIPAssignment(ipId: string, assetId: string | null) {
    const nextAssetId = await ensureAssetExists(assetId);

    const existing = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, status: true },
    });
    if (!existing) {
      const error: any = new Error("IP not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    if (nextAssetId && existing.status === IPStatus.BLOCKED) {
      const error: any = new Error("Blocked IPs cannot be assigned");
      error.code = "INVALID_STATUS";
      throw error;
    }

    const nextStatus =
      nextAssetId !== null
        ? IPStatus.ASSIGNED
        : existing.status === IPStatus.ASSIGNED
          ? IPStatus.AVAILABLE
          : existing.status;

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: { assetId: nextAssetId, status: nextStatus },
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

  async updatePrivateIpStatus(ipId: string, status: IPStatus) {
    const ip = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, assetId: true, isPublic: true },
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
    if (ip.assetId) {
      const error: any = new Error("Assigned IP status cannot be changed");
      error.code = "ASSIGNED";
      throw error;
    }
    if (status === IPStatus.ASSIGNED) {
      const error: any = new Error("Assigned status requires an asset");
      error.code = "INVALID_STATUS";
      throw error;
    }

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: { status },
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
      select: { id: true, isPublic: true, assetId: true },
    });

    if (!ip) {
      const error: any = new Error("IP not found");
      error.code = "NOT_FOUND";
      throw error;
    }
    if (ip.isPublic) {
      const error: any = new Error("Public IP cannot be deleted here");
      error.code = "NOT_PRIVATE";
      throw error;
    }
    if (ip.assetId) {
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
