import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  const role = body?.role;
  if (role !== "ADMIN" && role !== "OPERATOR" && role !== "VIEWER") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (params.id === session.user.id && role !== "ADMIN") {
    return NextResponse.json({ error: "You cannot remove your own admin role" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { role: role as Role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLogin: true,
      image: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden: Admin access required", { status: 403 });
  }

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
