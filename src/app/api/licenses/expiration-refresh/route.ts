import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LicenseService } from "@/services/licenseService";

const isAuthorizedCron = (req: Request) => {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return false;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${configuredSecret}`;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const cronAuthorized = isAuthorizedCron(req);

  if (!cronAuthorized) {
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const result = await LicenseService.runExpirationRefreshJob({ force });
    return NextResponse.json(result);
  } catch (error) {
    console.error("License expiration refresh error:", error);
    return NextResponse.json({ error: "Failed to refresh license expiration notifications" }, { status: 500 });
  }
}
