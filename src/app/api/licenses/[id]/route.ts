import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { licenseUpdateSchema } from "@/lib/validations/license";
import { LicenseService } from "@/services/licenseService";

const formatLicenseError = (error: unknown) => {
  const message = (error as any)?.message || "Failed to update license";
  if (typeof message === "string" && message.includes("Unique constraint")) {
    return "License key must be unique.";
  }
  return message;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = licenseUpdateSchema.parse(body);
    const license = await LicenseService.updateLicense(params.id, payload);
    return NextResponse.json(license);
  } catch (error) {
    console.error("License PATCH Error:", error);
    return NextResponse.json({ error: formatLicenseError(error) }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    await LicenseService.deleteLicense(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("License DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete license" }, { status: 400 });
  }
}
