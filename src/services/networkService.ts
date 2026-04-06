import { prisma } from "@/lib/prisma";
import { IPStatus } from "@prisma/client";

export const NetworkService = {
  async getIPInventory(type: 'public' | 'private') {
    const isPublic = type === 'public';
    return await prisma.iPAddress.findMany({
      where: { isPublic },
      include: {
        asset: {
          select: { 
            id: true,
            name: true, 
            serialNumber: true, 
            category: true 
          }
        }
      },
      orderBy: { address: 'asc' }
    });
  },

  async createIP(data: { address: string; isPublic: boolean; assetId?: string }) {
    return await prisma.iPAddress.create({
      data: {
        address: data.address,
        isPublic: data.isPublic,
        assetId: data.assetId || null,
        status: data.assetId ? IPStatus.ASSIGNED : IPStatus.AVAILABLE,
      }
    });
  },

  async updateIPAssignment(ipId: string, assetId: string | null) {
    const existing = await prisma.iPAddress.findUnique({
      where: { id: ipId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new Error("IP not found");
    }

    const nextStatus =
      assetId !== null
        ? IPStatus.ASSIGNED
        : existing.status === IPStatus.ASSIGNED
          ? IPStatus.AVAILABLE
          : existing.status;

    return await prisma.iPAddress.update({
      where: { id: ipId },
      data: { assetId, status: nextStatus },
    });
  }
};
