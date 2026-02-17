-- AlterTable
ALTER TABLE "documents" ADD COLUMN "followUpStatus" TEXT;
CREATE INDEX "documents_followUpStatus_idx" ON "documents"("followUpStatus");
