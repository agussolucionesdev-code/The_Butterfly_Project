-- AlterTable
ALTER TABLE "Exercise"
ADD COLUMN "lastProgressionAction" TEXT,
ADD COLUMN "lastProgressionAt" TIMESTAMP(3),
ADD COLUMN "lastProgressionReason" TEXT;

-- AlterTable
ALTER TABLE "ExerciseMetadata"
ADD COLUMN "referenceLabel" TEXT,
ADD COLUMN "referenceUrl" TEXT;

-- AlterTable
ALTER TABLE "ProgressionSuggestion"
ADD COLUMN "autoApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "evaluatedCycleDate" DATE,
ADD COLUMN "targetRepGoal" INTEGER,
ADD COLUMN "targetWeightKg" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "SetLog"
ADD COLUMN "techniqueStatus" TEXT;

-- Backfill evaluated cycle date for existing rows
UPDATE "ProgressionSuggestion"
SET "evaluatedCycleDate" = CURRENT_DATE
WHERE "evaluatedCycleDate" IS NULL;

-- Make evaluated cycle date required after backfill
ALTER TABLE "ProgressionSuggestion"
ALTER COLUMN "evaluatedCycleDate" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionSuggestion_exerciseId_evaluatedCycleDate_key"
ON "ProgressionSuggestion"("exerciseId", "evaluatedCycleDate");
