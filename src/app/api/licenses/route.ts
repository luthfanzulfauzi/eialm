import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { licenseSchema } from "@/lib/validations/license";
import { LicenseService } from "@/services/licenseService";

const formatLicenseError = (error: unknown) => {
  const message = (error as any)?.message || "Failed to save license";
  if (typeof message === "string" && message.includes("Unique constraint")) {
    return "License key must be unique.";
  }
  return message;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const data = await LicenseService.getLicenseManagerData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("License GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch licenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = licenseSchema.parse(body);
    const license = await LicenseService.createLicense(payload);
    return NextResponse.json(license);
  } catch (error) {
    console.error("License POST Error:", error);
    return NextResponse.json({ error: formatLicenseError(error) }, { status: 400 });
  }
}
