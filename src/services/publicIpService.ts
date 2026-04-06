import { prisma } from "@/lib/prisma";
import { cidrToIPv4Range, formatBigIntToIPv4, parseIPv4ToBigInt } from "@/lib/ip";
import { IPStatus } from "@prisma/client";

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
    return await prisma.iPAddress.findMany({
      where: { isPublic: true, publicRangeId: rangeId },
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true, category: true },
        },
      },
      orderBy: { address: "asc" },
    });
  },

  async updateIpStatus(ipId: string, status: IPStatus) {
    const ip = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, assetId: true, isPublic: true },
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
    if (ip.assetId) {
      const err: any = new Error("Assigned");
      err.code = "ASSIGNED";
      throw err;
    }
    if (status === IPStatus.ASSIGNED) {
      const err: any = new Error("Invalid status");
      err.code = "INVALID_STATUS";
      throw err;
    }

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: { status },
    });
  },
};
