-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SetLog" ADD COLUMN "rir" INTEGER;
ALTER TABLE "SetLog" ADD COLUMN "actualRpe" INTEGER;
ALTER TABLE "SetLog" ADD COLUMN "tempo" TEXT;
ALTER TABLE "SetLog" ADD COLUMN "painLevel" INTEGER;
ALTER TABLE "SetLog" ADD COLUMN "notes" TEXT;
ALTER TABLE "SetLog" ADD COLUMN "restTakenSeconds" INTEGER;

-- CreateTable
CREATE TABLE "PlanTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMetadata" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "primaryMuscles" TEXT[],
    "secondaryMuscles" TEXT[],
    "stabilizerMuscles" TEXT[],
    "videoUrl" TEXT NOT NULL,
    "instructions" TEXT[],
    "commonMistakes" TEXT[],
    "technicalCues" TEXT[],
    "overloadRecommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExerciseMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bodyWeightKg" DECIMAL(6,2) NOT NULL,
    "proteinGrams" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionSuggestion" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "ProgressionSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanTemplate_name_key" ON "PlanTemplate"("name");
CREATE INDEX "UserPlan_active_idx" ON "UserPlan"("active");
CREATE UNIQUE INDEX "ExerciseMetadata_exerciseId_key" ON "ExerciseMetadata"("exerciseId");
CREATE UNIQUE INDEX "BodyMetric_date_key" ON "BodyMetric"("date");
CREATE INDEX "ProgressionSuggestion_status_createdAt_idx" ON "ProgressionSuggestion"("status", "createdAt");
CREATE INDEX "ProgressionSuggestion_exerciseId_status_idx" ON "ProgressionSuggestion"("exerciseId", "status");

-- AddForeignKey
ALTER TABLE "ExerciseMetadata" ADD CONSTRAINT "ExerciseMetadata_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionSuggestion" ADD CONSTRAINT "ProgressionSuggestion_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

