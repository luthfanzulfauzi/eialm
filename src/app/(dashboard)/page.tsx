export const dynamic = "force-dynamic";

import { StatsCard } from "@/components/dashboard/StatsCard";
import { AuditTrail } from "@/components/dashboard/AuditTrail";
import { AlertTriangle, Bell, CalendarClock, Globe, Key, Server, ShieldAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAssetSerialNumber, isAssetSerialNumberNotAvailable } from "@/lib/utils";
import { LicenseService } from "@/services/licenseService";

type UpdateDetails = {
  before?: {
    id?: string;
    name?: string;
    serialNumber?: string;
    category?: string;
    status?: string;
    locationId?: string | null;
    rackId?: string | null;
  };
  after?: {
    name?: string;
    serialNumber?: string;
    category?: string;
    status?: string;
    locationId?: string | null;
    rackId?: string | null;
  };
};

type DeleteDetails = {
  assetId?: string;
  name?: string;
  serialNumber?: string;
  category?: string;
};

type NetworkDetails = {
  address?: string;
  assetId?: string | null;
  assignmentTargetLabel?: string | null;
  assignmentTargetType?: string | null;
  cidr?: string;
  createdCount?: number;
  ipId?: string;
  mode?: string;
  network?: string;
  prefix?: number;
  rangeId?: string;
  size?: number;
  status?: string;
};

type FacilityDetails = {
  locationId?: string;
  name?: string;
  type?: string;
  address?: string | null;
  locationName?: string;
  rackId?: string;
  totalUnits?: number;
  before?: {
    name?: string;
    address?: string | null;
    totalUnits?: number;
  };
  after?: {
    name?: string;
    address?: string | null;
    totalUnits?: number;
  };
};

