import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { maintenanceUpdateSchema } from "@/lib/validations/maintenance";
import { MaintenanceService } from "@/services/maintenanceService";

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
    const payload = maintenanceUpdateSchema.parse(body);
    const record = await MaintenanceService.updateMaintenance(params.id, payload, session.user.id);
    return NextResponse.json(record);
  } catch (error) {
    console.error("Maintenance PATCH Error:", error);
    return NextResponse.json(
      { error: (error as any)?.message || "Failed to update maintenance record" },
      { status: 400 }
    );
  }
}
