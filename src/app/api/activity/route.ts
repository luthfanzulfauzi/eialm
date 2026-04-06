import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const THROTTLE_MS = 60_000;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const threshold = new Date(Date.now() - THROTTLE_MS);

  await prisma.user.updateMany({
    where: {
      id: session.user.id,
      OR: [{ lastLogin: null }, { lastLogin: { lt: threshold } }],
    },
    data: { lastLogin: now },
  });

  return NextResponse.json({ ok: true });
}
