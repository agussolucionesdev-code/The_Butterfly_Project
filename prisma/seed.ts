import { PrismaClient } from '@prisma/client';
import { TRAINING_DB } from '@butterfly/shared';

const prisma = new PrismaClient();

async function main() {
  for (const [cycleDayRaw, day] of Object.entries(TRAINING_DB)) {
    const cycleDay = Number(cycleDayRaw);
    const trainingDay = await prisma.trainingDay.upsert({
      where: { cycleDay },
      update: { name: day.name },
      create: { cycleDay, name: day.name }
    });

    for (const [index, exercise] of day.exercises.entries()) {
      await prisma.exercise.upsert({
        where: { sourceId: exercise.id },
        update: {
          trainingDayId: trainingDay.id,
          name: exercise.name,
          sets: exercise.sets,
          targetReps: exercise.reps,
          rpe: String(exercise.rpe),
          restSeconds: exercise.rest,
          breath: exercise.breath,
          warmup: exercise.warmup,
          order: index + 1
        },
        create: {
          trainingDayId: trainingDay.id,
          sourceId: exercise.id,
          name: exercise.name,
          sets: exercise.sets,
          targetReps: exercise.reps,
          rpe: String(exercise.rpe),
          restSeconds: exercise.rest,
          breath: exercise.breath,
          warmup: exercise.warmup,
          order: index + 1
        }
      });
    }
  }
}

main().finally(async () => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
