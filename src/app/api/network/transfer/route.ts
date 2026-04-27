import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportNetworkCsv, importNetworkCsv, type NetworkTransferType } from "@/lib/networkTransfer";
import { writeAuditLog } from "@/lib/audit";

const getType = (req: Request): NetworkTransferType | null => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  return type === "public" || type === "private" ? type : null;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const type = getType(req);
  if (!type) {
    return NextResponse.json({ error: "type must be public or private" }, { status: 400 });
  }

  const csv = await exportNetworkCsv(prisma, type);
  const filename = `${type}-ip-inventory-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const type = getType(req);
  if (!type) {
    return NextResponse.json({ error: "type must be public or private" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
  }

  try {
    const content = await file.text();
    const result = await importNetworkCsv(prisma, type, content);
    await writeAuditLog({
      action: type === "public" ? "NETWORK_PUBLIC_IP_IMPORT" : "NETWORK_PRIVATE_IP_IMPORT",
      userId: session.user.id,
      details: {
        type,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        filename: file.name,
      },
    });
    return NextResponse.json({ ok: result.failed === 0, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to import CSV" }, { status: 400 });
  }
}
