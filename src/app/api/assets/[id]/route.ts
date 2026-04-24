import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AssetService } from "@/services/assetService";

const formatAssetError = (error: unknown) => {
  const message = (error as any)?.message || "Failed to update asset";
  if (typeof message === "string" && message.includes("does not exist in the current database")) {
    return "Database schema is out of date. Run Prisma migrate/db push, then restart the server.";
  }
  return message;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = await AssetService.updateAsset(id, body, session.user.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: formatAssetError(error) }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "VIEWER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await AssetService.deleteAsset(id, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete asset" }, { status: 400 });
  }
}
