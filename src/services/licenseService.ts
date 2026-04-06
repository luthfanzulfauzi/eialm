import { prisma } from "@/lib/prisma";

export const LicenseService = {
  async getLicenses() {
    return await prisma.license.findMany({
      include: {
        asset: {
          select: { name: true, serialNumber: true }
        }
      },
      orderBy: { expiryDate: 'asc' }
    });
  },

  async createLicense(data: any) {
    return await prisma.license.create({
      data: {
        name: data.name,
        key: data.key,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        assetId: data.assetId || null,
        // Logic: if expiryDate is in the past, mark as expired
        isExpired: data.expiryDate ? new Date(data.expiryDate) < new Date() : false
      }
    });
  },

  async getExpiringSoon() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return await prisma.license.findMany({
      where: {
        expiryDate: {
          lte: thirtyDaysFromNow,
          gte: new Date()
        }
      }
    });
  }
};