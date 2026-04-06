import { NextResponse } from "next/server";
import { UserService } from "@/services/userService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  // RBAC: Only ADMINs can view the full user directory
  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden: Admin access required", { status: 403 });
  }

  const users = await UserService.getUsers();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  // RBAC: Only ADMINs can create new technical users
  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden: Admin access required", { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body?.name || !body?.email || !body?.password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    const user = await UserService.createUser(body);
    return NextResponse.json(user);
  } catch (error) {
    let message = "Failed to create user";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") message = "Email already exists";
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
