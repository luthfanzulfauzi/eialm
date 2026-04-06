export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const [totalAssets, totalLicenses, totalLocations, publicIPs, brokenAssets] = await Promise.all([
      prisma.asset.count(),
      prisma.license.count(),
      prisma.location.count(),
      prisma.iPAddress.count({ where: { isPublic: true } }),
      prisma.asset.count({ where: { status: 'BROKEN' } }),
    ]);

    return NextResponse.json({
      totalAssets: totalAssets || 0,
      totalLicenses: totalLicenses || 0,
      totalLocations: totalLocations || 0,
      publicIPs: publicIPs || 0,
      brokenAssets: brokenAssets || 0,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    // Return zeros rather than a 500 to keep the UI from crashing
    return NextResponse.json({
      totalAssets: 0,
      totalLicenses: 0,
      totalLocations: 0,
      publicIPs: 0,
      brokenAssets: 0,
    }, { status: 200 });
  }
}
