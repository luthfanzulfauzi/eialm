import { NextResponse } from "next/server";
import { NetworkService } from "@/services/networkService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as 'public' | 'private';
  
  try {
    const data = await NetworkService.getIPInventory(type || 'public');
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch network data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  // RBAC: Only ADMIN or OPERATOR can modify network settings
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    if (body?.ipId) {
      const data = await NetworkService.updateIPAssignment(body.ipId, body.assetId ?? null);
      return NextResponse.json(data);
    }
    const data = await NetworkService.createIP(body);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid IP data" }, { status: 400 });
  }
}
