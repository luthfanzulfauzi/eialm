import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { maintenanceSchema } from "@/lib/validations/maintenance";
import { MaintenanceService } from "@/services/maintenanceService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const data = await MaintenanceService.getMaintenanceManagerData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Maintenance GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch maintenance records" }, { status: 500 });
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
    const payload = maintenanceSchema.parse(body);
    const record = await MaintenanceService.createMaintenance(payload, session.user.id);
    return NextResponse.json(record);
  } catch (error) {
    console.error("Maintenance POST Error:", error);
    return NextResponse.json(
      { error: (error as any)?.message || "Failed to create maintenance record" },
      { status: 400 }
    );
  }
}
