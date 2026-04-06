import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { PublicIpService } from "@/services/publicIpService";

const CreateRangeSchema = z.object({
  network: z.string().min(1),
  prefix: z.number().int().min(0).max(32),
});

export async function GET() {
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
    return NextResponse.json(created, { status: 201 });
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

