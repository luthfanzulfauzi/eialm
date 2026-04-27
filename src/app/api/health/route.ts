export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BackupPolicyService } from "@/services/backupPolicyService";

let scheduledBackupPromise: Promise<unknown> | null = null;

const triggerScheduledBackupCheck = () => {
  if (scheduledBackupPromise) return;

  scheduledBackupPromise = BackupPolicyService.runDueBackupIfNeeded()
    .catch((error) => {
      console.error("Scheduled backup check failed:", error);
    })
    .finally(() => {
      scheduledBackupPromise = null;
    });
};

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    triggerScheduledBackupCheck();

    return NextResponse.json({
      status: "ok",
      database: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        message: "Database health check failed",
        responseTimeMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
