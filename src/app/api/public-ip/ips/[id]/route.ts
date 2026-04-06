import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { IPStatus } from "@prisma/client";
import { PublicIpService } from "@/services/publicIpService";

const UpdateStatusSchema = z.object({
  status: z.nativeEnum(IPStatus),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
    const updated = await PublicIpService.updateIpStatus(params.id, parsed.data.status);
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === "NOT_FOUND") return new NextResponse("Not Found", { status: 404 });
    if (e?.code === "ASSIGNED") {
      return NextResponse.json({ error: "Cannot change status for an assigned IP" }, { status: 409 });
    }
    if (e?.code === "NOT_PUBLIC") return new NextResponse("Forbidden", { status: 403 });
    if (e?.code === "INVALID_STATUS") {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update status" }, { status: 400 });
  }
}

