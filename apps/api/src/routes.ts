import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { formatDateOnly, getCycleDay, isFutureCycleDay, parseDateOnly } from '@butterfly/shared';
import { prisma } from './db.js';
import { parseLowRep, summarizeAdherence, summarizeVolume } from './analytics.js';
import { evaluateExerciseProgression } from './progression.js';

const setLogSchema = z.object({
  exerciseId: z.string().min(1),
  cycleDay: z.number().int().min(1).max(7),
  cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setNumber: z.number().int().positive(),
  setType: z.enum(['working', 'approach']).default('working'),
  approachOrder: z.number().int().positive().optional(),
  weightKg: z.number().positive(),
  reps: z.number().int().positive(),
  rir: z.number().int().min(0).max(10).optional(),
  actualRpe: z.number().int().min(1).max(10).optional(),
  techniqueStatus: z.enum(['clean', 'grindy', 'compensated']).optional(),
  tempo: z.string().max(24).optional(),
  tempoSeconds: z.number().int().min(0).max(20).optional(),
  holdSeconds: z.number().int().min(0).max(20).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  notes: z.string().max(500).optional(),
  restTakenSeconds: z.number().int().min(0).optional()
});

const approachLogSchema = setLogSchema.extend({
  setType: z.literal('approach').default('approach'),
  setNumber: z.number().int().positive(),
  approachOrder: z.number().int().positive()
});

const sessionSchema = z.object({
  cycleDay: z.number().int().min(1).max(7),
  cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional()
});

const nutritionLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.string().min(1).max(80),
  foodName: z.string().min(1).max(120),
  quantity: z.number().positive().default(1),
  proteinGrams: z.number().min(0),
  calories: z.number().int().min(0),
  notes: z.string().max(500).optional()
});

const habitCheckSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goalKey: z.string().min(1),
  completed: z.boolean(),
  value: z.string().max(120).optional(),
  notes: z.string().max(500).optional()
});

const photoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  angle: z.enum(['front', 'side', 'back']),
  imageDataUrl: z.string().min(20).optional(),
  imageUrl: z.string().url().optional(),
  notes: z.string().max(500).optional()
}).refine((value) => value.imageDataUrl || value.imageUrl, { message: 'Se requiere imagen.' });

const bodyMetricSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bodyWeightKg: z.number().positive(),
  proteinGrams: z.number().int().min(0),
  notes: z.string().max(500).optional()
});

