import { PrismaClient } from '@prisma/client';
import { TRAINING_DB } from '@butterfly/shared';

const prisma = new PrismaClient();

type MetadataSeed = {
  kind: 'compound' | 'isolation';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  stabilizerMuscles: string[];
  instructions: string[];
  commonMistakes: string[];
  technicalCues: string[];
  overloadRecommendation: string;
};

function videoUrl(name: string) {
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(`${name} tecnica ejercicio hipertrofia`)}`;
}

const defaults = {
  instructions: [
    'Controla la fase excentrica y evita rebotes.',
    'Mantene una posicion estable antes de iniciar cada repeticion.',
    'Termina la serie cuando la tecnica deje de ser consistente.'
  ],
  commonMistakes: ['Usar impulso excesivo.', 'Perder rango util de movimiento.', 'Cambiar la postura para mover mas peso.'],
  technicalCues: ['Tension constante.', 'Respiracion ordenada.', 'Repeticiones iguales entre si.']
};

const METADATA: Record<string, MetadataSeed> = {
  e1: { kind: 'compound', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi 2.5 kg cuando completes 3x8 con RIR 1-2 y sin dolor.' },
  e2: { kind: 'compound', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps', 'upper_chest'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi 1-2 kg por mancuerna cuando completes 3x10 limpio.' },
  e3: { kind: 'isolation', primaryMuscles: ['side_delts'], secondaryMuscles: ['traps'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Primero aumenta reps hasta 15-20; despues subi el minimo peso posible.' },
  e4: { kind: 'compound', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'front_delts'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Agrega reps antes de lastrar; si llegas a 12 en todas, suma carga pequena.' },
  e5: { kind: 'isolation', primaryMuscles: ['triceps'], secondaryMuscles: [], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi una placa cuando completes 3x15 con codos fijos.' },
  e6: { kind: 'compound', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'upper_back'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Suma reps totales; cuando superes el rango con control, agrega lastre.' },
  e7: { kind: 'compound', primaryMuscles: ['upper_back'], secondaryMuscles: ['lats', 'biceps', 'rear_delts'], stabilizerMuscles: ['spinal_erectors', 'core'], ...defaults, overloadRecommendation: 'Subi 2.5 kg cuando completes 3x10 sin perder angulo del torso.' },
  e8: { kind: 'compound', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'upper_back'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi carga cuando llegues a 12 reps con depresion escapular clara.' },
  e9: { kind: 'isolation', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi poco peso cuando completes 3x10 sin balanceo.' },
  e10: { kind: 'isolation', primaryMuscles: ['rear_delts'], secondaryMuscles: ['upper_back'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Prioriza reps y pausa atras antes de aumentar carga.' },
  e11: { kind: 'compound', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'hamstrings'], stabilizerMuscles: ['core', 'spinal_erectors'], ...defaults, overloadRecommendation: 'Subi 2.5-5 kg cuando completes 4x8 con profundidad estable.' },
  e12: { kind: 'compound', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Primero iguala reps por pierna; despues subi mancuernas de a poco.' },
  e13: { kind: 'compound', primaryMuscles: ['upper_chest'], secondaryMuscles: ['front_delts', 'triceps'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi 2.5 kg cuando completes 3x12 con bajada controlada.' },
  e14: { kind: 'isolation', primaryMuscles: ['quads'], secondaryMuscles: [], stabilizerMuscles: [], ...defaults, overloadRecommendation: 'Aumenta reps y pausa arriba; luego subi una placa.' },
  e15: { kind: 'isolation', primaryMuscles: ['calves'], secondaryMuscles: [], stabilizerMuscles: [], ...defaults, overloadRecommendation: 'Subi reps hasta 20 con estiramiento abajo; luego aumenta carga.' },
  e16: { kind: 'isolation', primaryMuscles: ['side_delts'], secondaryMuscles: ['traps'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Gana reps estrictas antes de subir peso.' },
  e17: { kind: 'isolation', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi una placa cuando completes 20 reps con cierre fuerte.' },
  e18: { kind: 'isolation', primaryMuscles: ['biceps', 'forearms'], secondaryMuscles: [], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi peso solo si no aparece balanceo y mantenes muñeca neutra.' },
  e19: { kind: 'compound', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'front_delts'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Suma reps al fallo tecnico; despues agrega carga si es seguro.' },
  e20: { kind: 'compound', primaryMuscles: ['lats'], secondaryMuscles: ['chest', 'triceps'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi reps hasta 15 con arco estable; luego aumenta mancuerna.' },
  e21: { kind: 'compound', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'front_delts'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Suma reps totales o eleva pies antes de agregar carga.' },
  e22: { kind: 'compound', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'spinal_erectors'], stabilizerMuscles: ['core', 'upper_back'], ...defaults, overloadRecommendation: 'Subi 2.5-5 kg cuando completes 4x10 manteniendo bisagra y espalda neutra.' },
  e23: { kind: 'compound', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'quads'], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Subi carga cuando completes 3x12 con pausa arriba.' },
  e24: { kind: 'isolation', primaryMuscles: ['abs'], secondaryMuscles: [], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Aumenta reps o carga si podes flexionar columna sin tirar con brazos.' },
  e25: { kind: 'isolation', primaryMuscles: ['abs', 'hip_flexors'], secondaryMuscles: [], stabilizerMuscles: ['core'], ...defaults, overloadRecommendation: 'Suma reps estrictas antes de agregar lastre.' },
  e26: { kind: 'isolation', primaryMuscles: ['calves'], secondaryMuscles: [], stabilizerMuscles: [], ...defaults, overloadRecommendation: 'Aumenta reps con pausa arriba y estiramiento abajo antes de subir peso.' }
};

function planSnapshot() {
  return Object.entries(TRAINING_DB).map(([cycleDay, day]) => ({
    cycleDay: Number(cycleDay),
    name: day.name,
    exercises: day.exercises.map((exercise, index) => ({ ...exercise, order: index + 1, active: true }))
  }));
}

async function main() {
  const snapshot = planSnapshot();

  await prisma.planTemplate.upsert({
    where: { name: 'Butterfly Base Hypertrophy Plan' },
    update: { data: snapshot },
    create: { name: 'Butterfly Base Hypertrophy Plan', data: snapshot }
  });

  const activePlan = await prisma.userPlan.findFirst({ where: { active: true } });
  if (!activePlan) {
    await prisma.userPlan.create({ data: { name: 'Agustin Active Plan', active: true, data: snapshot } });
  }

  for (const [cycleDayRaw, day] of Object.entries(TRAINING_DB)) {
    const cycleDay = Number(cycleDayRaw);
    const trainingDay = await prisma.trainingDay.upsert({
      where: { cycleDay },
      update: { name: day.name },
      create: { cycleDay, name: day.name }
    });

    for (const [index, exercise] of day.exercises.entries()) {
      const savedExercise = await prisma.exercise.upsert({
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
          active: true,
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
          active: true,
          order: index + 1
        }
      });

      const metadata = METADATA[exercise.id];
      if (metadata) {
        await prisma.exerciseMetadata.upsert({
          where: { exerciseId: savedExercise.id },
          update: { ...metadata, videoUrl: videoUrl(exercise.name) },
          create: { exerciseId: savedExercise.id, ...metadata, videoUrl: videoUrl(exercise.name) }
        });
      }
    }
  }
}

main().finally(async () => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
