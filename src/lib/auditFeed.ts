import type { PrismaClient } from "@prisma/client";
import { formatAssetSerialNumber, isAssetSerialNumberNotAvailable } from "@/lib/utils";

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
  assignmentTargetLabel?: string | null;
  assignmentTargetType?: string | null;
  cidr?: string;
  createdCount?: number;
  ipId?: string;
  network?: string;
  rangeId?: string;
  status?: string;
};

type FacilityDetails = {
  name?: string;
  type?: string;
  address?: string | null;
  locationName?: string;
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

export type AuditFeedItem = {
  id: string;
  action: string;
  scope: string;
  title: string;
  details?: string;
  actor?: string;
  createdAt: Date;
};

const safeParseJson = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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

const displaySerialNumber = (value?: string | null) => {
  if (!value) return null;
  return formatAssetSerialNumber(value);
};

const withSerialNumber = (name: string, serialNumber?: string | null) => {
  if (!serialNumber || isAssetSerialNumberNotAvailable(serialNumber)) return name;
  const displayValue = displaySerialNumber(serialNumber);
  return displayValue ? `${name} (${displayValue})` : name;
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
      changes.push(`Name: ${details?.before?.name ?? "—"} -> ${details?.after?.name ?? "—"}`);
    }
    if (details?.before?.address !== details?.after?.address) {
      changes.push(`Address: ${details?.before?.address ?? "—"} -> ${details?.after?.address ?? "—"}`);
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
      changes.push(`Name: ${details?.before?.name ?? "—"} -> ${details?.after?.name ?? "—"}`);
    }
    if (details?.before?.totalUnits !== details?.after?.totalUnits) {
      changes.push(`Height: ${details?.before?.totalUnits ?? "—"}U -> ${details?.after?.totalUnits ?? "—"}U`);
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

export async function getAuditFeedItems(prisma: PrismaClient, take = 30) {
  const rawLogs = await prisma.auditLog.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      asset: { select: { name: true, serialNumber: true } },
    },
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
        title: `Moved ${withSerialNumber(name, serialNumber)}`,
        details: `${fromPlacement} -> ${toPlacement}${statusChanged ? ` · Status: ${toTitleCase(before.status!)} -> ${toTitleCase(after.status!)}` : ""}`,
      };
    }

    const changes: string[] = [];
    const pushIfChanged = (label: string, from?: string | null, to?: string | null) => {
      if (from === to) return;
      if (from == null && to == null) return;
      changes.push(`${label}: ${from ?? "—"} -> ${to ?? "—"}`);
    };

    pushIfChanged("Status", before.status ?? null, after.status ?? null);
    pushIfChanged("Name", before.name ?? null, after.name ?? null);
    pushIfChanged("Serial", displaySerialNumber(before.serialNumber ?? null), displaySerialNumber(after.serialNumber ?? null));
    pushIfChanged("Category", before.category ?? null, after.category ?? null);

    return {
      title: `Updated ${withSerialNumber(name, serialNumber)}`,
      details: changes.length ? changes.join(" · ") : "Details updated",
    };
  };

  return parsed.map(({ log, asUpdate, asDelete, asNetwork, asFacility }) => {
    const actor = log.user?.name ?? undefined;
    const by = actor ? `by ${actor}` : null;
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
        actor,
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
        actor,
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
        actor,
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
        actor,
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
        actor,
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
        actor,
        createdAt: log.createdAt,
      };
    }

    return {
      id: log.id,
      action: log.action,
      scope,
      title: log.action,
      details: withBy(log.details.length > 140 ? `${log.details.slice(0, 140)}...` : log.details),
      actor,
      createdAt: log.createdAt,
    };
  });
}
