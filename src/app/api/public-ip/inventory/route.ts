import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PublicIpService } from "@/services/publicIpService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const data = await PublicIpService.getInventory();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch public IP inventory" }, { status: 500 });
  }
}
