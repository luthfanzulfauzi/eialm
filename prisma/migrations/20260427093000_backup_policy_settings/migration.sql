CREATE TYPE "BackupFrequencyUnit" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY');

CREATE TABLE "BackupPolicy" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "retentionCount" INTEGER NOT NULL DEFAULT 14,
  "frequencyUnit" "BackupFrequencyUnit" NOT NULL DEFAULT 'DAILY',
  "frequencyInterval" INTEGER NOT NULL DEFAULT 1,
  "runHour" INTEGER NOT NULL DEFAULT 0,
  "runMinute" INTEGER NOT NULL DEFAULT 30,
  "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BackupPolicy_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BackupPolicy" (
  "id",
  "enabled",
  "retentionCount",
  "frequencyUnit",
  "frequencyInterval",
  "runHour",
  "runMinute",
  "dayOfMonth"
) VALUES (
  'default',
  true,
  14,
  'DAILY',
  1,
  0,
  30,
  1
);
