-- AlterTable
ALTER TABLE "documents" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "userNotes" TEXT;
