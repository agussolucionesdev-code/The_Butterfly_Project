-- Workout sessions and approach sets
CREATE TABLE "WorkoutSession" (
  "id" TEXT NOT NULL,
  "cycleDay" INTEGER NOT NULL,
  "cycleDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SetLog" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "SetLog" ADD COLUMN "setType" TEXT NOT NULL DEFAULT 'working';
ALTER TABLE "SetLog" ADD COLUMN "approachOrder" INTEGER;
ALTER TABLE "SetLog" ADD COLUMN "tempoSeconds" INTEGER;
ALTER TABLE "SetLog" ADD COLUMN "holdSeconds" INTEGER;

ALTER TABLE "SetLog" DROP CONSTRAINT IF EXISTS "SetLog_exerciseId_cycleDate_setNumber_key";
CREATE UNIQUE INDEX "SetLog_exerciseId_cycleDate_setType_setNumber_key" ON "SetLog"("exerciseId", "cycleDate", "setType", "setNumber");
CREATE INDEX "SetLog_sessionId_idx" ON "SetLog"("sessionId");
CREATE UNIQUE INDEX "WorkoutSession_cycleDay_cycleDate_key" ON "WorkoutSession"("cycleDay", "cycleDate");
CREATE INDEX "WorkoutSession_status_startedAt_idx" ON "WorkoutSession"("status", "startedAt");
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Coach, nutrition, habits, photos and challenges
CREATE TABLE "CoachRecommendation" (
  "id" TEXT NOT NULL,
  "exerciseId" TEXT,
  "cycleDay" INTEGER,
  "cycleDate" DATE,
  "scope" TEXT NOT NULL DEFAULT 'daily',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'rules',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serving" TEXT NOT NULL,
  "proteinGrams" DECIMAL(6,2) NOT NULL,
  "calories" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "budget" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NutritionLog" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "meal" TEXT NOT NULL,
  "foodName" TEXT NOT NULL,
  "quantity" DECIMAL(6,2) NOT NULL DEFAULT 1,
  "proteinGrams" DECIMAL(6,2) NOT NULL,
  "calories" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NutritionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HabitGoal" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HabitGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HabitLog" (
  "id" TEXT NOT NULL,
  "goalKey" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "value" TEXT,
  "notes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressPhoto" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "angle" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "publicId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BodyAnalysis" (
  "id" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "focusAreas" TEXT[],
  "recommendations" TEXT[],
  "postureNotes" TEXT[],
  "source" TEXT NOT NULL DEFAULT 'rules',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BodyAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyChallenge" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoachRecommendation_cycleDate_scope_idx" ON "CoachRecommendation"("cycleDate", "scope");
CREATE INDEX "CoachRecommendation_exerciseId_createdAt_idx" ON "CoachRecommendation"("exerciseId", "createdAt");
CREATE UNIQUE INDEX "FoodItem_name_key" ON "FoodItem"("name");
CREATE INDEX "NutritionLog_date_idx" ON "NutritionLog"("date");
CREATE UNIQUE INDEX "HabitGoal_key_key" ON "HabitGoal"("key");
CREATE UNIQUE INDEX "HabitLog_goalKey_date_key" ON "HabitLog"("goalKey", "date");
CREATE INDEX "HabitLog_date_idx" ON "HabitLog"("date");
CREATE INDEX "ProgressPhoto_date_idx" ON "ProgressPhoto"("date");
CREATE INDEX "BodyAnalysis_photoId_createdAt_idx" ON "BodyAnalysis"("photoId", "createdAt");
CREATE UNIQUE INDEX "DailyChallenge_date_category_key" ON "DailyChallenge"("date", "category");
ALTER TABLE "BodyAnalysis" ADD CONSTRAINT "BodyAnalysis_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "ProgressPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
