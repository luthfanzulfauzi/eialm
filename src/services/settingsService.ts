import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const SettingsService = {
  // Update Global Admin Timeout (Admin Only)
  async updateGlobalTimeout(timeout: number, userId: string) {
    return await prisma.user.updateMany({
      data: { loginTimeout: timeout }
    });
  },

  // Change Password logic
  async updatePassword(userId: string, currentPass: string, newPass: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const isValid = await bcrypt.compare(currentPass, user.password);
    if (!isValid) throw new Error("Current password incorrect");

    const hashed = await bcrypt.hash(newPass, 10);
    return await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });
  }
};
