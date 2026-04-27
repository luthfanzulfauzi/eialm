import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { NetworkService } from "@/services/networkService";
import { writeAuditLog } from "@/lib/audit";

const CreateRangeSchema = z.object({
  name: z.string().optional(),
  network: z.string().min(1),
  prefix: z.number().int().min(0).max(32),
});

async function requireManager() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return null;
  }
  return session;
}

function formatRangeError(error: any) {
  if (error?.code === "INVALID_PRIVATE_RANGE") {
    return NextResponse.json(
      {
        error:
          "Invalid private subnet. Use a private IPv4 network boundary and keep bulk registration at 1024 hosts or less.",
      },
      { status: 400 }
    );
  }
  if (error?.code === "OVERLAP") {
    return NextResponse.json(
      { error: "Range overlaps an existing private range", overlap: error.overlap },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: "Failed to create private range" }, { status: 400 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const ranges = await NetworkService.listPrivateRanges();
    return NextResponse.json(ranges);
  } catch {
    return NextResponse.json({ error: "Failed to fetch private ranges" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireManager();
  if (!session) {
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
    const created = await NetworkService.createPrivateIPs({
      mode: "cidr",
      name: parsed.data.name,
      address: parsed.data.network,
      prefix: parsed.data.prefix,
      status: undefined,
      assetId: null,
      assignmentTargetType: null,
      assignmentTargetLabel: null,
    });
    await writeAuditLog({
      action: "NETWORK_PRIVATE_RANGE_CREATE",
      userId: session.user.id,
      details: {
        cidr: `${parsed.data.network}/${parsed.data.prefix}`,
        name: parsed.data.name?.trim() || "",
        network: parsed.data.network,
        prefix: parsed.data.prefix,
        createdCount: created.created.length,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return formatRangeError(error);
  }
}
