import { NextResponse } from "next/server";
import { AssetService } from "@/services/assetService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AssetStatus, LocationType } from "@prisma/client";

const formatAssetError = (error: unknown) => {
  const message = (error as any)?.message || "Failed to create asset";
  if (typeof message === "string" && message.includes("does not exist in the current database")) {
    return "Database schema is out of date. Run Prisma migrate/db push, then restart the server.";
  }
  return message;
};

const assetStatuses = new Set(["PLAN", "PURCHASED", "INSTALLING", "ACTIVE", "MAINTENANCE", "BROKEN", "DECOMMISSIONED"]);
const locationTypes = new Set(["DATACENTER", "WAREHOUSE"]);
const rackStates = new Set(["RACKED", "UNRACKED", "UNASSIGNED"]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const cat = searchParams.get("cat") || undefined;
  const rawStatus = searchParams.get("status") || "";
  const rawType = searchParams.get("type") || "";
  const rawRackState = searchParams.get("rackState") || "";
  const status = assetStatuses.has(rawStatus) ? (rawStatus as AssetStatus) : undefined;
  const type = locationTypes.has(rawType) ? (rawType as LocationType) : undefined;
  const rackState = rackStates.has(rawRackState) ? (rawRackState as any) : undefined;
  const page = Number(searchParams.get("page") || "1");
  
  try {
    const [locations, racks] = await Promise.all([
      prisma.location.findMany(),
      prisma.rack.findMany()
    ]);

    try {
      const data = await AssetService.getAssets({ 
        search: q, 
        category: cat,
        status,
        type,
        rackState,
        page,
      });
      return NextResponse.json({ ...data, locations, racks });
    } catch (error) {
      console.error("Asset list Error:", error);
      return NextResponse.json({
        items: [],
        total: 0,
        pages: 0,
        locations,
        racks,
        error: "Failed to fetch assets"
      });
    }
  } catch (error) {
    console.error("Asset GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  // Strict check: User must be authenticated and have an ID
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  
  // RBAC: Only ADMIN or OPERATOR can create assets
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    // Use the real user ID from the session for the audit log trail
    const asset = await AssetService.createAsset(body, session.user.id);
    return NextResponse.json(asset);
  } catch (error) {
    console.error("Asset POST Error:", error);
    return NextResponse.json(
      { error: formatAssetError(error) },
      { status: 400 }
    );
  }
}
