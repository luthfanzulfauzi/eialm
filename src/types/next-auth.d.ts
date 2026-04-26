import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      loginTimeout: number;
      lastActivityAt?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    loginTimeout: number;
    lastActivityAt?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    loginTimeout: number;
    lastActivityAt?: string | null;
  }
}
