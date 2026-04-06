-- CreateEnum
CREATE TYPE "RackFace" AS ENUM ('FRONT', 'BACK', 'BOTH');

-- DropIndex
DROP INDEX "Asset_rackId_rackUnitStart_idx";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "rackFace" "RackFace";

-- CreateIndex
CREATE INDEX "Asset_rackId_rackFace_rackUnitStart_idx" ON "Asset"("rackId", "rackFace", "rackUnitStart");
