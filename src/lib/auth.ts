import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: "EIALM Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        // Use a generic error message for security
        if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          loginTimeout: user.loginTimeout,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.loginTimeout = (user as any).loginTimeout;
        return token;
      }

      if (typeof token.id === "string") {
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            loginTimeout: true,
          },
        });

        if (!currentUser) {
          return {};
        }

        token.id = currentUser.id;
        token.name = currentUser.name;
        token.email = currentUser.email;
        token.role = currentUser.role;
        token.loginTimeout = currentUser.loginTimeout;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        (session.user as any).loginTimeout = (token as any).loginTimeout;
      }
      return session;
    }
  },
  // ADDED: Event trigger to update database on every successful login
  events: {
    async signIn({ user }: any) {
      const now = new Date();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: now,
          lastActivityAt: now,
        },
      });
    },
  },
  pages: {
    signIn: "/login",
  }
};
