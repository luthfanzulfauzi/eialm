-- Alter license metadata so key is optional and files can be tracked.
ALTER TABLE "License"
ALTER COLUMN "key" DROP NOT NULL;

ALTER TABLE "License"
ADD COLUMN "licenseFile" TEXT;
