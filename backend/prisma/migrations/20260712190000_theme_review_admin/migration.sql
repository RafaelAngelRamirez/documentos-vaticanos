-- AlterEnum: add admin role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'admin';

-- AlterTable Theme: review workflow fields (design 6A–6D)
ALTER TABLE "Theme" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Theme" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
ALTER TABLE "Theme" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "Theme" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Theme" ADD COLUMN IF NOT EXISTS "downloads" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Theme_reviewStatus_idx" ON "Theme"("reviewStatus");
