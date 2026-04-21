import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { NetworkService } from "@/services/networkService";
import { writeAuditLog } from "@/lib/audit";

const UpdateRangeSchema = z.object({
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
  if (error?.code === "NOT_FOUND") {
    return NextResponse.json({ error: "Range not found" }, { status: 404 });
  }
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
  if (error?.code === "RANGE_IN_USE") {
    return NextResponse.json(
      { error: "Range contains managed IPs. Reset them to AVAILABLE before editing or deleting.", ip: error.ip },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: "Failed to update private range" }, { status: 400 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  const parsed = UpdateRangeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid range data" }, { status: 400 });
  }

  try {
    const updated = await NetworkService.updatePrivateRange(params.id, parsed.data);
    await writeAuditLog({
      action: "NETWORK_PRIVATE_RANGE_UPDATE",
      userId: session.user.id,
      details: {
        rangeId: updated.id,
        cidr: updated.cidr,
        network: updated.network,
        prefix: updated.prefix,
        size: updated.size,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return formatRangeError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireManager();
  if (!session) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    await NetworkService.deletePrivateRange(params.id);
    await writeAuditLog({
      action: "NETWORK_PRIVATE_RANGE_DELETE",
      userId: session.user.id,
      details: {
        rangeId: params.id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatRangeError(error);
  }
}
