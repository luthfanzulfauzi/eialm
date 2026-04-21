import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { PublicIpService } from "@/services/publicIpService";
import { writeAuditLog } from "@/lib/audit";

const CreateRangeSchema = z.object({
  network: z.string().min(1),
  prefix: z.number().int().min(0).max(32),
});

function serializeRange(range: {
  id: string;
  network: string;
  prefix: number;
  cidr: string;
  startAddress: string;
  endAddress: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: range.id,
    network: range.network,
    prefix: range.prefix,
    cidr: range.cidr,
    startAddress: range.startAddress,
    endAddress: range.endAddress,
    size: range.size,
    createdAt: range.createdAt,
    updatedAt: range.updatedAt,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const ranges = await PublicIpService.listRanges();
    return NextResponse.json(ranges);
  } catch {
    return NextResponse.json({ error: "Failed to fetch ranges" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateRangeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid range data" }, { status: 400 });
  }

  try {
    const created = await PublicIpService.createRange(parsed.data);
    await writeAuditLog({
      action: "NETWORK_PUBLIC_RANGE_CREATE",
      userId: session.user.id,
      details: {
        rangeId: created.id,
        cidr: created.cidr,
        network: created.network,
        prefix: created.prefix,
        size: created.size,
      },
    });
    return NextResponse.json(serializeRange(created), { status: 201 });
  } catch (e: any) {
    if (e?.code === "OVERLAP") {
      return NextResponse.json(
        { error: "Range overlaps an existing range", overlap: e.overlap },
        { status: 409 }
      );
    }
    if (e?.message === "Range too large") {
      return NextResponse.json(
        { error: "Range too large. Use a smaller prefix (e.g. /24 or smaller blocks)." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to create range" }, { status: 400 });
  }
}
