-- AlterTable
ALTER TABLE "documents" ADD COLUMN "documentKind" TEXT DEFAULT 'invoice';
ALTER TABLE "documents" ADD COLUMN "documentNumber" TEXT;

-- Backfill existing invoice documents.
UPDATE "documents"
SET "documentKind" = 'invoice',
    "documentNumber" = COALESCE("documentNumber", "invoiceId")
WHERE "documentKind" IS NULL OR "documentKind" = 'invoice';

-- CreateIndex
CREATE INDEX "documents_documentKind_idx" ON "documents"("documentKind");
CREATE INDEX "documents_documentNumber_idx" ON "documents"("documentNumber");
