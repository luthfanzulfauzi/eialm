import { prisma } from "@/lib/prisma";
import { cidrToIPv4Range, compareIPv4Addresses, formatBigIntToIPv4, parseIPv4ToBigInt } from "@/lib/ip";
import { IPAssignmentTargetType, IPStatus } from "@prisma/client";

const MAX_GENERATED_IPS = BigInt(4096);

function toCidr(network: string, prefix: number) {
  return `${network}/${prefix}`;
}

export const PublicIpService = {
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

  async createRange(input: { network: string; prefix: number }) {
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

    const cidr = toCidr(input.network, prefix);
    const startAddress = formatBigIntToIPv4(range.start);
    const endAddress = formatBigIntToIPv4(range.end);
    const size = Number(range.size);

    const created = await prisma.$transaction(async (tx) => {
      const rangeRow = await tx.publicIPRange.create({
        data: {
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
    const assetId =
      typeof input.assetId === "string" && input.assetId.trim().length > 0 ? input.assetId : null;
    const targetType = input.assignmentTargetType ?? null;
    const targetLabel =
      typeof input.assignmentTargetLabel === "string" && input.assignmentTargetLabel.trim().length > 0
        ? input.assignmentTargetLabel.trim()
        : null;

    if (input.status === IPStatus.AVAILABLE) {
      return await prisma.iPAddress.update({
        where: { id: ipId },
        data: {
          status: IPStatus.AVAILABLE,
          assetId: null,
          assignmentTargetType: null,
          assignmentTargetLabel: null,
        },
      });
    }

    if ((input.status === IPStatus.ASSIGNED || input.status === IPStatus.RESERVED) && !targetType) {
      const err: any = new Error("Target required");
      err.code = "TARGET_REQUIRED";
      throw err;
    }

    if (!targetType && !targetLabel && !assetId) {
      return await prisma.iPAddress.update({
        where: { id: ipId },
        data: {
          status: input.status,
          assetId: null,
          assignmentTargetType: null,
          assignmentTargetLabel: null,
        },
      });
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

      return await prisma.iPAddress.update({
        where: { id: ipId },
        data: {
          status: input.status,
          assetId: asset.id,
          assignmentTargetType: IPAssignmentTargetType.HARDWARE,
          assignmentTargetLabel: `${asset.name} (${asset.serialNumber})`,
        },
      });
    }

    if (!targetLabel && (input.status === IPStatus.ASSIGNED || input.status === IPStatus.RESERVED)) {
      const err: any = new Error("Target detail required");
      err.code = "TARGET_LABEL_REQUIRED";
      throw err;
    }

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: {
        status: input.status,
        assetId: null,
        assignmentTargetType: targetType,
        assignmentTargetLabel: targetLabel,
      },
    });
  },
};