const safeParseJson = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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

  // 2. Fetch real recent audit logs for the global activity feed
  const rawLogs = await prisma.auditLog.findMany({
    take: 30,
    orderBy: { createdAt: 'desc' },
    include: { 
      user: { select: { name: true } },
      asset: { select: { name: true, serialNumber: true } }
    }
  });

  const parsed = rawLogs.map((log) => {
    const asUpdate = safeParseJson<UpdateDetails>(log.details);
    const asDelete = safeParseJson<DeleteDetails>(log.details);
    const asNetwork = safeParseJson<NetworkDetails>(log.details);
    const asFacility = safeParseJson<FacilityDetails>(log.details);
    return { log, asUpdate, asDelete, asNetwork, asFacility };
  });

  const rackIds = new Set<string>();
  const locationIds = new Set<string>();

  for (const { log, asUpdate } of parsed) {
    if (log.action !== "UPDATE" || !asUpdate) continue;
    const before = asUpdate.before;
    const after = asUpdate.after;
    if (before?.rackId) rackIds.add(before.rackId);
    if (after?.rackId) rackIds.add(after.rackId);
    if (before?.locationId) locationIds.add(before.locationId);
    if (after?.locationId) locationIds.add(after.locationId);
  }

  const [racks, locations] = await Promise.all([
    rackIds.size
      ? prisma.rack.findMany({
          where: { id: { in: Array.from(rackIds) } },
          select: { id: true, name: true, location: { select: { name: true } } },
        })
      : Promise.resolve([]),
    locationIds.size
      ? prisma.location.findMany({
          where: { id: { in: Array.from(locationIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const rackLabelById = new Map<string, string>(
    racks.map((r) => [r.id, `${r.location.name} / ${r.name}`])
  );
  const locationLabelById = new Map<string, string>(locations.map((l) => [l.id, l.name]));

  const placementLabel = (locationId?: string | null, rackId?: string | null) => {
    if (rackId && rackLabelById.has(rackId)) return rackLabelById.get(rackId)!;
    if (locationId && locationLabelById.has(locationId)) return locationLabelById.get(locationId)!;
    return "Unassigned";
  };

  const toTitleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  const displaySerialNumber = (value?: string | null) => {
    if (!value) return null;
    return formatAssetSerialNumber(value);
  };

  const withSerialNumber = (name: string, serialNumber?: string | null) => {
    if (!serialNumber || isAssetSerialNumberNotAvailable(serialNumber)) return name;
    const displayValue = displaySerialNumber(serialNumber);
    return displayValue ? `${name} (${displayValue})` : name;
  };

  const formatEnum = (value?: string | null) => {
    if (!value) return null;
    return value
      .split("_")
      .filter(Boolean)
      .map((part) => (part === "VM" ? "VM" : toTitleCase(part)))
      .join(" ");
  };

  const auditScope = (action: string) => {
    if (action.startsWith("NETWORK_")) return "Network Event";
    if (action.startsWith("FACILITY_") || action.startsWith("RACK_")) return "Facility Event";
    if (["CREATE", "UPDATE", "MOVE", "DELETE"].includes(action)) return "Asset Event";
    return "Platform Event";
  };

  const formatFacilityEvent = (action: string, details: FacilityDetails | null) => {
    const type =
      action.startsWith("RACK_")
        ? "Rack"
        : details?.type === "WAREHOUSE"
          ? "Warehouse"
          : "Datacenter";

    if (action === "FACILITY_CREATE") {
      return {
        title: `Created ${type.toLowerCase()} ${details?.name ?? "facility"}`,
        details: details?.address ? `Address: ${details.address}` : undefined,
      };
    }

    if (action === "FACILITY_UPDATE") {
      const changes: string[] = [];
      if (details?.before?.name !== details?.after?.name) {
        changes.push(`Name: ${details?.before?.name ?? "—"} → ${details?.after?.name ?? "—"}`);
      }
      if (details?.before?.address !== details?.after?.address) {
        changes.push(`Address: ${details?.before?.address ?? "—"} → ${details?.after?.address ?? "—"}`);
      }
      return {
        title: `Updated ${type.toLowerCase()} ${details?.after?.name ?? details?.name ?? "facility"}`,
        details: changes.join(" · ") || "Facility details updated",
      };
    }

    if (action === "FACILITY_DELETE") {
      return {
        title: `Deleted ${type.toLowerCase()} ${details?.name ?? "facility"}`,
        details: details?.address ? `Address: ${details.address}` : undefined,
      };
    }

    if (action === "RACK_CREATE") {
      return {
        title: `Created rack ${details?.name ?? "rack"}`,
        details: [details?.locationName ? `Site: ${details.locationName}` : null, typeof details?.totalUnits === "number" ? `Height: ${details.totalUnits}U` : null]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (action === "RACK_UPDATE") {
      const changes: string[] = [];
      if (details?.before?.name !== details?.after?.name) {
        changes.push(`Name: ${details?.before?.name ?? "—"} → ${details?.after?.name ?? "—"}`);
      }
      if (details?.before?.totalUnits !== details?.after?.totalUnits) {
        changes.push(`Height: ${details?.before?.totalUnits ?? "—"}U → ${details?.after?.totalUnits ?? "—"}U`);
      }
      return {
        title: `Updated rack ${details?.after?.name ?? details?.name ?? "rack"}`,
        details: [details?.locationName ? `Site: ${details.locationName}` : null, changes.join(" · ") || null]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (action === "RACK_DELETE") {
      return {
        title: `Deleted rack ${details?.name ?? "rack"}`,
        details: [details?.locationName ? `Site: ${details.locationName}` : null, typeof details?.totalUnits === "number" ? `Height: ${details.totalUnits}U` : null]
          .filter(Boolean)
          .join(" · "),
      };
    }

    return {
      title: action,
      details: undefined,
    };
  };

  const formatNetworkEvent = (action: string, details: NetworkDetails | null) => {
    const networkType = action.includes("_PUBLIC_") ? "Public" : action.includes("_PRIVATE_") ? "Private" : "Network";
    const addressOrRange = details?.address ?? details?.cidr ?? details?.network ?? "IP inventory";
    const status = formatEnum(details?.status);
    const targetType = formatEnum(details?.assignmentTargetType);
    const target = details?.assignmentTargetLabel;
    const count = typeof details?.createdCount === "number" ? `${details.createdCount} address${details.createdCount === 1 ? "" : "es"}` : null;

    const detailParts = [
      status ? `Status: ${status}` : null,
      targetType || target ? `Target: ${targetType ?? "Target"}${target ? ` - ${target}` : ""}` : null,
      count ? `Created: ${count}` : null,
    ].filter(Boolean);

    if (action.endsWith("_RANGE_CREATE")) {
      return {
        title: `Created ${networkType.toLowerCase()} IP range ${addressOrRange}`,
        details: detailParts.join(" · "),
      };
    }

    if (action.endsWith("_RANGE_UPDATE")) {
      return {
        title: `Updated ${networkType.toLowerCase()} IP range ${addressOrRange}`,
        details: detailParts.join(" · "),
      };
    }

    if (action.endsWith("_RANGE_DELETE")) {
      return {
        title: `Deleted ${networkType.toLowerCase()} IP range`,
        details: details?.rangeId ? `Range ID: ${details.rangeId}` : undefined,
      };
    }

    if (action.endsWith("_IP_CREATE")) {
      return {
        title: `Registered ${networkType.toLowerCase()} IP ${addressOrRange}`,
        details: detailParts.join(" · "),
      };
    }

    if (action === "NETWORK_IP_ASSIGNMENT_UPDATE") {
      return {
        title: `Updated IP assignment for ${addressOrRange}`,
        details: detailParts.join(" · "),
      };
    }

    if (action.endsWith("_IP_UPDATE")) {
      return {
        title: `Updated ${networkType.toLowerCase()} IP ${addressOrRange}`,
        details: detailParts.join(" · "),
      };
    }

    if (action.endsWith("_IP_DELETE")) {
      return {
        title: `Deleted ${networkType.toLowerCase()} IP`,
        details: details?.ipId ? `IP ID: ${details.ipId}` : undefined,
      };
    }

    return {
      title: action,
      details: detailParts.join(" · "),
    };
  };

  const formatUpdate = (log: (typeof parsed)[number]["log"], details: UpdateDetails) => {
    const before = details.before ?? {};
    const after = details.after ?? {};

    const name = log.asset?.name ?? after.name ?? before.name ?? "Asset";
    const serialNumber = log.asset?.serialNumber ?? after.serialNumber ?? before.serialNumber;

    const moved =
      before.locationId !== after.locationId || before.rackId !== after.rackId;
    const statusChanged = before.status && after.status && before.status !== after.status;

    const fromPlacement = placementLabel(before.locationId ?? null, before.rackId ?? null);
    const toPlacement = placementLabel(after.locationId ?? null, after.rackId ?? null);

    if (moved) {
      return {
        isMovement: true,
        title: `Moved ${withSerialNumber(name, serialNumber)}`,
        details: `${fromPlacement} → ${toPlacement}${statusChanged ? ` · Status: ${toTitleCase(before.status!)} → ${toTitleCase(after.status!)}` : ""}`,
      };
    }

    const changes: string[] = [];
    const pushIfChanged = (label: string, from?: string | null, to?: string | null) => {
      if (from === to) return;
      if (from == null && to == null) return;
      changes.push(`${label}: ${from ?? "—"} → ${to ?? "—"}`);
    };

    pushIfChanged("Status", before.status ?? null, after.status ?? null);
    pushIfChanged("Name", before.name ?? null, after.name ?? null);
    pushIfChanged("Serial", displaySerialNumber(before.serialNumber ?? null), displaySerialNumber(after.serialNumber ?? null));
    pushIfChanged("Category", before.category ?? null, after.category ?? null);

    return {
      isMovement: false,
      title: `Updated ${withSerialNumber(name, serialNumber)}`,
      details: changes.length ? changes.join(" · ") : "Details updated",
    };
  };

  const items = parsed.map(({ log, asUpdate, asDelete, asNetwork, asFacility }) => {
    const by = log.user?.name ? `by ${log.user.name}` : null;
    const withBy = (details?: string) => (by ? (details ? `${details} · ${by}` : by) : details);
    const scope = auditScope(log.action);

    if (log.action.startsWith("NETWORK_")) {
      const formatted = formatNetworkEvent(log.action, asNetwork);
      return {
        id: log.id,
        action: log.action,
        scope,
        title: formatted.title,
        details: withBy(formatted.details || undefined),
        createdAt: log.createdAt,
      };
    }

    if (log.action.startsWith("FACILITY_") || log.action.startsWith("RACK_")) {
      const formatted = formatFacilityEvent(log.action, asFacility);
      return {
        id: log.id,
        action: log.action,
        scope,
        title: formatted.title,
        details: withBy(formatted.details || undefined),
        createdAt: log.createdAt,
      };
    }

    if (log.action === "MOVE") {
      const name = log.asset?.name ?? "Asset";
      const serialNumber = log.asset?.serialNumber;
      return {
        id: log.id,
        action: log.action,
        scope,
        title: `Moved ${withSerialNumber(name, serialNumber)}`,
        details: withBy(log.details),
        createdAt: log.createdAt,
      };
    }

    if (log.action === "CREATE") {
      const name = log.asset?.name ?? "Asset";
      const serialNumber = log.asset?.serialNumber;
      return {
        id: log.id,
        action: log.action,
        scope,
        title: `Created ${withSerialNumber(name, serialNumber)}`,
        details: withBy(log.details),
        createdAt: log.createdAt,
      };
    }

    if (log.action === "DELETE") {
      const name = asDelete?.name ?? "Asset";
      const serialNumber = asDelete?.serialNumber;
      return {
        id: log.id,
        action: log.action,
        scope,
        title: `Deleted ${withSerialNumber(name, serialNumber)}`,
        details: withBy(asDelete?.category ? `Category: ${asDelete.category}` : undefined),
        createdAt: log.createdAt,
      };
    }

    if (log.action === "UPDATE" && asUpdate) {
      const formatted = formatUpdate(log, asUpdate);
      return {
        id: log.id,
        action: log.action,
        scope,
        title: formatted.title,
        details: withBy(formatted.details),
        createdAt: log.createdAt,
      };
    }

    return {
      id: log.id,
      action: log.action,
      scope,
      title: log.action,
      details: withBy(log.details.length > 140 ? `${log.details.slice(0, 140)}…` : log.details),
      createdAt: log.createdAt,
    };
  });

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
          <h3 className="text-lg font-bold text-white mb-6">Global Audit Feed</h3>
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
