-- Extend the portfolio model with optional compliance metadata and
-- dependency mappings to existing IP and location inventory records.
ALTER TABLE "Product"
  ADD COLUMN "dataClassification" TEXT,
  ADD COLUMN "complianceScope" TEXT,
  ADD COLUMN "controlNotes" TEXT;

CREATE TABLE "_IPAddressToProduct" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE TABLE "_LocationToProduct" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_IPAddressToProduct_AB_unique" ON "_IPAddressToProduct"("A", "B");
CREATE INDEX "_IPAddressToProduct_B_index" ON "_IPAddressToProduct"("B");

CREATE UNIQUE INDEX "_LocationToProduct_AB_unique" ON "_LocationToProduct"("A", "B");
CREATE INDEX "_LocationToProduct_B_index" ON "_LocationToProduct"("B");

CREATE INDEX "Product_environment_idx" ON "Product"("environment");

ALTER TABLE "_IPAddressToProduct"
  ADD CONSTRAINT "_IPAddressToProduct_A_fkey"
  FOREIGN KEY ("A") REFERENCES "IPAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_IPAddressToProduct"
  ADD CONSTRAINT "_IPAddressToProduct_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_LocationToProduct"
  ADD CONSTRAINT "_LocationToProduct_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_LocationToProduct"
  ADD CONSTRAINT "_LocationToProduct_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
