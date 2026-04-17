import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { IPAssignmentTargetType, IPStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { PublicIpService } from "@/services/publicIpService";

const CreatePublicIpSchema = z.object({
  address: z.string().min(1),
  status: z.nativeEnum(IPStatus),
  assetId: z.string().optional().nullable(),
  assignmentTargetType: z.nativeEnum(IPAssignmentTargetType).optional().nullable(),
  assignmentTargetLabel: z.string().optional().nullable(),
});

function formatError(error: any) {
  if (error?.code === "INVALID_PUBLIC_IP") {
    return NextResponse.json({ error: "Public IPs must be valid non-private IPv4 addresses." }, { status: 400 });
  }
  if (error?.code === "DUPLICATE_IP") {
    return NextResponse.json({ error: "This public IP already exists.", addresses: error.addresses ?? [] }, { status: 409 });
  }
  if (error?.code === "ASSET_REQUIRED") {
    return NextResponse.json({ error: "Hardware target requires a hardware asset." }, { status: 400 });
  }
  if (error?.code === "ASSET_NOT_FOUND") {
    return NextResponse.json({ error: "Selected hardware asset was not found." }, { status: 404 });
  }
  if (error?.code === "TARGET_REQUIRED") {
    return NextResponse.json({ error: "Assigned and reserved IPs require a target type." }, { status: 400 });
  }
  if (error?.code === "TARGET_LABEL_REQUIRED") {
    return NextResponse.json({ error: "Assigned and reserved VM/other targets require details." }, { status: 400 });
  }
  return NextResponse.json({ error: "Failed to create public IP." }, { status: 400 });
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

  const parsed = CreatePublicIpSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid public IP payload" }, { status: 400 });
  }

  try {
    const created = await PublicIpService.createIp(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return formatError(error);
  }
}
