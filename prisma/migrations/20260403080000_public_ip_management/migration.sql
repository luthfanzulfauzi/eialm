-- CreateEnum
CREATE TYPE "IPStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'BLOCKED');

-- CreateTable
CREATE TABLE "PublicIPRange" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "prefix" INTEGER NOT NULL,
    "cidr" TEXT NOT NULL,
    "startInt" BIGINT NOT NULL,
    "endInt" BIGINT NOT NULL,
    "startAddress" TEXT NOT NULL,
    "endAddress" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicIPRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicIPRange_cidr_key" ON "PublicIPRange"("cidr");

-- CreateIndex
CREATE UNIQUE INDEX "PublicIPRange_network_prefix_key" ON "PublicIPRange"("network", "prefix");

-- CreateIndex
CREATE INDEX "PublicIPRange_startInt_idx" ON "PublicIPRange"("startInt");

-- CreateIndex
CREATE INDEX "PublicIPRange_endInt_idx" ON "PublicIPRange"("endInt");

-- AlterTable
ALTER TABLE "IPAddress" ADD COLUMN     "publicRangeId" TEXT,
ADD COLUMN     "status" "IPStatus" NOT NULL DEFAULT 'AVAILABLE';

-- Data migration
UPDATE "IPAddress" SET "status" = 'ASSIGNED' WHERE "assetId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "IPAddress" ADD CONSTRAINT "IPAddress_publicRangeId_fkey" FOREIGN KEY ("publicRangeId") REFERENCES "PublicIPRange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

