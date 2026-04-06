import { z } from "zod";
import { Role } from "@prisma/client";

export const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(Role).default(Role.VIEWER),
});

export type UserFormValues = z.infer<typeof userSchema>;