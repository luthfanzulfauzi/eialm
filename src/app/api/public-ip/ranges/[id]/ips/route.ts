import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PublicIpService } from "@/services/publicIpService";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const ips = await PublicIpService.listRangeIps(id);
    return NextResponse.json(ips);
  } catch {
    return NextResponse.json({ error: "Failed to fetch IPs" }, { status: 500 });
  }
}
