-- Add nullable user-backed technical owner relation.
-- Nullable keeps existing products valid even when an old technical-owner option
-- cannot be matched to an existing user.
ALTER TABLE "Product" ADD COLUMN "technicalOwnerUserId" TEXT;

-- Best-effort backfill from previous technical owner option values.
UPDATE "Product" p
SET "technicalOwnerUserId" = u."id"
FROM "ProductOption" o
JOIN "User" u
  ON lower(u."name") = lower(o."value")
  OR lower(u."email") = lower(o."value")
WHERE p."technicalOwnerOptionId" = o."id";

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_technicalOwnerUserId_fkey" FOREIGN KEY ("technicalOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove old product-option-backed technical owner relation.
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_technicalOwnerOptionId_fkey";
ALTER TABLE "Product" DROP COLUMN "technicalOwnerOptionId";
