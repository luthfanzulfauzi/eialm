import { prisma } from "@/lib/prisma";

type AuditDetails = Record<string, unknown> | string;

export async function writeAuditLog(input: {
  action: string;
  userId: string;
  assetId?: string | null;
  details: AuditDetails;
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId,
        assetId: input.assetId ?? null,
        details: typeof input.details === "string" ? input.details : JSON.stringify(input.details),
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
    return null;
  }
}
