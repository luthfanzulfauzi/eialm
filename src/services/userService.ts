import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export const UserService = {
  async getUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLogin: true,
        image: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async createUser(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as Role,
      },
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
  },

  async deleteUser(id: string) {
    // Prevent self-deletion logic should be in the API route
    return await prisma.user.delete({ where: { id } });
  }
};
