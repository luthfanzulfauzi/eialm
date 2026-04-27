import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { importLicenseCsv } from "@/lib/licenseTransfer";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
    }

    const content = await file.text();
    const result = await importLicenseCsv(prisma, content);

    await writeAuditLog({
      action: "LICENSE_IMPORT",
      userId: session.user.id,
      details: {
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        filename: file.name,
      },
    });

    return NextResponse.json({
      ok: result.failed === 0,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to import licenses" }, { status: 400 });
  }
}
