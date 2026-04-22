CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'INSPECTION', 'REPAIR', 'OTHER');

CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "MaintenanceRecord" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "MaintenanceType" NOT NULL DEFAULT 'PREVENTIVE',
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
  "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
  "description" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "resolution" TEXT,
  "assetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceRecord_assetId_idx" ON "MaintenanceRecord"("assetId");
CREATE INDEX "MaintenanceRecord_status_idx" ON "MaintenanceRecord"("status");
CREATE INDEX "MaintenanceRecord_scheduledAt_idx" ON "MaintenanceRecord"("scheduledAt");
CREATE INDEX "MaintenanceRecord_type_idx" ON "MaintenanceRecord"("type");

ALTER TABLE "MaintenanceRecord"
ADD CONSTRAINT "MaintenanceRecord_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
