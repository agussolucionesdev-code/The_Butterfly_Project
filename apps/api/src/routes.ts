import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { formatDateOnly, getCycleDay, isFutureCycleDay, parseDateOnly } from '@butterfly/shared';
import { prisma } from './db.js';
import { parseLowRep, summarizeVolume } from './analytics.js';
import { evaluateExerciseProgression } from './progression.js';

const setLogSchema = z.object({
  exerciseId: z.string().min(1),
  cycleDay: z.number().int().min(1).max(7),
  cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setNumber: z.number().int().positive(),
  weightKg: z.number().positive(),
  reps: z.number().int().positive(),
  rir: z.number().int().min(0).max(10).optional(),
  actualRpe: z.number().int().min(1).max(10).optional(),
  techniqueStatus: z.enum(['clean', 'grindy', 'compensated']).optional(),
  tempo: z.string().max(24).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  notes: z.string().max(500).optional(),
  restTakenSeconds: z.number().int().min(0).optional()
});

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
      'Definí una técnica repetible antes de subir la carga.',
      'Usá rango útil completo y controlá la excéntrica.',
      'Frená la serie cuando empieces a compensar el patrón.'
    ],
    commonMistakes: ['Cargar más de lo que podés controlar.', 'Acortar el rango.', 'Acelerar la bajada para sobrevivir la serie.'],
    technicalCues: ['Misma postura en cada repetición.', 'Respiración ordenada.', 'Tensión constante.'],
    overloadRecommendation: 'Primero consolidá técnica y rango; después subí la carga mínima posible.'
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

async function syncExerciseProgression(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      metadata: true,
      logs: { orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }] }
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
    if (input.setNumber > exercise.sets) return reply.code(400).send({ message: 'Ese set excede la cantidad planificada.' });

    const log = await prisma.setLog.upsert({
      where: {
        exerciseId_cycleDate_setNumber: {
          exerciseId: input.exerciseId,
          cycleDate: parseDateOnly(input.cycleDate),
          setNumber: input.setNumber
        }
      },
      update: {
        weightKg: input.weightKg,
        reps: input.reps,
        rir: input.rir,
        actualRpe: input.actualRpe,
        techniqueStatus: input.techniqueStatus,
        tempo: input.tempo,
        painLevel: input.painLevel,
        notes: input.notes,
        restTakenSeconds: input.restTakenSeconds,
        completedAt: new Date()
      },
      create: {
        exerciseId: input.exerciseId,
        cycleDay: input.cycleDay,
        cycleDate: parseDateOnly(input.cycleDate),
        setNumber: input.setNumber,
        weightKg: input.weightKg,
        reps: input.reps,
        rir: input.rir,
        actualRpe: input.actualRpe,
        techniqueStatus: input.techniqueStatus,
        tempo: input.tempo,
        painLevel: input.painLevel,
        notes: input.notes,
        restTakenSeconds: input.restTakenSeconds
      }
    });

    await syncExerciseProgression(input.exerciseId);

    const next = input.setNumber < exercise.sets
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

    return { ok: true, deletedLogs: deletedLogs.count };
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

    const logs = await prisma.setLog.findMany({ where: { exerciseId: params.data.id }, orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }] });
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
      where: { cycleDate: { gte: from, lte: to } },
      include: { exercise: { include: { metadata: true } } }
    });

    return { from: formatDateOnly(from), to: formatDateOnly(to), volume: summarizeVolume(logs) };
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
