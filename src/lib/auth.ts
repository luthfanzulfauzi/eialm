import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

type LoginAttemptState = {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number;
};

const loginAttempts = new Map<string, LoginAttemptState>();

const getRequestHeader = (req: any, name: string) => {
  if (!req) return null;

  if (typeof req.headers?.get === "function") {
    return req.headers.get(name);
  }

  const direct = req.headers?.[name];
  if (typeof direct === "string") return direct;
  if (Array.isArray(direct)) return direct[0] ?? null;
  return null;
};

const getLoginThrottleKey = (req: any, email: string) => {
  const forwardedFor = getRequestHeader(req, "x-forwarded-for");
  const realIp = getRequestHeader(req, "x-real-ip");
  const clientIp = (forwardedFor?.split(",")[0] || realIp || "unknown").trim().toLowerCase();
  return `${email.trim().toLowerCase()}|${clientIp}`;
};

const isLoginBlocked = (key: string, now: number) => {
  const state = loginAttempts.get(key);
  if (!state) return false;

  if (state.blockedUntil > now) {
    return true;
  }

  if (state.blockedUntil <= now && now - state.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
  }

  return false;
};

const recordFailedLogin = (key: string, now: number) => {
  const current = loginAttempts.get(key);

  if (!current || now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: 0,
    });
    return;
  }

  const count = current.count + 1;
  loginAttempts.set(key, {
    count,
    firstAttemptAt: current.firstAttemptAt,
    blockedUntil: count >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_BLOCK_MS : 0,
  });
};

const clearFailedLogins = (key: string) => {
  loginAttempts.delete(key);
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: "ElitGrid Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials: any, req: any) {
        if (!credentials?.email || !credentials?.password) return null;
        const now = Date.now();
        const throttleKey = getLoginThrottleKey(req, credentials.email);

        if (isLoginBlocked(throttleKey, now)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        // Use a generic error message for security
        if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
          recordFailedLogin(throttleKey, now);
          return null;
        }

        clearFailedLogins(throttleKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          loginTimeout: user.loginTimeout,
          lastActivityAt: user.lastActivityAt?.toISOString() ?? null,
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
            lastActivityAt: true,
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
        token.lastActivityAt = currentUser.lastActivityAt?.toISOString() ?? null;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        (session.user as any).loginTimeout = (token as any).loginTimeout;
        (session.user as any).lastActivityAt = (token as any).lastActivityAt ?? null;
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
