-- CreateTable
CREATE TABLE "TrainingDay" (
    "id" TEXT NOT NULL,
    "cycleDay" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "trainingDayId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "targetReps" TEXT NOT NULL,
    "rpe" TEXT NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "breath" TEXT NOT NULL,
    "warmup" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "cycleDay" INTEGER NOT NULL,
    "cycleDate" DATE NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "reps" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDay_cycleDay_key" ON "TrainingDay"("cycleDay");
CREATE UNIQUE INDEX "Exercise_sourceId_key" ON "Exercise"("sourceId");
CREATE INDEX "Exercise_trainingDayId_order_idx" ON "Exercise"("trainingDayId", "order");
CREATE UNIQUE INDEX "SetLog_exerciseId_cycleDate_setNumber_key" ON "SetLog"("exerciseId", "cycleDate", "setNumber");
CREATE INDEX "SetLog_cycleDate_cycleDay_idx" ON "SetLog"("cycleDate", "cycleDay");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_trainingDayId_fkey" FOREIGN KEY ("trainingDayId") REFERENCES "TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
