export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const escapeLabel = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const metric = (name: string, value: number, labels: Record<string, string> = {}) => {
  const labelEntries = Object.entries(labels);
  const renderedLabels = labelEntries.length
    ? `{${labelEntries.map(([key, labelValue]) => `${key}="${escapeLabel(labelValue)}"`).join(",")}}`
    : "";

  return `${name}${renderedLabels} ${value}`;
};

export async function GET(request: Request) {
  const expectedToken = process.env.OBSERVABILITY_TOKEN;
  const authHeader = request.headers.get("authorization");
  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!expectedToken || providedToken !== expectedToken) {
    return new NextResponse("Not found\n", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const checkedAt = Date.now();

  try {
    const [assetCount, licenseCount, openMaintenanceCount, unresolvedNotificationCount] = await Promise.all([
      prisma.asset.count(),
      prisma.license.count(),
      prisma.maintenanceRecord.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } } }),
      prisma.operationalNotification.count({ where: { resolvedAt: null } }),
    ]);

    const lines = [
      "# HELP eialm_up Application health status.",
      "# TYPE eialm_up gauge",
      metric("eialm_up", 1),
      "# HELP eialm_database_up Database connectivity status.",
      "# TYPE eialm_database_up gauge",
      metric("eialm_database_up", 1),
      "# HELP eialm_entity_total Current entity totals by type.",
      "# TYPE eialm_entity_total gauge",
      metric("eialm_entity_total", assetCount, { entity: "assets" }),
      metric("eialm_entity_total", licenseCount, { entity: "licenses" }),
      metric("eialm_entity_total", openMaintenanceCount, { entity: "open_maintenance" }),
      metric("eialm_entity_total", unresolvedNotificationCount, { entity: "unresolved_notifications" }),
      "# HELP eialm_uptime_seconds Application process uptime.",
      "# TYPE eialm_uptime_seconds gauge",
      metric("eialm_uptime_seconds", Math.round(process.uptime())),
      "# HELP eialm_metrics_checked_at_seconds Metrics collection timestamp.",
      "# TYPE eialm_metrics_checked_at_seconds gauge",
      metric("eialm_metrics_checked_at_seconds", Math.floor(checkedAt / 1000)),
    ];

    return new NextResponse(`${lines.join("\n")}\n`, {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    });
  } catch {
    const lines = [
      "# HELP eialm_up Application health status.",
      "# TYPE eialm_up gauge",
      metric("eialm_up", 1),
      "# HELP eialm_database_up Database connectivity status.",
      "# TYPE eialm_database_up gauge",
      metric("eialm_database_up", 0),
    ];

    return new NextResponse(`${lines.join("\n")}\n`, {
      status: 503,
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    });
  }
}
