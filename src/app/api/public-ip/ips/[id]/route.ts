import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { IPAssignmentTargetType, IPStatus } from "@prisma/client";
import { PublicIpService } from "@/services/publicIpService";
import { writeAuditLog } from "@/lib/audit";

const UpdateStatusSchema = z.object({
  status: z.nativeEnum(IPStatus),
  assetId: z.string().optional().nullable(),
  assignmentTargetType: z.nativeEnum(IPAssignmentTargetType).optional().nullable(),
  assignmentTargetLabel: z.string().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const parsed = UpdateStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const updated = await PublicIpService.updateIpStatus(id, parsed.data);
    await writeAuditLog({
      action: "NETWORK_PUBLIC_IP_UPDATE",
      userId: session.user.id,
      assetId: updated.assetId,
      details: {
        ipId: updated.id,
        address: updated.address,
        status: updated.status,
        assignmentTargetType: updated.assignmentTargetType,
        assignmentTargetLabel: updated.assignmentTargetLabel,
        assetId: updated.assetId,
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === "NOT_FOUND") return new NextResponse("Not Found", { status: 404 });
    if (e?.code === "NOT_PUBLIC") return new NextResponse("Forbidden", { status: 403 });
    if (e?.code === "INVALID_STATUS") {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }
    if (e?.code === "ASSET_REQUIRED") {
      return NextResponse.json({ error: "Hardware target requires a hardware asset." }, { status: 400 });
    }
    if (e?.code === "ASSET_NOT_FOUND") {
      return NextResponse.json({ error: "Selected hardware asset was not found." }, { status: 404 });
    }
    if (e?.code === "TARGET_REQUIRED") {
      return NextResponse.json({ error: "Assigned and reserved IPs require a target type." }, { status: 400 });
    }
    if (e?.code === "TARGET_LABEL_REQUIRED") {
      return NextResponse.json({ error: "Assigned and reserved VM/other targets require details." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update status" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    await PublicIpService.deleteIp(id);
    await writeAuditLog({
      action: "NETWORK_PUBLIC_IP_DELETE",
      userId: session.user.id,
      details: {
        ipId: id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "NOT_FOUND") return new NextResponse("Not Found", { status: 404 });
    if (e?.code === "NOT_PUBLIC") return new NextResponse("Forbidden", { status: 403 });
    if (e?.code === "ASSIGNED") {
      return NextResponse.json({ error: "Assigned IPs must be released before deletion." }, { status: 409 });
    }
    if (e?.code === "RANGE_MANAGED_IP") {
      return NextResponse.json(
        { error: "This IP belongs to a managed range. Edit or delete the range instead." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to delete public IP." }, { status: 400 });
  }
}
