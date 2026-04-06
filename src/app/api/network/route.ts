import { NextResponse } from "next/server";
import { NetworkService } from "@/services/networkService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { IPAssignmentTargetType, IPStatus } from "@prisma/client";
import { z } from "zod";

const CreatePrivateIpSchema = z
  .object({
    action: z.literal("createPrivate"),
    mode: z.enum(["single", "cidr"]),
    address: z.string().min(1),
    prefix: z.number().int().min(0).max(32).optional(),
    assetId: z.string().min(1).optional().nullable(),
    assignmentTargetType: z.nativeEnum(IPAssignmentTargetType).optional().nullable(),
    assignmentTargetLabel: z.string().optional().nullable(),
    status: z.nativeEnum(IPStatus).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "cidr" && typeof value.prefix !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Prefix is required for CIDR registration",
        path: ["prefix"],
      });
    }
  });

const AssignmentSchema = z.object({
  action: z.literal("assign"),
  ipId: z.string().min(1),
  assetId: z.string().optional().nullable(),
  assignmentTargetType: z.nativeEnum(IPAssignmentTargetType).optional().nullable(),
  assignmentTargetLabel: z.string().optional().nullable(),
});

const LegacyAssignmentSchema = z.object({
  ipId: z.string().min(1),
  assetId: z.string().optional().nullable(),
});

const UpdateStatusSchema = z.object({
  action: z.literal("updateStatus"),
  ipId: z.string().min(1),
  status: z.nativeEnum(IPStatus),
  assetId: z.string().optional().nullable(),
  assignmentTargetType: z.nativeEnum(IPAssignmentTargetType).optional().nullable(),
  assignmentTargetLabel: z.string().optional().nullable(),
});

const DeletePrivateIpSchema = z.object({
  action: z.literal("deletePrivate"),
  ipId: z.string().min(1),
});

const LegacyCreateSchema = z.object({
  address: z.string().min(1),
  isPublic: z.boolean(),
  assetId: z.string().optional().nullable(),
});

const MutationSchema = z.union([
  CreatePrivateIpSchema,
  AssignmentSchema,
  LegacyAssignmentSchema,
  UpdateStatusSchema,
  DeletePrivateIpSchema,
  LegacyCreateSchema,
]);

async function requireManager() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return null;
  }
  return session;
}

function formatNetworkError(error: any) {
  if (error?.code === "ASSET_NOT_FOUND") {
    return NextResponse.json({ error: "Selected asset was not found" }, { status: 404 });
  }
  if (error?.code === "INVALID_PRIVATE_IP") {
    return NextResponse.json(
      { error: "Private IPs must use RFC1918 space (10/8, 172.16/12, or 192.168/16)" },
      { status: 400 }
    );
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
  if (error?.code === "DUPLICATE_IP") {
    return NextResponse.json(
      { error: "Some IP addresses already exist", addresses: error.addresses ?? [] },
      { status: 409 }
    );
  }
  if (error?.code === "MULTI_ASSIGNMENT_NOT_SUPPORTED") {
    return NextResponse.json(
      { error: "Bulk private IP registration cannot assign multiple hosts to one asset" },
      { status: 400 }
    );
  }
  if (error?.code === "INVALID_STATUS") {
    return NextResponse.json({ error: "Invalid IP status transition" }, { status: 400 });
  }
  if (error?.code === "ASSIGNED") {
    return NextResponse.json({ error: "Assigned IPs must be released before deletion." }, { status: 409 });
  }
  if (error?.code === "NOT_PRIVATE") {
    return NextResponse.json({ error: "This action only supports private IP inventory" }, { status: 400 });
  }
  if (error?.code === "NOT_FOUND") {
    return NextResponse.json({ error: "IP address not found" }, { status: 404 });
  }
  if (error?.code === "ASSET_REQUIRED") {
    return NextResponse.json({ error: "Hardware target requires a hardware asset." }, { status: 400 });
  }
  if (error?.code === "TARGET_REQUIRED") {
    return NextResponse.json({ error: "Assigned and reserved IPs require a target type." }, { status: 400 });
  }
  if (error?.code === "TARGET_LABEL_REQUIRED") {
    return NextResponse.json({ error: "Assigned and reserved VM/other targets require details." }, { status: 400 });
  }

  return NextResponse.json({ error: "Invalid network request" }, { status: 400 });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "public" | "private" | null;

  try {
    if (type === "private") {
      const data = await NetworkService.getPrivateInventory();
      return NextResponse.json(data);
    }

    const data = await NetworkService.getIPInventory(type || "public");
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch network data" }, { status: 500 });
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

  const parsed = MutationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid network payload" }, { status: 400 });
  }

  try {
    if ("action" in parsed.data && parsed.data.action === "createPrivate") {
      const created = await NetworkService.createPrivateIPs(parsed.data);
      return NextResponse.json(created, { status: 201 });
    }

    if ("action" in parsed.data && parsed.data.action === "assign") {
      const data = await NetworkService.updateIPAssignment(parsed.data.ipId, parsed.data.assetId ?? null);
      return NextResponse.json(data);
    }

    if ("assetId" in parsed.data && "ipId" in parsed.data) {
      const data = await NetworkService.updateIPAssignment(parsed.data.ipId, parsed.data.assetId ?? null);
      return NextResponse.json(data);
    }

    if ("address" in parsed.data && "isPublic" in parsed.data) {
      const data = await NetworkService.createIP(parsed.data);
      return NextResponse.json(data, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid network payload" }, { status: 400 });
  } catch (error) {
    return formatNetworkError(error);
  }
}

export async function PATCH(req: Request) {
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

  const parsed = z.union([AssignmentSchema, UpdateStatusSchema]).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid network payload" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "assign") {
      const data = await NetworkService.updateIPAssignment(parsed.data.ipId, parsed.data.assetId ?? null);
      return NextResponse.json(data);
    }

    const data = await NetworkService.updatePrivateIpStatus(parsed.data.ipId, parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    return formatNetworkError(error);
  }
}

export async function DELETE(req: Request) {
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

  const parsed = DeletePrivateIpSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid network payload" }, { status: 400 });
  }

  try {
    await NetworkService.deletePrivateIp(parsed.data.ipId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatNetworkError(error);
  }
}
