import { Sidebar } from "@/components/layout/Sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthTier } from "@/lib/utils";
import { ActivityPinger } from "@/components/auth/ActivityPinger";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Retrieve the server-side session using authOptions
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.id) {
    redirect("/login");
  }

  const timeoutMinutes =
    typeof (user as any).loginTimeout === "number" && (user as any).loginTimeout > 0
      ? (user as any).loginTimeout
      : 30;
  const lastActivityAtRaw = (user as any).lastActivityAt;
  const lastActivityAt = typeof lastActivityAtRaw === "string" ? Date.parse(lastActivityAtRaw) : NaN;

  if (Number.isFinite(lastActivityAt)) {
    const elapsedMs = Date.now() - lastActivityAt;
    if (elapsedMs > timeoutMinutes * 60 * 1000) {
      redirect("/login?timedOut=1");
    }
  }

  // Derive initials from the user's name (e.g., "System Administrator" -> "SA")
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "??";

  return (
    <div className="flex h-screen bg-[#0f1218] text-slate-200 overflow-hidden">
      <ActivityPinger />
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header / Top Nav */}
        <header className="h-16 border-b border-slate-800 flex items-center px-8 justify-between bg-[#0f1218]/50 backdrop-blur-md">
          <GlobalSearch />
          <div className="flex items-center gap-4">
            {/* Dynamic Auth Tier based on real user role retrieved from session */}
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
              Auth Tier: {getAuthTier(user?.role)}
            </div>
            {/* Dynamic initials based on logged-in user name */}
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <section className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </section>
      </main>
    </div>
  );
}
