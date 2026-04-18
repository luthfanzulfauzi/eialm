-- CreateEnum
CREATE TYPE "ProductEnvironment" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT', 'SHARED');

-- CreateEnum
CREATE TYPE "ProductLifecycle" AS ENUM ('PLANNING', 'ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProductCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "businessDomain" TEXT,
    "environment" "ProductEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "lifecycle" "ProductLifecycle" NOT NULL DEFAULT 'PLANNING',
    "criticality" "ProductCriticality" NOT NULL DEFAULT 'MEDIUM',
    "businessOwner" TEXT NOT NULL,
    "technicalOwner" TEXT NOT NULL,
    "supportTeam" TEXT,
    "documentationUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AssetToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_LicenseToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_lifecycle_idx" ON "Product"("lifecycle");

-- CreateIndex
CREATE INDEX "Product_criticality_idx" ON "Product"("criticality");

-- CreateIndex
CREATE UNIQUE INDEX "_AssetToProduct_AB_unique" ON "_AssetToProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_AssetToProduct_B_index" ON "_AssetToProduct"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_LicenseToProduct_AB_unique" ON "_LicenseToProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_LicenseToProduct_B_index" ON "_LicenseToProduct"("B");

ALTER TABLE "_AssetToProduct" ADD CONSTRAINT "_AssetToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetToProduct" ADD CONSTRAINT "_AssetToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LicenseToProduct" ADD CONSTRAINT "_LicenseToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LicenseToProduct" ADD CONSTRAINT "_LicenseToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
