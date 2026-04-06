-- CreateEnum
CREATE TYPE "IPAssignmentTargetType" AS ENUM ('HARDWARE', 'VM', 'OTHER');

-- AlterTable
ALTER TABLE "IPAddress"
ADD COLUMN "assignmentTargetType" "IPAssignmentTargetType",
ADD COLUMN "assignmentTargetLabel" TEXT;

-- Backfill existing hardware-linked IPs
UPDATE "IPAddress"
SET "assignmentTargetType" = 'HARDWARE'
WHERE "assetId" IS NOT NULL;
