import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { licenseAssignmentSchema } from "@/lib/validations/license";
import { LicenseService } from "@/services/licenseService";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = licenseAssignmentSchema.parse(body);
    const license = await LicenseService.assignLicense(id, payload.assetId);
    return NextResponse.json(license);
  } catch (error) {
    console.error("License ASSIGN Error:", error);
    return NextResponse.json(
      { error: (error as any)?.message || "Failed to assign license" },
      { status: 400 }
    );
  }
}
