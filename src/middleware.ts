import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req: any) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    /**
     * 1. ROLE-BASED ACCESS CONTROL (RBAC)
     * Strictly limits User Management and Global Settings to Admin role.
     */
    const adminOnlyPaths = ["/users"];
    const isAdminPath = adminOnlyPaths.some((p) => pathname.startsWith(p));

    if (isAdminPath && token?.role !== "ADMIN") {
      // Redirect unauthorized users to the dashboard home
      return NextResponse.redirect(new URL("/", req.url));
    }

    const now = Date.now();
    const timeoutMinutes =
      typeof (token as any)?.loginTimeout === "number" && (token as any).loginTimeout > 0
        ? (token as any).loginTimeout
        : 30;

    const lastActivityRaw = req.cookies.get("eialm_last_activity")?.value;
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : NaN;

    if (Number.isFinite(lastActivity)) {
      const elapsedMs = now - lastActivity;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (elapsedMs > timeoutMs) {
        const redirectUrl = new URL("/login", req.url);
        redirectUrl.searchParams.set("callbackUrl", pathname);
        const res = NextResponse.redirect(redirectUrl);

        res.cookies.set("eialm_last_activity", "", { maxAge: 0, path: "/" });
        res.cookies.set("next-auth.session-token", "", { maxAge: 0, path: "/" });
        res.cookies.set("__Secure-next-auth.session-token", "", { maxAge: 0, path: "/" });

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

    const res = NextResponse.next();
    res.cookies.set("eialm_last_activity", String(now), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
    });
    return res;
  },
  {
    callbacks: {
      // authorized: returns true if the user is authenticated. 
      // If false, the user is redirected to the sign-in page.
      authorized: ({ token }: any) => !!token,
    },
    pages: {
      signIn: "/login", // Redirect to our custom login page
    },
  }
);

/** * Matcher configuration:
 * We protect everything EXCEPT the login page, standard API auth routes, 
 * and static Next.js assets. 
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth endpoints)
     * - login (Our custom login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, public assets
     */
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|public|avatars).*)",
  ],
};
