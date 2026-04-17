-- CreateTable
CREATE TABLE "PrivateIPRange" (
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

    CONSTRAINT "PrivateIPRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivateIPRange_cidr_key" ON "PrivateIPRange"("cidr");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateIPRange_network_prefix_key" ON "PrivateIPRange"("network", "prefix");

-- CreateIndex
CREATE INDEX "PrivateIPRange_startInt_idx" ON "PrivateIPRange"("startInt");

-- CreateIndex
CREATE INDEX "PrivateIPRange_endInt_idx" ON "PrivateIPRange"("endInt");

-- AlterTable
ALTER TABLE "IPAddress" ADD COLUMN "privateRangeId" TEXT;

-- AddForeignKey
ALTER TABLE "IPAddress"
ADD CONSTRAINT "IPAddress_privateRangeId_fkey"
FOREIGN KEY ("privateRangeId") REFERENCES "PrivateIPRange"("id") ON DELETE SET NULL ON UPDATE CASCADE;
