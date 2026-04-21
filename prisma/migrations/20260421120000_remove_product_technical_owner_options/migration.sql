-- Remove the legacy product-option-backed technical owner path.
-- Technical ownership is now represented by Product.technicalOwnerUserId -> User.id.

DELETE FROM "ProductOption"
WHERE "type" = 'TECHNICAL_OWNER'::"ProductOptionType";

ALTER TYPE "ProductOptionType" RENAME TO "ProductOptionType_old";

CREATE TYPE "ProductOptionType" AS ENUM (
  'CATEGORY',
  'BUSINESS_DOMAIN',
  'SUPPORT_TEAM',
  'BUSINESS_OWNER'
);

ALTER TABLE "ProductOption"
  ALTER COLUMN "type" TYPE "ProductOptionType"
  USING "type"::text::"ProductOptionType";

DROP TYPE "ProductOptionType_old";
