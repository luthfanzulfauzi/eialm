import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { PublicIpService } from "@/services/publicIpService";
import { writeAuditLog } from "@/lib/audit";

const UpdateRangeSchema = z.object({
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

async function requireManager() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return null;
  }
  return session;
}

function formatRangeError(error: any) {
  if (error?.code === "NOT_FOUND") {
    return NextResponse.json({ error: "Range not found" }, { status: 404 });
  }
  if (error?.code === "OVERLAP") {
    return NextResponse.json({ error: "Range overlaps an existing range", overlap: error.overlap }, { status: 409 });
  }
  if (error?.code === "RANGE_IN_USE") {
    return NextResponse.json(
      { error: "Range contains managed IPs. Reset them to AVAILABLE before editing or deleting.", ip: error.ip },
      { status: 409 }
    );
  }
  if (error?.message === "Range too large") {
    return NextResponse.json({ error: "Range too large. Use a smaller prefix." }, { status: 400 });
  }
  return NextResponse.json({ error: "Failed to update range" }, { status: 400 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireManager();
  if (!session) return new NextResponse("Forbidden", { status: 403 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateRangeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid range data" }, { status: 400 });
  }

  try {
    const updated = await PublicIpService.updateRange(id, parsed.data);
    await writeAuditLog({
      action: "NETWORK_PUBLIC_RANGE_UPDATE",
      userId: session.user.id,
      details: {
        rangeId: updated.id,
        cidr: updated.cidr,
        network: updated.network,
        prefix: updated.prefix,
        size: updated.size,
      },
    });
    return NextResponse.json(serializeRange(updated));
  } catch (error) {
    return formatRangeError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireManager();
  if (!session) return new NextResponse("Forbidden", { status: 403 });

  try {
    await PublicIpService.deleteRange(id);
    await writeAuditLog({
      action: "NETWORK_PUBLIC_RANGE_DELETE",
      userId: session.user.id,
      details: {
        rangeId: id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatRangeError(error);
  }
}
