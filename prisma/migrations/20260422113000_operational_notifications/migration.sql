CREATE TABLE "SystemJobRun" (
  "key" TEXT NOT NULL,
  "lastRunAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SystemJobRun_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "OperationalNotification" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalNotification_dedupeKey_key" ON "OperationalNotification"("dedupeKey");
CREATE INDEX "OperationalNotification_severity_idx" ON "OperationalNotification"("severity");
CREATE INDEX "OperationalNotification_resolvedAt_idx" ON "OperationalNotification"("resolvedAt");
CREATE INDEX "OperationalNotification_createdAt_idx" ON "OperationalNotification"("createdAt");
