import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const THROTTLE_MS = 60_000;
const ACTIVITY_COOKIE = "elitgrid_last_activity";

function applyActivityCookie(response: NextResponse, value: string, maxAge?: number) {
  response.cookies.set(ACTIVITY_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  });
}

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
      OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: threshold } }],
    },
    data: { lastActivityAt: now },
  });

  const response = NextResponse.json({ ok: true, activityAt: now.toISOString() });
  applyActivityCookie(response, String(now.getTime()));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  applyActivityCookie(response, "", 0);
  return response;
}
