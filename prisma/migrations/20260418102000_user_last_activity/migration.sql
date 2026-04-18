ALTER TABLE "User"
ADD COLUMN "lastActivityAt" TIMESTAMP(3);

UPDATE "User"
SET "lastActivityAt" = "lastLogin"
WHERE "lastActivityAt" IS NULL
  AND "lastLogin" IS NOT NULL;
