import { StatsCard } from "@/components/dashboard/StatsCard";
import { AuditTrail } from "@/components/dashboard/AuditTrail";
import { Server, Globe, ShieldAlert, Key } from "lucide-react"; // Imported Key for Licenses
import { prisma } from "@/lib/prisma";

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

const safeParseJson = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export default async function DashboardPage() {
  // 1. Fetch real-time metrics from the database
  const [totalAssets, assignedPublicIPs, totalPublicIPs, brokenAssets, totalLicenses] = await Promise.all([
    prisma.asset.count(),
    prisma.iPAddress.count({ where: { isPublic: true, status: "ASSIGNED" } }),
    prisma.iPAddress.count({ where: { isPublic: true } }),
    prisma.asset.count({ where: { status: 'BROKEN' } }),
    prisma.license.count(), // Counting total managed licenses
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
    return { log, asUpdate, asDelete, asNetwork };
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
    if (["CREATE", "UPDATE", "MOVE", "DELETE"].includes(action)) return "Asset Event";
    return "Platform Event";
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
        title: `Moved ${name}${serialNumber ? ` (${serialNumber})` : ""}`,
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
    pushIfChanged("Serial", before.serialNumber ?? null, after.serialNumber ?? null);
    pushIfChanged("Category", before.category ?? null, after.category ?? null);

    return {
      isMovement: false,
      title: `Updated ${name}${serialNumber ? ` (${serialNumber})` : ""}`,
      details: changes.length ? changes.join(" · ") : "Details updated",
    };
  };

  const items = parsed.map(({ log, asUpdate, asDelete, asNetwork }) => {
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

    if (log.action === "MOVE") {
      const name = log.asset?.name ?? "Asset";
      const serialNumber = log.asset?.serialNumber;
      return {
        id: log.id,
        action: log.action,
        scope,
        title: `Moved ${name}${serialNumber ? ` (${serialNumber})` : ""}`,
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
        title: `Created ${name}${serialNumber ? ` (${serialNumber})` : ""}`,
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
        title: `Deleted ${name}${serialNumber ? ` (${serialNumber})` : ""}`,
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <StatsCard key={idx} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#151921] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Global Audit Feed</h3>
          <AuditTrail items={recentItems} />
        </div>
        
        <div className="bg-[#151921] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
          <div className="space-y-3">
             <button className="w-full py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">
               Generate Inventory Report
             </button>
             <button className="w-full py-3 bg-slate-800 rounded-xl font-bold text-sm border border-slate-700 hover:bg-slate-700 transition-all">
               Audit IP Assignments
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