const resetDaySchema = z.object({
  cycleDay: z.number().int().min(1).max(7),
  cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const metadataSchema = z.object({
  kind: z.enum(['compound', 'isolation']),
  primaryMuscles: z.array(z.string()).default([]),
  secondaryMuscles: z.array(z.string()).default([]),
  stabilizerMuscles: z.array(z.string()).default([]),
  videoUrl: z.string().url(),
  referenceUrl: z.string().url().optional(),
  referenceLabel: z.string().max(80).optional(),
  instructions: z.array(z.string()).default([]),
  commonMistakes: z.array(z.string()).default([]),
  technicalCues: z.array(z.string()).default([]),
  overloadRecommendation: z.string().min(1)
});

const planExerciseSchema = z.object({
  id: z.string().optional(),
  sourceId: z.string().optional(),
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  targetReps: z.string().min(1),
  rpe: z.string().min(1),
  restSeconds: z.number().int().min(0).max(600),
  breath: z.string().min(1),
  warmup: z.boolean().default(false),
  active: z.boolean().default(true),
  order: z.number().int().min(1)
});

const planSchema = z.object({
  name: z.string().min(1).default('Agustín Active Plan'),
  days: z.array(z.object({
    cycleDay: z.number().int().min(1).max(7),
    name: z.string().min(1),
    exercises: z.array(planExerciseSchema)
  })).length(7)
});

type ExerciseWithMetadata = Record<string, unknown> & {
  metadata?: Record<string, unknown> | null;
};

function serializeLog(log: { weightKg: unknown; cycleDate: Date } & Record<string, unknown>) {
  return {
    ...log,
    weightKg: Number(log.weightKg),
    setType: log.setType ?? 'working',
    cycleDate: formatDateOnly(log.cycleDate)
  };
}

function serializeBodyMetric(metric: { bodyWeightKg: unknown; date: Date } & Record<string, unknown>) {
  return {
    ...metric,
    bodyWeightKg: Number(metric.bodyWeightKg),
    date: formatDateOnly(metric.date)
  };
}

function serializeExercise(exercise: ExerciseWithMetadata) {
  const metadata = exercise.metadata ?? null;

  return {
    ...exercise,
    plannedWeightKg: exercise.plannedWeightKg == null ? null : Number(exercise.plannedWeightKg),
    lastProgressionAt: exercise.lastProgressionAt instanceof Date ? exercise.lastProgressionAt.toISOString() : exercise.lastProgressionAt,
    metadata: metadata
      ? {
          ...metadata,
          referenceUrl: metadata.referenceUrl ?? null,
          referenceLabel: metadata.referenceLabel ?? null
        }
      : null
  };
}

function serializeTrainingDay(day: null | ({ id: string; cycleDay: number; name: string; exercises: ExerciseWithMetadata[] } & Record<string, unknown>)) {
  if (!day) return null;
  return { ...day, exercises: day.exercises.map(serializeExercise) };
}

function serializeSuggestion(suggestion: Record<string, unknown>) {
  return {
    ...suggestion,
    targetWeightKg: suggestion.targetWeightKg == null ? null : Number(suggestion.targetWeightKg),
    evaluatedCycleDate: suggestion.evaluatedCycleDate instanceof Date ? formatDateOnly(suggestion.evaluatedCycleDate) : suggestion.evaluatedCycleDate,
    resolvedAt: suggestion.resolvedAt instanceof Date ? suggestion.resolvedAt.toISOString() : suggestion.resolvedAt,
    exercise: suggestion.exercise && typeof suggestion.exercise === 'object'
      ? serializeExercise(suggestion.exercise as ExerciseWithMetadata)
      : suggestion.exercise
  };
}

function serializeNutritionLog(log: { date: Date; quantity: unknown; proteinGrams: unknown } & Record<string, unknown>) {
  return {
    ...log,
    date: formatDateOnly(log.date),
    quantity: Number(log.quantity),
    proteinGrams: Number(log.proteinGrams)
  };
}

function serializePhoto(photo: { date: Date; analyses?: unknown[] } & Record<string, unknown>) {
  return {
    ...photo,
    date: formatDateOnly(photo.date)
  };
}

function serializeSessionSummary(
  session: null | ({ cycleDate: Date; completedAt?: Date | null; status: string } & Record<string, unknown>),
  completedWorkingSets: number,
  totalWorkingSets: number
) {
  if (!session) return null;
  return {
    ...session,
    cycleDate: formatDateOnly(session.cycleDate),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    completedWorkingSets,
    totalWorkingSets
  };
}

const BUDGET_FOODS = [
  { name: 'Huevos', serving: '2 unidades', proteinGrams: 12, calories: 140, category: 'proteina', notes: 'Barato, completo y facil de sumar al desayuno o cena.' },
  { name: 'Atun al natural', serving: '1 lata', proteinGrams: 24, calories: 120, category: 'proteina', notes: 'Alta proteina con pocas calorias; ideal cuando falta llegar al rango.' },
  { name: 'Pollo', serving: '150 g cocido', proteinGrams: 45, calories: 250, category: 'proteina', notes: 'Base solida para volumen limpio.' },
  { name: 'Leche', serving: '500 ml', proteinGrams: 16, calories: 250, category: 'proteina', notes: 'Util si cuesta comer solido.' },
  { name: 'Yogur natural', serving: '250 g', proteinGrams: 12, calories: 160, category: 'proteina', notes: 'Combinable con avena y fruta.' },
  { name: 'Lentejas', serving: '1 plato', proteinGrams: 18, calories: 330, category: 'mixto', notes: 'Proteina vegetal, carbohidratos y fibra.' },
  { name: 'Porotos', serving: '1 plato', proteinGrams: 15, calories: 300, category: 'mixto', notes: 'Muy buen costo por caloria.' },
  { name: 'Avena', serving: '80 g', proteinGrams: 10, calories: 310, category: 'carbohidrato', notes: 'Energia sostenida para entrenar.' },
  { name: 'Arroz', serving: '1 taza cocida', proteinGrams: 4, calories: 205, category: 'carbohidrato', notes: 'Combustible barato para subir de peso.' },
  { name: 'Banana', serving: '1 unidad', proteinGrams: 1, calories: 105, category: 'fruta', notes: 'Pre-entreno simple y digestivo.' },
  { name: 'Papa', serving: '300 g', proteinGrams: 6, calories: 260, category: 'carbohidrato', notes: 'Saciedad y potasio.' }
] as const;

const DEFAULT_HABITS = [
  { key: 'no-sugar', label: 'Sin azucar agregada', target: 'Evitar azucar agregada durante el dia', order: 1 },
  { key: 'no-alcohol', label: 'Sin alcohol', target: '0 alcohol', order: 2 },
  { key: 'protein', label: 'Proteina 160-175 g', target: 'Llegar al rango diario de proteina', order: 3 },
  { key: 'water', label: 'Agua', target: '2-3 litros', order: 4 },
  { key: 'training', label: 'Entrenamiento', target: 'Completar sesion o descanso activo', order: 5 },
  { key: 'sleep', label: 'Sueno', target: '7-9 horas', order: 6 },
  { key: 'mobility', label: 'Movilidad', target: '5-10 minutos', order: 7 }
] as const;

function buildReferenceUrl(exerciseName: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:exrx.net ${exerciseName}`)}`;
}

function buildVideoUrl(exerciseName: string) {
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(`${exerciseName} tecnica ejercicio hipertrofia`)}`;
}

function buildMinimalMetadata(exerciseName: string) {
  return {
    kind: 'compound' as const,
    primaryMuscles: [],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    videoUrl: buildVideoUrl(exerciseName),
    referenceUrl: buildReferenceUrl(exerciseName),
    referenceLabel: 'Referencia ExRx',
    instructions: [
      'Defini una tecnica repetible antes de subir la carga.',
      'Usa rango util completo y controla la excentrica.',
      'Frena la serie cuando empieces a compensar el patron.'
    ],
    commonMistakes: ['Cargar mas de lo que podes controlar.', 'Acortar el rango.', 'Acelerar la bajada para sobrevivir la serie.'],
    technicalCues: ['Misma postura en cada repeticion.', 'Respiracion ordenada.', 'Tension constante.'],
    overloadRecommendation: 'Primero consolida tecnica y rango; despues subi la carga minima posible.'
  };
}

async function getPlanDays(includeInactive = false) {
  const days = await prisma.trainingDay.findMany({
    orderBy: { cycleDay: 'asc' },
    include: {
      exercises: {
        where: includeInactive ? undefined : { active: true },
        include: { metadata: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  return days.map(serializeTrainingDay);
}

async function getPlannedWorkingSetCount(cycleDay: number) {
  const day = await prisma.trainingDay.findUnique({
    where: { cycleDay },
    include: { exercises: { where: { active: true }, select: { sets: true } } }
  });

  return day?.exercises.reduce((total, exercise) => total + exercise.sets, 0) ?? 0;
}

async function ensureSessionForDay(cycleDay: number, cycleDate: Date) {
  return prisma.workoutSession.upsert({
    where: { cycleDay_cycleDate: { cycleDay, cycleDate } },
    update: { status: 'active', completedAt: null },
    create: { cycleDay, cycleDate, status: 'active' }
  });
}

async function syncDerivedDayState(cycleDay: number, cycleDate: Date) {
  await ensureHabitGoals();

  const [totalWorkingSets, completedWorkingSets, proteinLogs, existingSession] = await Promise.all([
    getPlannedWorkingSetCount(cycleDay),
    prisma.setLog.count({ where: { cycleDay, cycleDate, setType: 'working' } }),
    prisma.nutritionLog.findMany({ where: { date: cycleDate } }),
    prisma.workoutSession.findUnique({ where: { cycleDay_cycleDate: { cycleDay, cycleDate } } })
  ]);

  const proteinTotal = proteinLogs.reduce((total, log) => total + Number(log.proteinGrams), 0);
  await prisma.habitLog.upsert({
    where: { goalKey_date: { goalKey: 'protein', date: cycleDate } },
    update: { completed: proteinTotal >= 160, value: `${proteinTotal}` },
    create: { goalKey: 'protein', date: cycleDate, completed: proteinTotal >= 160, value: `${proteinTotal}` }
  });

  if (totalWorkingSets > 0) {
    await prisma.habitLog.upsert({
      where: { goalKey_date: { goalKey: 'training', date: cycleDate } },
      update: { completed: completedWorkingSets >= totalWorkingSets, value: `${completedWorkingSets}/${totalWorkingSets}` },
      create: { goalKey: 'training', date: cycleDate, completed: completedWorkingSets >= totalWorkingSets, value: `${completedWorkingSets}/${totalWorkingSets}` }
    });
  }

  if (!existingSession && completedWorkingSets === 0) {
    return { session: null, completedWorkingSets, totalWorkingSets };
  }

  const session = existingSession ?? await ensureSessionForDay(cycleDay, cycleDate);
  const completed = totalWorkingSets > 0 && completedWorkingSets >= totalWorkingSets;
  const updatedSession = await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      status: completed ? 'completed' : 'active',
      completedAt: completed ? new Date() : null
    }
  });

  return { session: updatedSession, completedWorkingSets, totalWorkingSets };
}

async function getSessionSummary(cycleDay: number, cycleDate: Date) {
  const summary = await syncDerivedDayState(cycleDay, cycleDate);
  return serializeSessionSummary(summary.session, summary.completedWorkingSets, summary.totalWorkingSets);
}

function sameDateKey(date: Date) {
  return formatDateOnly(date);
}

function serializeTrendRecord(entry: {
  exerciseId: string;
  exerciseName: string;
  latestDate: string;
  latestWeightKg: number;
  latestReps: number;
  previousWeightKg: number | null;
  previousReps: number | null;
}) {
  const deltaWeightKg = entry.previousWeightKg == null ? null : Math.round((entry.latestWeightKg - entry.previousWeightKg) * 100) / 100;
  const deltaReps = entry.previousReps == null ? null : entry.latestReps - entry.previousReps;
  const status = entry.previousWeightKg == null
    ? 'new'
    : deltaWeightKg! > 0 || (deltaWeightKg === 0 && (deltaReps ?? 0) > 0)
      ? 'up'
      : deltaWeightKg === 0 && (deltaReps ?? 0) === 0
        ? 'flat'
        : 'down';

  return {
    ...entry,
    deltaWeightKg,
    deltaReps,
    status
  };
}

async function syncExerciseProgression(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      metadata: true,
      logs: { where: { setType: 'working' }, orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }] }
    }
  });

  if (!exercise || !exercise.active) return null;

  const outcome = evaluateExerciseProgression(exercise);
  if (!outcome) return null;

  const suggestion = await prisma.progressionSuggestion.upsert({
    where: {
      exerciseId_evaluatedCycleDate: {
        exerciseId,
        evaluatedCycleDate: outcome.evaluatedCycleDate
      }
    },
    update: {
      reason: outcome.reason,
      action: outcome.action,
      status: outcome.autoApplied ? 'accepted' : 'pending',
      autoApplied: outcome.autoApplied,
      targetWeightKg: outcome.plannedWeightKg,
      targetRepGoal: outcome.plannedRepGoal,
      resolvedAt: outcome.autoApplied ? new Date() : null
    },
    create: {
      exerciseId,
      evaluatedCycleDate: outcome.evaluatedCycleDate,
      reason: outcome.reason,
      action: outcome.action,
      status: outcome.autoApplied ? 'accepted' : 'pending',
      autoApplied: outcome.autoApplied,
      targetWeightKg: outcome.plannedWeightKg,
      targetRepGoal: outcome.plannedRepGoal,
      resolvedAt: outcome.autoApplied ? new Date() : null
    }
  });

  if (outcome.autoApplied) {
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: {
        plannedWeightKg: outcome.plannedWeightKg,
        plannedRepGoal: outcome.plannedRepGoal,
        lastProgressionReason: outcome.reason,
        lastProgressionAction: outcome.action,
        lastProgressionAt: new Date()
      }
    });
  }

  return suggestion;
}

async function syncAllProgressions() {
  const exercises = await prisma.exercise.findMany({ where: { active: true }, select: { id: true } });
  await Promise.all(exercises.map((exercise) => syncExerciseProgression(exercise.id)));
}

async function ensureFoodItems() {
  await Promise.all(BUDGET_FOODS.map((food) => prisma.foodItem.upsert({
    where: { name: food.name },
    update: food,
    create: food
  })));
}

async function ensureHabitGoals() {
  await Promise.all(DEFAULT_HABITS.map((goal) => prisma.habitGoal.upsert({
    where: { key: goal.key },
    update: { label: goal.label, target: goal.target, order: goal.order, active: true },
    create: goal
  })));
}

function buildDailyChallenge(date: Date, cycleDay: number) {
  const day = formatDateOnly(date);
  const variants = [
    { category: 'technique', title: 'Técnica antes que ego', description: 'En el primer ejercicio filmá o anotá si el rango fue limpio. Si compensás, no subas carga.' },
    { category: 'mobility', title: 'Movilidad de 8 minutos', description: 'Antes de entrenar: hombros/cadera/columna según el día. Prepará articulaciones, no fatigues.' },
    { category: 'nutrition', title: 'Proteína ancla', description: 'Asegurá una comida con 35-45 g de proteína antes de que termine la tarde.' }
  ];
  return variants[(cycleDay + day.length) % variants.length];
}

function buildRuleCoachMessage(
  exercise: ExerciseWithMetadata | null,
  latestApplied: Array<Record<string, unknown>>,
  context: { proteinTotal?: number; completedHabits?: number; totalHabits?: number; completedWorkingSets?: number; totalWorkingSets?: number; sessionStatus?: string | null } = {}
) {
  const proteinStatus = context.proteinTotal == null
    ? 'Todavía no cargaste proteína hoy.'
    : context.proteinTotal >= 160
      ? `Ya cargaste ${context.proteinTotal} g de proteína: mantené calidad y no fuerces comida basura.`
      : `Vas en ${context.proteinTotal} g de proteína: te faltan ${Math.max(0, 160 - context.proteinTotal)} g para el piso.`;
  const habitStatus = context.totalHabits
    ? `Hábitos: ${context.completedHabits ?? 0}/${context.totalHabits} cumplidos.`
    : 'Hábitos todavía sin datos.';
  const sessionStatus = context.totalWorkingSets
    ? `Sesión: ${context.completedWorkingSets ?? 0}/${context.totalWorkingSets} sets efectivos${context.sessionStatus === 'completed' ? ' completada' : ''}.`
    : 'Sesión todavía sin iniciar.';

  if (!exercise) {
    return {
      title: 'Día de recuperación inteligente',
      message: `Hoy no hay ejercicio activo. ${proteinStatus} ${habitStatus} ${sessionStatus}`,
      reason: 'El día actual no tiene series efectivas programadas.',
      action: 'Cargá peso/proteína, cumplí hábitos, caminá suave y protegé el sueño.'
    };
  }

  const latestForExercise = latestApplied.find((item) => item.exerciseId === exercise.id);
  const target = exercise.plannedWeightKg ? `${Number(exercise.plannedWeightKg)} kg` : 'la carga que controles';
  const repGoal = exercise.plannedRepGoal ? `${exercise.plannedRepGoal}+ reps` : String(exercise.targetReps ?? 'rango objetivo');

  return {
    title: `Objetivo de hoy: ${exercise.name}`,
    message: `Usá ${target}, buscá ${repGoal}, mantené excéntrica controlada y frená si aparece dolor o compensación. ${proteinStatus} ${sessionStatus}`,
    reason: latestForExercise?.reason as string ?? exercise.lastProgressionReason as string ?? 'No hay una progresión reciente suficiente; hoy consolidamos técnica y rango.',
    action: latestForExercise?.action as string ?? exercise.lastProgressionAction as string ?? 'Si completás el rango alto con RIR 1-2 y técnica limpia, la próxima sesión subimos estímulo.'
  };
}

async function getDailyCoachContext(cycleDate: Date) {
  await ensureHabitGoals();
  const cycleDay = getCycleDay();
  const [nutritionLogs, habitGoals, habitLogs, session] = await Promise.all([
    prisma.nutritionLog.findMany({ where: { date: cycleDate } }),
    prisma.habitGoal.findMany({ where: { active: true } }),
    prisma.habitLog.findMany({ where: { date: cycleDate } }),
    getSessionSummary(cycleDay, cycleDate)
  ]);

  return {
    proteinTotal: nutritionLogs.reduce((total, log) => total + Number(log.proteinGrams), 0),
    completedHabits: habitLogs.filter((log) => log.completed).length,
    totalHabits: habitGoals.length,
    completedWorkingSets: session?.completedWorkingSets ?? 0,
    totalWorkingSets: session?.totalWorkingSets ?? 0,
    sessionStatus: session?.status ?? null
  };
}

async function uploadToCloudinary(imageDataUrl: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return { imageUrl: imageDataUrl, publicId: null };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'butterfly-progress';
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');
  const form = new FormData();
  form.set('file', imageDataUrl);
  form.set('api_key', apiKey);
  form.set('timestamp', String(timestamp));
  form.set('folder', folder);
  form.set('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  if (!response.ok) throw new Error('Cloudinary rechazó la imagen.');
  const payload = await response.json() as { secure_url: string; public_id: string };
  return { imageUrl: payload.secure_url, publicId: payload.public_id };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, service: 'butterfly-api' }));

  app.get('/api/training/today', async () => {
    const cycleDay = getCycleDay();
    const day = await prisma.trainingDay.findUnique({
      where: { cycleDay },
      include: { exercises: { where: { active: true }, include: { metadata: true }, orderBy: { order: 'asc' } } }
    });

    return { cycleDay, cycleDate: formatDateOnly(new Date()), locked: false, day: serializeTrainingDay(day) };
  });

  app.get('/api/training/day/:cycleDay', async (request, reply) => {
    const params = z.object({ cycleDay: z.coerce.number().int().min(1).max(7) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Día de ciclo inválido.' });

    const cycleDay = params.data.cycleDay;
    const locked = isFutureCycleDay(cycleDay);
    const day = await prisma.trainingDay.findUnique({
      where: { cycleDay },
      include: { exercises: { where: { active: true }, include: { metadata: true }, orderBy: { order: 'asc' } } }
    });

    const serializedDay = serializeTrainingDay(day);
    return {
      cycleDay,
      locked,
      day: locked && serializedDay
        ? { id: serializedDay.id, cycleDay: serializedDay.cycleDay, name: serializedDay.name, exercises: [] }
        : serializedDay
    };
  });

  app.get('/api/logs', async (request, reply) => {
    const query = z.object({ cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ message: 'cycleDate debe usar YYYY-MM-DD.' });

    const logs = await prisma.setLog.findMany({
      where: { cycleDate: parseDateOnly(query.data.cycleDate) },
      include: { exercise: true },
      orderBy: [{ completedAt: 'asc' }]
    });

    return { logs: logs.map(serializeLog) };
  });

  app.post('/api/logs', async (request, reply) => {
    const parsed = setLogSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Set inválido.', issues: parsed.error.flatten() });

    const input = parsed.data;
    if (isFutureCycleDay(input.cycleDay)) return reply.code(403).send({ message: 'Los días futuros están bloqueados.' });

    const exercise = await prisma.exercise.findUnique({ where: { id: input.exerciseId }, include: { trainingDay: true } });
    if (!exercise || !exercise.active) return reply.code(404).send({ message: 'Ejercicio no encontrado.' });
    if (exercise.trainingDay.cycleDay !== input.cycleDay) return reply.code(400).send({ message: 'El ejercicio no pertenece a ese día.' });
    if (input.setType === 'working' && input.setNumber > exercise.sets) return reply.code(400).send({ message: 'Ese set excede la cantidad planificada.' });

    const cycleDate = parseDateOnly(input.cycleDate);
    const session = await ensureSessionForDay(input.cycleDay, cycleDate);

    const log = await prisma.setLog.upsert({
      where: {
        exerciseId_cycleDate_setType_setNumber: {
          exerciseId: input.exerciseId,
          cycleDate,
          setType: input.setType,
          setNumber: input.setNumber
        }
      },
      update: {
        sessionId: session.id,
        setType: input.setType,
        approachOrder: input.approachOrder,
        weightKg: input.weightKg,
        reps: input.reps,
        rir: input.rir,
        actualRpe: input.actualRpe,
        techniqueStatus: input.techniqueStatus,
        tempo: input.tempo,
        tempoSeconds: input.tempoSeconds,
        holdSeconds: input.holdSeconds,
        painLevel: input.painLevel,
        notes: input.notes,
        restTakenSeconds: input.restTakenSeconds,
        completedAt: new Date()
      },
      create: {
        exerciseId: input.exerciseId,
        sessionId: session.id,
        cycleDay: input.cycleDay,
        cycleDate,
        setNumber: input.setNumber,
        setType: input.setType,
        approachOrder: input.approachOrder,
        weightKg: input.weightKg,
        reps: input.reps,
        rir: input.rir,
        actualRpe: input.actualRpe,
        techniqueStatus: input.techniqueStatus,
        tempo: input.tempo,
        tempoSeconds: input.tempoSeconds,
        holdSeconds: input.holdSeconds,
        painLevel: input.painLevel,
        notes: input.notes,
        restTakenSeconds: input.restTakenSeconds
      }
    });

    if (input.setType === 'working') await syncExerciseProgression(input.exerciseId);
    await syncDerivedDayState(input.cycleDay, cycleDate);

    const next = input.setType === 'approach'
      ? { type: 'approach-saved', exerciseId: exercise.id, setNumber: input.setNumber }
      : input.setNumber < exercise.sets
      ? { type: 'next-set', exerciseId: exercise.id, setNumber: input.setNumber + 1 }
      : { type: 'next-exercise' };

    return reply.code(201).send({ log: serializeLog(log), restSeconds: exercise.restSeconds, next });
  });

  app.post('/api/logs/reset-day', async (request, reply) => {
    const parsed = resetDaySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Payload de reinicio inválido.' });
    if (isFutureCycleDay(parsed.data.cycleDay)) return reply.code(403).send({ message: 'Los días futuros están bloqueados.' });

    const day = await prisma.trainingDay.findUnique({
      where: { cycleDay: parsed.data.cycleDay },
      include: { exercises: { select: { id: true } } }
    });

    if (!day) return reply.code(404).send({ message: 'Día no encontrado.' });

    const exerciseIds = day.exercises.map((exercise) => exercise.id);
    const cycleDate = parseDateOnly(parsed.data.cycleDate);
    const deletedLogs = await prisma.setLog.deleteMany({
      where: { cycleDay: parsed.data.cycleDay, cycleDate, exerciseId: { in: exerciseIds } }
    });

    await prisma.progressionSuggestion.deleteMany({
      where: { exerciseId: { in: exerciseIds }, evaluatedCycleDate: cycleDate }
    });

    await prisma.workoutSession.deleteMany({
      where: { cycleDay: parsed.data.cycleDay, cycleDate }
    });

    await syncDerivedDayState(parsed.data.cycleDay, cycleDate);

    return { ok: true, deletedLogs: deletedLogs.count };
  });

  app.get('/api/sessions', async (request, reply) => {
    const parsed = z.object({
      cycleDay: z.coerce.number().int().min(1).max(7),
      cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Consulta de sesión inválida.' });

    const session = await getSessionSummary(parsed.data.cycleDay, parseDateOnly(parsed.data.cycleDate));
    return { session };
  });

  app.post('/api/sessions/start', async (request, reply) => {
    const parsed = sessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Sesión inválida.' });
    if (isFutureCycleDay(parsed.data.cycleDay)) return reply.code(403).send({ message: 'Los días futuros están bloqueados.' });
    const cycleDate = parseDateOnly(parsed.data.cycleDate);
    const session = await prisma.workoutSession.upsert({
      where: { cycleDay_cycleDate: { cycleDay: parsed.data.cycleDay, cycleDate } },
      update: { status: 'active', notes: parsed.data.notes, completedAt: null },
      create: { cycleDay: parsed.data.cycleDay, cycleDate, notes: parsed.data.notes }
    });
    const totalWorkingSets = await getPlannedWorkingSetCount(parsed.data.cycleDay);
    const completedWorkingSets = await prisma.setLog.count({ where: { cycleDay: parsed.data.cycleDay, cycleDate, setType: 'working' } });
    return { session: serializeSessionSummary(session, completedWorkingSets, totalWorkingSets) };
  });

  app.post('/api/sessions/reset', async (request, reply) => {
    const parsed = resetDaySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Payload de reinicio inválido.' });
    const cycleDate = parseDateOnly(parsed.data.cycleDate);
    const deleted = await prisma.setLog.deleteMany({ where: { cycleDay: parsed.data.cycleDay, cycleDate } });
    await prisma.workoutSession.deleteMany({ where: { cycleDay: parsed.data.cycleDay, cycleDate } });
    await prisma.progressionSuggestion.deleteMany({ where: { evaluatedCycleDate: cycleDate, exercise: { trainingDay: { cycleDay: parsed.data.cycleDay } } } });
    await syncDerivedDayState(parsed.data.cycleDay, cycleDate);
    return { ok: true, deletedLogs: deleted.count };
  });

  app.post('/api/logs/approach', async (request, reply) => {
    const parsed = approachLogSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Aproximación inválida.', issues: parsed.error.flatten() });
    request.body = parsed.data;
    return app.inject({
      method: 'POST',
      url: '/api/logs',
      payload: parsed.data
    }).then(async (response) => reply.code(response.statusCode).send(JSON.parse(response.payload)));
  });

  app.get('/api/coach/today', async () => {
    const cycleDay = getCycleDay();
    const cycleDate = parseDateOnly(formatDateOnly(new Date()));
    const day = await prisma.trainingDay.findUnique({
      where: { cycleDay },
      include: { exercises: { where: { active: true }, include: { metadata: true }, orderBy: { order: 'asc' } } }
    });
    const latestApplied = await prisma.progressionSuggestion.findMany({ where: { status: 'accepted' }, orderBy: [{ resolvedAt: 'desc' }, { createdAt: 'desc' }], take: 12 });
    const exercise = day?.exercises[0] ? (serializeExercise(day.exercises[0]) as ExerciseWithMetadata) : null;
    const context = await getDailyCoachContext(cycleDate);
    const recommendation = buildRuleCoachMessage(exercise, latestApplied, context);
    const existing = await prisma.coachRecommendation.findFirst({
      where: { cycleDate, cycleDay, scope: 'daily', status: 'active' },
      orderBy: { createdAt: 'desc' }
    });
    const saved = existing
      ? await prisma.coachRecommendation.update({
          where: { id: existing.id },
          data: { exerciseId: typeof exercise?.id === 'string' ? exercise.id : undefined, ...recommendation }
        })
      : await prisma.coachRecommendation.create({
          data: { cycleDay, cycleDate, exerciseId: typeof exercise?.id === 'string' ? exercise.id : undefined, ...recommendation }
        });
    return { recommendation: saved };
  });

  app.post('/api/coach/recalculate', async () => {
    await syncAllProgressions();
    const cycleDay = getCycleDay();
    const cycleDate = parseDateOnly(formatDateOnly(new Date()));
    const day = await prisma.trainingDay.findUnique({
      where: { cycleDay },
      include: { exercises: { where: { active: true }, include: { metadata: true }, orderBy: { order: 'asc' } } }
    });
    const latestApplied = await prisma.progressionSuggestion.findMany({ where: { status: 'accepted' }, orderBy: [{ resolvedAt: 'desc' }, { createdAt: 'desc' }], take: 12 });
    const exercise = day?.exercises[0] ? (serializeExercise(day.exercises[0]) as ExerciseWithMetadata) : null;
    const context = await getDailyCoachContext(cycleDate);
    const recommendation = buildRuleCoachMessage(exercise, latestApplied, context);
    const existing = await prisma.coachRecommendation.findFirst({
      where: { cycleDate, cycleDay, scope: 'daily', status: 'active' },
      orderBy: { createdAt: 'desc' }
    });
    const saved = existing
      ? await prisma.coachRecommendation.update({
          where: { id: existing.id },
          data: { exerciseId: typeof exercise?.id === 'string' ? exercise.id : undefined, ...recommendation, title: 'Coach recalculado' }
        })
      : await prisma.coachRecommendation.create({
          data: { cycleDay, cycleDate, exerciseId: typeof exercise?.id === 'string' ? exercise.id : undefined, ...recommendation, title: 'Coach recalculado' }
        });
    return { recommendation: saved };
  });

  app.get('/api/nutrition/today', async () => {
    await ensureFoodItems();
    const date = parseDateOnly(formatDateOnly(new Date()));
    const [logs, foods] = await Promise.all([
      prisma.nutritionLog.findMany({ where: { date }, orderBy: { createdAt: 'asc' } }),
      prisma.foodItem.findMany({ orderBy: [{ budget: 'desc' }, { proteinGrams: 'desc' }] })
    ]);
    const proteinTotal = logs.reduce((total, log) => total + Number(log.proteinGrams), 0);
    const caloriesTotal = logs.reduce((total, log) => total + log.calories, 0);
    return {
      date: formatDateOnly(date),
      targetProtein: { min: 160, max: 175 },
      proteinTotal,
      caloriesTotal,
      remainingProtein: Math.max(0, 160 - proteinTotal),
      logs: logs.map(serializeNutritionLog),
      foods: foods.map((food) => ({ ...food, proteinGrams: Number(food.proteinGrams) }))
    };
  });

  app.post('/api/nutrition/logs', async (request, reply) => {
    const parsed = nutritionLogSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Registro nutricional inválido.', issues: parsed.error.flatten() });
    const log = await prisma.nutritionLog.create({
      data: { ...parsed.data, date: parseDateOnly(parsed.data.date) }
    });
    return { log: serializeNutritionLog(log) };
  });

  app.get('/api/habits/today', async () => {
    await ensureHabitGoals();
    const date = parseDateOnly(formatDateOnly(new Date()));
    const [goals, logs] = await Promise.all([
      prisma.habitGoal.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      prisma.habitLog.findMany({ where: { date } })
    ]);
    return { date: formatDateOnly(date), goals, logs: logs.map((log) => ({ ...log, date: formatDateOnly(log.date) })) };
  });

  app.post('/api/habits/check', async (request, reply) => {
    const parsed = habitCheckSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Hábito inválido.', issues: parsed.error.flatten() });
    await ensureHabitGoals();
    const log = await prisma.habitLog.upsert({
      where: { goalKey_date: { goalKey: parsed.data.goalKey, date: parseDateOnly(parsed.data.date) } },
      update: { completed: parsed.data.completed, value: parsed.data.value, notes: parsed.data.notes },
      create: { goalKey: parsed.data.goalKey, date: parseDateOnly(parsed.data.date), completed: parsed.data.completed, value: parsed.data.value, notes: parsed.data.notes }
    });
    return { log: { ...log, date: formatDateOnly(log.date) } };
  });

  app.get('/api/photos', async () => {
    const photos = await prisma.progressPhoto.findMany({ include: { analyses: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' }, take: 24 });
    return { photos: photos.map(serializePhoto) };
  });

  app.post('/api/photos', async (request, reply) => {
    const parsed = photoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Foto inválida.', issues: parsed.error.flatten() });
    const upload = parsed.data.imageDataUrl ? await uploadToCloudinary(parsed.data.imageDataUrl) : { imageUrl: parsed.data.imageUrl!, publicId: null };
    const photo = await prisma.progressPhoto.create({
      data: { date: parseDateOnly(parsed.data.date), angle: parsed.data.angle, imageUrl: upload.imageUrl, publicId: upload.publicId, notes: parsed.data.notes }
    });
    return { photo: serializePhoto(photo) };
  });

  app.post('/api/photos/:id/analyze', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Foto inválida.' });
    const photo = await prisma.progressPhoto.findUnique({ where: { id: params.data.id } });
    if (!photo) return reply.code(404).send({ message: 'Foto no encontrada.' });
    const analysis = await prisma.bodyAnalysis.create({
      data: {
        photoId: photo.id,
        summary: 'Análisis inicial guardado. La IA visual se activará cuando estén configuradas las API keys; mientras tanto usá esta foto como línea base de comparación.',
        focusAreas: ['hombros', 'pecho', 'espalda'],
        recommendations: ['Compará siempre con misma luz, distancia y postura.', 'Usá el volumen semanal para decidir foco muscular, no una sola foto aislada.', 'Si una zona queda rezagada, priorizá técnica y progresión antes de sumar ejercicios.'],
        postureNotes: ['Frente, lateral y espalda permiten una lectura más consistente que una sola imagen.'],
        source: process.env.OPENAI_API_KEY ? 'openai-ready' : 'rules'
      }
    });
    return { analysis };
  });

  app.get('/api/challenges/today', async () => {
    const date = parseDateOnly(formatDateOnly(new Date()));
    const cycleDay = getCycleDay();
    const suggested = buildDailyChallenge(date, cycleDay);
    const challenge = await prisma.dailyChallenge.upsert({
      where: { date_category: { date, category: suggested.category } },
      update: {},
      create: { date, ...suggested }
    });
    return { challenge: { ...challenge, date: formatDateOnly(challenge.date) } };
  });

  app.post('/api/challenges/:id/complete', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    const parsed = z.object({ completed: z.boolean() }).safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ message: 'Challenge inválido.' });
    const challenge = await prisma.dailyChallenge.update({
      where: { id: params.data.id },
      data: { completed: parsed.data.completed }
    });
    return { challenge: { ...challenge, date: formatDateOnly(challenge.date) } };
  });

  app.get('/api/exercises/:id/metadata', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Ejercicio inválido.' });
    const metadata = await prisma.exerciseMetadata.findUnique({ where: { exerciseId: params.data.id } });
    if (!metadata) return reply.code(404).send({ message: 'Metadata no encontrada.' });
    return { metadata };
  });

  app.put('/api/exercises/:id/metadata', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    const parsed = metadataSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ message: 'Metadata inválida.' });

    const metadata = await prisma.exerciseMetadata.upsert({
      where: { exerciseId: params.data.id },
      update: parsed.data,
      create: { exerciseId: params.data.id, ...parsed.data }
    });

    return { metadata };
  });

  app.get('/api/exercises/:id/history', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Ejercicio inválido.' });

    const logs = await prisma.setLog.findMany({ where: { exerciseId: params.data.id, setType: 'working' }, orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }] });
    const serialized = logs.map((log) => serializeLog(log) as ReturnType<typeof serializeLog> & { reps: number });
    const bestWeight = serialized.reduce((best, log) => Math.max(best, Number(log.weightKg)), 0);
    const bestReps = serialized.reduce((best, log) => Math.max(best, Number(log.reps)), 0);
    const bestVolume = serialized.reduce((best, log) => Math.max(best, Number(log.weightKg) * Number(log.reps)), 0);
    const latestDate = serialized[0]?.cycleDate;
    const latestLogs = latestDate ? serialized.filter((log) => log.cycleDate === latestDate) : [];

    return { history: { latestDate, latestLogs, bestWeight, bestReps, bestVolume, logs: serialized.slice(0, 20) } };
  });

  app.get('/api/analytics/volume', async (request, reply) => {
    const today = formatDateOnly(new Date());
    const query = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }).safeParse(request.query);

    if (!query.success) return reply.code(400).send({ message: 'Rango de fechas inválido.' });

    const to = parseDateOnly(query.data.to ?? today);
    const from = query.data.from ? parseDateOnly(query.data.from) : new Date(to.getTime() - 6 * 86_400_000);
    const logs = await prisma.setLog.findMany({
      where: { cycleDate: { gte: from, lte: to }, setType: 'working' },
      include: { exercise: { include: { metadata: true } } }
    });

    return { from: formatDateOnly(from), to: formatDateOnly(to), volume: summarizeVolume(logs) };
  });

  app.get('/api/analytics/adherence', async (request, reply) => {
    await ensureHabitGoals();
    const query = z.object({
      days: z.coerce.number().int().min(1).max(30).default(7)
    }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ message: 'Ventana de adherencia inválida.' });

    const today = parseDateOnly(formatDateOnly(new Date()));
    const from = new Date(today.getTime() - (query.data.days - 1) * 86_400_000);
    const [habitGoals, nutritionLogs, habitLogs, sessions] = await Promise.all([
      prisma.habitGoal.findMany({ where: { active: true } }),
      prisma.nutritionLog.findMany({ where: { date: { gte: from, lte: today } } }),
      prisma.habitLog.findMany({ where: { date: { gte: from, lte: today } } }),
      prisma.workoutSession.findMany({ where: { cycleDate: { gte: from, lte: today } } })
    ]);

    const days = Array.from({ length: query.data.days }, (_, index) => {
      const date = new Date(from.getTime() + index * 86_400_000);
      const dateKey = formatDateOnly(date);
      const proteinTotal = nutritionLogs
        .filter((log) => sameDateKey(log.date) === dateKey)
        .reduce((total, log) => total + Number(log.proteinGrams), 0);
      const dayHabitLogs = habitLogs.filter((log) => sameDateKey(log.date) === dateKey);
      const session = sessions.find((item) => sameDateKey(item.cycleDate) === dateKey);

      return {
        date: dateKey,
        proteinTargetMet: proteinTotal >= 160,
        trainingCompleted: session?.status === 'completed',
        completedHabits: dayHabitLogs.filter((log) => log.completed).length,
        totalHabits: habitGoals.length
      };
    });

    return summarizeAdherence(days);
  });

  app.get('/api/analytics/exercise-trends', async (request, reply) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(20).default(8)
    }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ message: 'Límite inválido.' });

    const exercises = await prisma.exercise.findMany({
      where: { active: true },
      include: {
        logs: {
          where: { setType: 'working' },
          orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }]
        }
      }
    });

    const trends = exercises
      .map((exercise) => {
        const uniqueDates = [...new Set(exercise.logs.map((log) => sameDateKey(log.cycleDate)))];
        const latestDate = uniqueDates[0];
        if (!latestDate) return null;
        const previousDate = uniqueDates[1] ?? null;
        const latestLogs = exercise.logs.filter((log) => sameDateKey(log.cycleDate) === latestDate);
        const previousLogs = previousDate ? exercise.logs.filter((log) => sameDateKey(log.cycleDate) === previousDate) : [];
        const latestBest = latestLogs.reduce((best, log) => {
          const volume = Number(log.weightKg) * log.reps;
          return volume > best.volume ? { weightKg: Number(log.weightKg), reps: log.reps, volume } : best;
        }, { weightKg: 0, reps: 0, volume: 0 });
        const previousBest = previousLogs.reduce((best, log) => {
          const volume = Number(log.weightKg) * log.reps;
          return volume > best.volume ? { weightKg: Number(log.weightKg), reps: log.reps, volume } : best;
        }, { weightKg: 0, reps: 0, volume: 0 });

        return serializeTrendRecord({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          latestDate,
          latestWeightKg: latestBest.weightKg,
          latestReps: latestBest.reps,
          previousWeightKg: previousDate ? previousBest.weightKg : null,
          previousReps: previousDate ? previousBest.reps : null
        });
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.latestDate < b.latestDate ? 1 : -1)
      .slice(0, query.data.limit);

    return { trends };
  });

  app.get('/api/analytics/progression', async () => {
    await syncAllProgressions();

    const [suggestions, latestApplied] = await Promise.all([
      prisma.progressionSuggestion.findMany({
        where: { status: 'pending' },
        include: { exercise: { include: { metadata: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.progressionSuggestion.findMany({
        where: { status: 'accepted' },
        include: { exercise: { include: { metadata: true } } },
        orderBy: [{ resolvedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8
      })
    ]);

    return {
      suggestions: suggestions.map(serializeSuggestion),
      latestApplied: latestApplied.map(serializeSuggestion)
    };
  });

  app.post('/api/progression/:id/accept', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Sugerencia inválida.' });

    const suggestion = await prisma.progressionSuggestion.update({
      where: { id: params.data.id },
      data: { status: 'accepted', resolvedAt: new Date() },
      include: { exercise: true }
    });

    await prisma.exercise.update({
      where: { id: suggestion.exerciseId },
      data: {
        plannedWeightKg: suggestion.targetWeightKg,
        plannedRepGoal: suggestion.targetRepGoal ?? parseLowRep(suggestion.exercise.targetReps),
        lastProgressionReason: suggestion.reason,
        lastProgressionAction: suggestion.action,
        lastProgressionAt: new Date()
      }
    });

    return { suggestion: serializeSuggestion(suggestion) };
  });

  app.post('/api/progression/:id/reject', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Sugerencia inválida.' });
    const suggestion = await prisma.progressionSuggestion.update({ where: { id: params.data.id }, data: { status: 'rejected', resolvedAt: new Date() }, include: { exercise: true } });
    return { suggestion: serializeSuggestion(suggestion) };
  });

  app.get('/api/body-metrics', async () => {
    const metrics = await prisma.bodyMetric.findMany({ orderBy: { date: 'desc' }, take: 30 });
    return { metrics: metrics.map(serializeBodyMetric) };
  });

  app.post('/api/body-metrics', async (request, reply) => {
    const parsed = bodyMetricSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Body metric inválido.', issues: parsed.error.flatten() });
    const metric = await prisma.bodyMetric.upsert({
      where: { date: parseDateOnly(parsed.data.date) },
      update: { bodyWeightKg: parsed.data.bodyWeightKg, proteinGrams: parsed.data.proteinGrams, notes: parsed.data.notes },
      create: { date: parseDateOnly(parsed.data.date), bodyWeightKg: parsed.data.bodyWeightKg, proteinGrams: parsed.data.proteinGrams, notes: parsed.data.notes }
    });
    return { metric: serializeBodyMetric(metric) };
  });

  app.get('/api/plans/active', async () => {
    const [activePlan, days] = await Promise.all([
      prisma.userPlan.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } }),
      getPlanDays(true)
    ]);
    return { plan: activePlan, days };
  });

  app.put('/api/plans/active', async (request, reply) => {
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Plan inválido.', issues: parsed.error.flatten() });

    for (const day of parsed.data.days) {
      const trainingDay = await prisma.trainingDay.upsert({
        where: { cycleDay: day.cycleDay },
        update: { name: day.name },
        create: { cycleDay: day.cycleDay, name: day.name }
      });

      for (const exercise of day.exercises) {
        if (exercise.id) {
          await prisma.exercise.update({
            where: { id: exercise.id },
            data: {
              trainingDayId: trainingDay.id,
              sourceId: exercise.sourceId ?? undefined,
              name: exercise.name,
              sets: exercise.sets,
              targetReps: exercise.targetReps,
              rpe: exercise.rpe,
              restSeconds: exercise.restSeconds,
              breath: exercise.breath,
              warmup: exercise.warmup,
              active: exercise.active,
              order: exercise.order
            }
          });
        } else {
          const created = await prisma.exercise.create({
            data: {
              trainingDayId: trainingDay.id,
              sourceId: exercise.sourceId ?? `custom-${Date.now()}-${exercise.order}`,
              name: exercise.name,
              sets: exercise.sets,
              targetReps: exercise.targetReps,
              rpe: exercise.rpe,
              restSeconds: exercise.restSeconds,
              breath: exercise.breath,
              warmup: exercise.warmup,
              active: exercise.active,
              order: exercise.order
            }
          });

          await prisma.exerciseMetadata.create({ data: { exerciseId: created.id, ...buildMinimalMetadata(exercise.name) } });
        }
      }
    }

    await prisma.userPlan.updateMany({ data: { active: false }, where: { active: true } });
    const plan = await prisma.userPlan.create({ data: { name: parsed.data.name, active: true, data: parsed.data.days } });
    return { plan, days: await getPlanDays(true) };
  });

  app.post('/api/plans/reset-to-template', async (_request, reply) => {
    const template = await prisma.planTemplate.findUnique({ where: { name: 'Butterfly Base Hypertrophy Plan' } });
    if (!template) return reply.code(404).send({ message: 'Template base no encontrado.' });

    for (const day of template.data as Array<{ cycleDay: number; name: string; exercises: Array<{ id: string; name: string; sets: number; reps: string; rpe: string | number; rest: number; breath: string; warmup: boolean; order: number }> }>) {
      const trainingDay = await prisma.trainingDay.upsert({ where: { cycleDay: day.cycleDay }, update: { name: day.name }, create: { cycleDay: day.cycleDay, name: day.name } });
      for (const exercise of day.exercises) {
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
            active: true,
            order: exercise.order
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
            order: exercise.order
          }
        });
      }
    }

    await prisma.userPlan.updateMany({ data: { active: false }, where: { active: true } });
    const plan = await prisma.userPlan.create({ data: { name: 'Agustín Active Plan', active: true, data: template.data ?? [] } });
    return { plan, days: await getPlanDays(true) };
  });
}
