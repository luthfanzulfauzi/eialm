export const dynamic = "force-dynamic";

import { StatsCard } from "@/components/dashboard/StatsCard";
import { AuditTrail } from "@/components/dashboard/AuditTrail";
import { AlertTriangle, Bell, CalendarClock, Download, Globe, Key, Server, ShieldAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuditFeedItems } from "@/lib/auditFeed";
import { LicenseService } from "@/services/licenseService";

const toTitleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const formatEnum = (value?: string | null) => {
  if (!value) return null;
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => (part === "VM" ? "VM" : toTitleCase(part)))
    .join(" ");
};

export default async function DashboardPage() {
  await LicenseService.runExpirationRefreshJob();

  // 1. Fetch real-time metrics from the database
  const [
    totalAssets,
    assignedPublicIPs,
    totalPublicIPs,
    brokenAssets,
    totalLicenses,
    expiredLicenses,
    expiringLicenses,
    expiredLicenseItems,
    expiringLicenseItems,
    brokenAssetItems,
    repairRecords,
    operationalNotifications,
  ] = await Promise.all([
    prisma.asset.count(),
    prisma.iPAddress.count({ where: { isPublic: true, status: "ASSIGNED" } }),
    prisma.iPAddress.count({ where: { isPublic: true } }),
    prisma.asset.count({ where: { status: 'BROKEN' } }),
    prisma.license.count(), // Counting total managed licenses
    prisma.license.count({ where: { isExpired: true } }),
    prisma.license.count({
      where: {
        isExpired: false,
        expiryDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.license.findMany({
      where: { isExpired: true, expiryDate: { not: null } },
      include: {
        asset: { select: { name: true, serialNumber: true } },
        products: { select: { name: true, code: true }, orderBy: { name: "asc" } },
      },
      take: 5,
      orderBy: { expiryDate: "asc" },
    }),
    prisma.license.findMany({
      where: {
        isExpired: false,
        expiryDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        asset: { select: { name: true, serialNumber: true } },
        products: { select: { name: true, code: true }, orderBy: { name: "asc" } },
      },
      take: 5,
      orderBy: { expiryDate: "asc" },
    }),
    prisma.asset.findMany({
      where: { status: "BROKEN" },
      select: {
        id: true,
        name: true,
        serialNumber: true,
        category: true,
        updatedAt: true,
        location: { select: { name: true, type: true } },
        rack: { select: { name: true } },
        maintenanceRecords: {
          where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
          select: { id: true, title: true, status: true, priority: true, scheduledAt: true },
          orderBy: { scheduledAt: "asc" },
          take: 1,
        },
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.maintenanceRecord.findMany({
      where: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        OR: [
          { type: "REPAIR" },
          { asset: { status: "BROKEN" } },
        ],
      },
      include: {
        asset: { select: { name: true, serialNumber: true, status: true } },
      },
      take: 5,
      orderBy: [
        { priority: "desc" },
        { scheduledAt: "asc" },
      ],
    }),
    prisma.operationalNotification.findMany({
      where: { resolvedAt: null },
      take: 6,
      orderBy: [
        { severity: "asc" },
        { createdAt: "desc" },
      ],
    }),
  ]);

  const items = await getAuditFeedItems(prisma, 30);

  const recentItems = items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 8);

  const stats = [
    { 
      title: "Total Infrastructure", 
      value: totalAssets.toLocaleString(), 
      icon: Server 
    },
    { 
      title: "Public IP Pool", 
      value: `${assignedPublicIPs} / ${totalPublicIPs}`, 
      icon: Globe, 
      iconColor: "text-emerald-400" 
    },
    { 
      title: "Maintenance Alerts", 
      value: brokenAssets.toString(), 
      icon: ShieldAlert, 
      iconColor: "text-amber-400" 
    },
    { 
      title: "Managed Licenses", // Replaced Network Uptime
      value: totalLicenses.toLocaleString(), 
      icon: Key, 
      iconColor: "text-purple-400" 
    },
  ];

  const formatDate = (date?: Date | null) => {
    if (!date) return "No date";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const daysFromNow = (date?: Date | null) => {
    if (!date) return null;
    return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  };

  const licenseContext = (license: (typeof expiredLicenseItems)[number] | (typeof expiringLicenseItems)[number]) => {
    if (license.asset) return `${license.asset.name} (${license.asset.serialNumber})`;
    if (license.products.length) return license.products.map((product) => product.code).join(", ");
    return "Unassigned";
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <StatsCard key={idx} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-[#151921] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Expired Items</h3>
              <p className="text-xs text-slate-500">Licenses already past their expiry date</p>
            </div>
            <AlertTriangle size={18} className="text-red-300" />
          </div>
          <div className="space-y-3">
            {expiredLicenseItems.length ? (
              expiredLicenseItems.map((license) => (
                <Link
                  key={license.id}
                  href="/licenses"
                  className="block rounded-lg border border-red-500/15 bg-red-500/10 p-3 transition-colors hover:border-red-400/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{license.name}</div>
                      <div className="mt-1 truncate text-xs text-red-100/70">{licenseContext(license)}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase text-red-200">
                      {formatDate(license.expiryDate)}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
                No expired licenses found.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#151921] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Expiring Licenses</h3>
              <p className="text-xs text-slate-500">Renewals due within the next 30 days</p>
            </div>
            <CalendarClock size={18} className="text-amber-300" />
          </div>
          <div className="space-y-3">
            {expiringLicenseItems.length ? (
              expiringLicenseItems.map((license) => {
                const days = daysFromNow(license.expiryDate);
                return (
                  <Link
                    key={license.id}
                    href="/licenses"
                    className="block rounded-lg border border-amber-500/15 bg-amber-500/10 p-3 transition-colors hover:border-amber-400/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{license.name}</div>
                        <div className="mt-1 truncate text-xs text-amber-100/70">{licenseContext(license)}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold uppercase text-amber-200">
                        {days === null ? formatDate(license.expiryDate) : `${days}d`}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
                No licenses are expiring in the next 30 days.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#151921] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Repair Focus</h3>
              <p className="text-xs text-slate-500">Broken assets and open repair records</p>
            </div>
            <Wrench size={18} className="text-blue-300" />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Link href="/assets/hardware?status=BROKEN" className="rounded-lg border border-red-500/15 bg-red-500/10 p-3">
              <div className="text-2xl font-bold text-white">{brokenAssets}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-200">Broken Assets</div>
            </Link>
            <Link href="/maintenance" className="rounded-lg border border-blue-500/15 bg-blue-500/10 p-3">
              <div className="text-2xl font-bold text-white">{repairRecords.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Open Repairs</div>
            </Link>
          </div>
          <div className="space-y-3">
            {brokenAssetItems.length ? (
              brokenAssetItems.map((asset) => {
                const repair = asset.maintenanceRecords[0];
                return (
                  <Link
                    key={asset.id}
                    href={`/assets/hardware?q=${encodeURIComponent(asset.serialNumber)}`}
                    className="block rounded-lg border border-slate-800 bg-slate-900/40 p-3 transition-colors hover:border-slate-600"
                  >
                    <div className="text-sm font-bold text-white">{asset.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {asset.serialNumber} · {asset.location?.name ?? "Unassigned"}{asset.rack?.name ? ` / ${asset.rack.name}` : ""}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      {repair ? `${formatEnum(repair.status)} repair: ${repair.title}` : "No open repair record"}
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
                No broken assets need repair.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#151921] border border-slate-800 rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">Global Audit Feed</h3>
            <Link
              href="/api/activity/export"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              <Download size={14} />
              Export
            </Link>
          </div>
          <AuditTrail items={recentItems} />
        </div>
        
        <div className="bg-[#151921] border border-slate-800 rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Operational Notices</h3>
            <Bell size={18} className="text-amber-300" />
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <Link href="/licenses" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
              <div className="text-2xl font-bold text-white">{expiredLicenses}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-200">Expired Licenses</div>
            </Link>
            <Link href="/licenses" className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
              <div className="text-2xl font-bold text-white">{expiringLicenses}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Expiring Soon</div>
            </Link>
          </div>
          <div className="space-y-3">
            {operationalNotifications.length > 0 ? (
              operationalNotifications.map((notice) => (
                <Link
                  key={notice.id}
                  href={notice.href || "/licenses"}
                  className="block rounded-2xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{notice.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{notice.message}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      notice.severity === "CRITICAL"
                        ? "bg-red-500/10 text-red-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}>
                      {notice.severity}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
                No active license expiration notices.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
