-- CreateEnum
CREATE TYPE "ProductOptionType" AS ENUM ('CATEGORY', 'BUSINESS_DOMAIN', 'SUPPORT_TEAM', 'BUSINESS_OWNER', 'TECHNICAL_OWNER');

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "type" "ProductOptionType" NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_type_value_key" ON "ProductOption"("type", "value");

-- CreateIndex
CREATE INDEX "ProductOption_type_sortOrder_value_idx" ON "ProductOption"("type", "sortOrder", "value");

-- Add columns to Product
ALTER TABLE "Product"
  ADD COLUMN "categoryOptionId" TEXT,
  ADD COLUMN "businessDomainOptionId" TEXT,
  ADD COLUMN "supportTeamOptionId" TEXT,
  ADD COLUMN "businessOwnerOptionId" TEXT,
  ADD COLUMN "technicalOwnerOptionId" TEXT;

-- Seed option values from existing Product string fields
INSERT INTO "ProductOption" ("id", "type", "value", "sortOrder", "createdAt", "updatedAt")
SELECT
  'prodopt_cat_' || md5("category"),
  'CATEGORY'::"ProductOptionType",
  "category",
  0,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "category"
  FROM "Product"
  WHERE "category" IS NOT NULL AND btrim("category") <> ''
) categories;

INSERT INTO "ProductOption" ("id", "type", "value", "sortOrder", "createdAt", "updatedAt")
SELECT
  'prodopt_domain_' || md5("businessDomain"),
  'BUSINESS_DOMAIN'::"ProductOptionType",
  "businessDomain",
  0,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "businessDomain"
  FROM "Product"
  WHERE "businessDomain" IS NOT NULL AND btrim("businessDomain") <> ''
) domains;

INSERT INTO "ProductOption" ("id", "type", "value", "sortOrder", "createdAt", "updatedAt")
SELECT
  'prodopt_support_' || md5("supportTeam"),
  'SUPPORT_TEAM'::"ProductOptionType",
  "supportTeam",
  0,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "supportTeam"
  FROM "Product"
  WHERE "supportTeam" IS NOT NULL AND btrim("supportTeam") <> ''
) teams;

INSERT INTO "ProductOption" ("id", "type", "value", "sortOrder", "createdAt", "updatedAt")
SELECT
  'prodopt_bizown_' || md5("businessOwner"),
  'BUSINESS_OWNER'::"ProductOptionType",
  "businessOwner",
  0,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "businessOwner"
  FROM "Product"
  WHERE "businessOwner" IS NOT NULL AND btrim("businessOwner") <> ''
) owners;

INSERT INTO "ProductOption" ("id", "type", "value", "sortOrder", "createdAt", "updatedAt")
SELECT
  'prodopt_techown_' || md5("technicalOwner"),
  'TECHNICAL_OWNER'::"ProductOptionType",
  "technicalOwner",
  0,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "technicalOwner"
  FROM "Product"
  WHERE "technicalOwner" IS NOT NULL AND btrim("technicalOwner") <> ''
) owners;

-- Backfill Product foreign keys from seeded options
UPDATE "Product" p
SET "categoryOptionId" = o."id"
FROM "ProductOption" o
WHERE o."type" = 'CATEGORY'
  AND o."value" = p."category";

UPDATE "Product" p
SET "businessDomainOptionId" = o."id"
FROM "ProductOption" o
WHERE o."type" = 'BUSINESS_DOMAIN'
  AND o."value" = p."businessDomain";

UPDATE "Product" p
SET "supportTeamOptionId" = o."id"
FROM "ProductOption" o
WHERE o."type" = 'SUPPORT_TEAM'
  AND o."value" = p."supportTeam";

UPDATE "Product" p
SET "businessOwnerOptionId" = o."id"
FROM "ProductOption" o
WHERE o."type" = 'BUSINESS_OWNER'
  AND o."value" = p."businessOwner";

UPDATE "Product" p
SET "technicalOwnerOptionId" = o."id"
FROM "ProductOption" o
WHERE o."type" = 'TECHNICAL_OWNER'
  AND o."value" = p."technicalOwner";

-- Enforce new constraints
ALTER TABLE "Product"
  ALTER COLUMN "categoryOptionId" SET NOT NULL,
  ALTER COLUMN "businessOwnerOptionId" SET NOT NULL,
  ALTER COLUMN "technicalOwnerOptionId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryOptionId_fkey" FOREIGN KEY ("categoryOptionId") REFERENCES "ProductOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessDomainOptionId_fkey" FOREIGN KEY ("businessDomainOptionId") REFERENCES "ProductOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supportTeamOptionId_fkey" FOREIGN KEY ("supportTeamOptionId") REFERENCES "ProductOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessOwnerOptionId_fkey" FOREIGN KEY ("businessOwnerOptionId") REFERENCES "ProductOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_technicalOwnerOptionId_fkey" FOREIGN KEY ("technicalOwnerOptionId") REFERENCES "ProductOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove old string columns after backfill
ALTER TABLE "Product"
  DROP COLUMN "category",
  DROP COLUMN "businessDomain",
  DROP COLUMN "supportTeam",
  DROP COLUMN "businessOwner",
  DROP COLUMN "technicalOwner";
