import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ACTIVITY_COOKIE = "eialm_last_activity";

function clearSessionCookies(response: NextResponse) {
  const cookieNames = [
    ACTIVITY_COOKIE,
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
  ];

  for (const name of cookieNames) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
}

export default withAuth(
  function middleware(req: any) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    /**
     * 1. ROLE-BASED ACCESS CONTROL (RBAC)
     * Strictly limits User Management and Global Settings to Admin role.
     */
    const adminOnlyPaths = ["/users"];
    const operatorOrAdminPaths = ["/settings"];
    const isAdminPath = adminOnlyPaths.some((p) => pathname.startsWith(p));
    const isOperatorOrAdminPath = operatorOrAdminPaths.some((p) => pathname.startsWith(p));

    if (isAdminPath && token?.role !== "ADMIN") {
      // Redirect unauthorized users to the dashboard home
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (isOperatorOrAdminPath && token?.role !== "ADMIN" && token?.role !== "OPERATOR") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const now = Date.now();
    const timeoutMinutes =
      typeof (token as any)?.loginTimeout === "number" && (token as any).loginTimeout > 0
        ? (token as any).loginTimeout
        : 30;

    const lastActivityRaw = req.cookies.get(ACTIVITY_COOKIE)?.value;
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : NaN;

    if (Number.isFinite(lastActivity)) {
      const elapsedMs = now - lastActivity;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (elapsedMs > timeoutMs) {
        const isApiRequest = pathname.startsWith("/api/");
        const res = isApiRequest
          ? NextResponse.json({ error: "Session timed out" }, { status: 401 })
          : NextResponse.redirect(new URL(`/login?timedOut=1&callbackUrl=${encodeURIComponent(pathname)}`, req.url));

        clearSessionCookies(res);
        return res;
      }
    }

    /**
     * 2. ACTION-BASED RESTRICTIONS
     * VIEWERS are blocked from "Create", "Edit", or "Manage" actions.
     */
    const restrictedForViewers = [
      "/assets/hardware/create",
      "/assets/locations/create",
      "/licenses/manage",
      "/network/reserve"
    ];

    const isRestrictedPath = restrictedForViewers.some((p) => pathname.startsWith(p));

    if (isRestrictedPath && token?.role === "VIEWER") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }: any) =>
        typeof token?.id === "string" &&
        (token?.role === "ADMIN" || token?.role === "OPERATOR" || token?.role === "VIEWER"),
    },
    pages: {
      signIn: "/login", // Redirect to our custom login page
    },
  }
);

/** * Matcher configuration:
 * We protect everything EXCEPT the login page, standard API auth routes,
 * cron-safe operational endpoints,
 * and static Next.js assets. 
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth endpoints)
     * - api/licenses/expiration-refresh (cron endpoint with its own secret/session auth)
     * - login (Our custom login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, public assets
     */
    "/((?!api/auth|api/licenses/expiration-refresh|login|_next/static|_next/image|favicon.ico|public|avatars).*)",
  ],
};
