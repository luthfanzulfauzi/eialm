import { NextResponse } from "next/server";
import { PublicIpService } from "@/services/publicIpService";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const ips = await PublicIpService.listRangeIps(params.id);
    return NextResponse.json(ips);
  } catch {
    return NextResponse.json({ error: "Failed to fetch IPs" }, { status: 500 });
  }
}

