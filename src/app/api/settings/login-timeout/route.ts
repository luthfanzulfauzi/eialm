import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsService } from "@/services/settingsService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { loginTimeout: true },
  });

  return NextResponse.json({ loginTimeout: user?.loginTimeout ?? 30 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden: Admin access required", { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const minutes = Number(body?.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) {
    return NextResponse.json({ error: "minutes must be a number between 1 and 1440" }, { status: 400 });
  }

  const result = await SettingsService.updateGlobalTimeout(minutes, session.user.id);
  return NextResponse.json({ ok: true, minutes, updatedUsers: result.count });
}
