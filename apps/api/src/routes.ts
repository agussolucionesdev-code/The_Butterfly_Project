import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { formatDateOnly, getCycleDay, isFutureCycleDay, parseDateOnly } from '@butterfly/shared';
import { prisma } from './db.js';
import { parseHighRep, parseLowRep, summarizeVolume } from './analytics.js';

const setLogSchema = z.object({
  exerciseId: z.string().min(1),
  cycleDay: z.number().int().min(1).max(7),
  cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setNumber: z.number().int().positive(),
  weightKg: z.number().positive(),
  reps: z.number().int().positive(),
  rir: z.number().int().min(0).max(10).optional(),
  actualRpe: z.number().int().min(1).max(10).optional(),
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
  name: z.string().min(1).default('Agustin Active Plan'),
  days: z.array(z.object({
    cycleDay: z.number().int().min(1).max(7),
    name: z.string().min(1),
    exercises: z.array(planExerciseSchema)
  })).length(7)
});

function serializeLog(log: { weightKg: unknown; reps: number; cycleDate: Date } & Record<string, unknown>) {
  return { ...log, weightKg: Number(log.weightKg), cycleDate: formatDateOnly(log.cycleDate) };
}

function serializeBodyMetric(metric: { bodyWeightKg: unknown; date: Date } & Record<string, unknown>) {
  return { ...metric, bodyWeightKg: Number(metric.bodyWeightKg), date: formatDateOnly(metric.date) };
}

async function getPlanDays(includeInactive = false) {
  return prisma.trainingDay.findMany({
    orderBy: { cycleDay: 'asc' },
    include: {
      exercises: {
        where: includeInactive ? undefined : { active: true },
        include: { metadata: true },
        orderBy: { order: 'asc' }
      }
    }
  });
}

async function ensureProgressionSuggestions() {
  const exercises = await prisma.exercise.findMany({ where: { active: true }, include: { metadata: true, logs: { orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }] } } });

  for (const exercise of exercises) {
    const highRep = parseHighRep(exercise.targetReps);
    if (!highRep || exercise.logs.length < exercise.sets) continue;

    const latestDate = exercise.logs[0]?.cycleDate;
    if (!latestDate) continue;

    const latestLogs = exercise.logs.filter((log) => formatDateOnly(log.cycleDate) === formatDateOnly(latestDate));
    if (latestLogs.length < exercise.sets) continue;
    if (latestLogs.some((log) => (log.painLevel ?? 0) > 0)) continue;

    const reachedTop = latestLogs.every((log) => log.reps >= highRep);
    const goodEffort = latestLogs.every((log) => log.rir == null || log.rir >= 1) && latestLogs.every((log) => log.actualRpe == null || log.actualRpe <= 9);
    if (!reachedTop || !goodEffort) continue;

    const pending = await prisma.progressionSuggestion.findFirst({ where: { exerciseId: exercise.id, status: 'pending' } });
    if (!pending) {
      await prisma.progressionSuggestion.create({
        data: {
          exerciseId: exercise.id,
          reason: `Completaste ${exercise.sets} series en el rango alto (${exercise.targetReps}) con esfuerzo controlado.`,
          action: exercise.metadata?.kind === 'isolation' ? 'Subi el minimo peso posible o agrega 1-2 reps manteniendo tecnica.' : 'Subi 2.5 kg o el salto minimo disponible en la proxima sesion.'
        }
      }).catch(async () => {
        await prisma.progressionSuggestion.create({
          data: {
            exerciseId: exercise.id,
            reason: `Completaste ${exercise.sets} series en el rango alto (${exercise.targetReps}) con esfuerzo controlado.`,
            action: 'Aumenta carga de forma conservadora en la proxima sesion.'
          }
        });
      });
    }
  }
}


export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, service: 'butterfly-api' }));

  app.get('/api/training/today', async () => {
    const cycleDay = getCycleDay();
    const day = await prisma.trainingDay.findUnique({ where: { cycleDay }, include: { exercises: { where: { active: true }, include: { metadata: true }, orderBy: { order: 'asc' } } } });
    return { cycleDay, cycleDate: formatDateOnly(new Date()), locked: false, day };
  });

  app.get('/api/training/day/:cycleDay', async (request, reply) => {
    const params = z.object({ cycleDay: z.coerce.number().int().min(1).max(7) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Invalid cycle day.' });
    const cycleDay = params.data.cycleDay;
    const locked = isFutureCycleDay(cycleDay);
    const day = await prisma.trainingDay.findUnique({ where: { cycleDay }, include: { exercises: { where: { active: true }, include: { metadata: true }, orderBy: { order: 'asc' } } } });
    return { cycleDay, locked, day: locked ? day && { id: day.id, cycleDay: day.cycleDay, name: day.name, exercises: [] } : day };
  });

  app.get('/api/logs', async (request, reply) => {
    const query = z.object({ cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ message: 'cycleDate must use YYYY-MM-DD.' });
    const logs = await prisma.setLog.findMany({ where: { cycleDate: parseDateOnly(query.data.cycleDate) }, include: { exercise: true }, orderBy: [{ completedAt: 'asc' }] });
    return { logs: logs.map(serializeLog) };
  });

  app.post('/api/logs', async (request, reply) => {
    const parsed = setLogSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid set log.', issues: parsed.error.flatten() });
    const input = parsed.data;
    if (isFutureCycleDay(input.cycleDay)) return reply.code(403).send({ message: 'Future training days are locked.' });
    const exercise = await prisma.exercise.findUnique({ where: { id: input.exerciseId }, include: { trainingDay: true } });
    if (!exercise || !exercise.active) return reply.code(404).send({ message: 'Exercise not found.' });
    if (exercise.trainingDay.cycleDay !== input.cycleDay) return reply.code(400).send({ message: 'Exercise does not belong to cycle day.' });
    if (input.setNumber > exercise.sets) return reply.code(400).send({ message: 'Set number exceeds exercise set count.' });

    const log = await prisma.setLog.upsert({
      where: { exerciseId_cycleDate_setNumber: { exerciseId: input.exerciseId, cycleDate: parseDateOnly(input.cycleDate), setNumber: input.setNumber } },
      update: { weightKg: input.weightKg, reps: input.reps, rir: input.rir, actualRpe: input.actualRpe, tempo: input.tempo, painLevel: input.painLevel, notes: input.notes, restTakenSeconds: input.restTakenSeconds, completedAt: new Date() },
      create: { exerciseId: input.exerciseId, cycleDay: input.cycleDay, cycleDate: parseDateOnly(input.cycleDate), setNumber: input.setNumber, weightKg: input.weightKg, reps: input.reps, rir: input.rir, actualRpe: input.actualRpe, tempo: input.tempo, painLevel: input.painLevel, notes: input.notes, restTakenSeconds: input.restTakenSeconds }
    });

    void ensureProgressionSuggestions();
    const next = input.setNumber < exercise.sets ? { type: 'next-set', exerciseId: exercise.id, setNumber: input.setNumber + 1 } : { type: 'next-exercise' };
    return reply.code(201).send({ log: serializeLog(log), restSeconds: exercise.restSeconds, next });
  });

  app.post('/api/logs/reset-day', async (request, reply) => {
    const parsed = resetDaySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid reset payload.' });
    if (isFutureCycleDay(parsed.data.cycleDay)) return reply.code(403).send({ message: 'Future training days are locked.' });

    const day = await prisma.trainingDay.findUnique({
      where: { cycleDay: parsed.data.cycleDay },
      include: { exercises: { select: { id: true } } }
    });

    if (!day) return reply.code(404).send({ message: 'Training day not found.' });

    const exerciseIds = day.exercises.map((exercise) => exercise.id);
    const cycleDate = parseDateOnly(parsed.data.cycleDate);

    const deletedLogs = await prisma.setLog.deleteMany({
      where: { cycleDay: parsed.data.cycleDay, cycleDate, exerciseId: { in: exerciseIds } }
    });

    await prisma.progressionSuggestion.deleteMany({
      where: { exerciseId: { in: exerciseIds }, status: 'pending' }
    });

    return { ok: true, deletedLogs: deletedLogs.count };
  });

  app.get('/api/exercises/:id/metadata', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Invalid exercise id.' });
    const metadata = await prisma.exerciseMetadata.findUnique({ where: { exerciseId: params.data.id } });
    if (!metadata) return reply.code(404).send({ message: 'Metadata not found.' });
    return { metadata };
  });

  app.put('/api/exercises/:id/metadata', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    const parsed = metadataSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ message: 'Invalid metadata.' });
    const metadata = await prisma.exerciseMetadata.upsert({ where: { exerciseId: params.data.id }, update: parsed.data, create: { exerciseId: params.data.id, ...parsed.data } });
    return { metadata };
  });

  app.get('/api/exercises/:id/history', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Invalid exercise id.' });
    const logs = await prisma.setLog.findMany({ where: { exerciseId: params.data.id }, orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }] });
    const serialized = logs.map(serializeLog);
    const bestWeight = serialized.reduce((best, log) => Math.max(best, Number(log.weightKg)), 0);
    const bestReps = serialized.reduce((best, log) => Math.max(best, Number(log.reps)), 0);
    const bestVolume = serialized.reduce((best, log) => Math.max(best, Number(log.weightKg) * Number(log.reps)), 0);
    const latestDate = serialized[0]?.cycleDate;
    return { history: { latestDate, latestLogs: latestDate ? serialized.filter((log) => log.cycleDate === latestDate) : [], bestWeight, bestReps, bestVolume, logs: serialized.slice(0, 20) } };
  });

  app.get('/api/analytics/volume', async (request, reply) => {
    const today = formatDateOnly(new Date());
    const query = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ message: 'Invalid date range.' });
    const to = parseDateOnly(query.data.to ?? today);
    const from = query.data.from ? parseDateOnly(query.data.from) : new Date(to.getTime() - 6 * 86_400_000);
    const logs = await prisma.setLog.findMany({ where: { cycleDate: { gte: from, lte: to } }, include: { exercise: { include: { metadata: true } } } });
    return { from: formatDateOnly(from), to: formatDateOnly(to), volume: summarizeVolume(logs) };
  });

  app.get('/api/analytics/progression', async () => {
    await ensureProgressionSuggestions();
    const suggestions = await prisma.progressionSuggestion.findMany({ where: { status: 'pending' }, include: { exercise: true }, orderBy: { createdAt: 'desc' } });
    return { suggestions };
  });

  app.post('/api/progression/:id/accept', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Invalid suggestion id.' });
    const suggestion = await prisma.progressionSuggestion.update({ where: { id: params.data.id }, data: { status: 'accepted', resolvedAt: new Date() }, include: { exercise: { include: { logs: { orderBy: [{ cycleDate: 'desc' }, { setNumber: 'asc' }], take: 10 } } } } });
    const latestWeight = Math.max(...suggestion.exercise.logs.map((log) => Number(log.weightKg)), 0);
    const increment = suggestion.exercise.name.includes('Manc.') || suggestion.exercise.name.includes('Mancuerna') ? 1 : (suggestion.exercise.rpe === 'FALLO' ? 1 : 2.5);
    const plannedRepGoal = parseLowRep(suggestion.exercise.targetReps);
    await prisma.exercise.update({ where: { id: suggestion.exerciseId }, data: { plannedWeightKg: latestWeight > 0 ? latestWeight + increment : null, plannedRepGoal } });
    return { suggestion };
  });

  app.post('/api/progression/:id/reject', async (request, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Invalid suggestion id.' });
    const suggestion = await prisma.progressionSuggestion.update({ where: { id: params.data.id }, data: { status: 'rejected', resolvedAt: new Date() } });
    return { suggestion };
  });

  app.get('/api/body-metrics', async () => {
    const metrics = await prisma.bodyMetric.findMany({ orderBy: { date: 'desc' }, take: 30 });
    return { metrics: metrics.map(serializeBodyMetric) };
  });

  app.post('/api/body-metrics', async (request, reply) => {
    const parsed = bodyMetricSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid body metric.', issues: parsed.error.flatten() });
    const metric = await prisma.bodyMetric.upsert({ where: { date: parseDateOnly(parsed.data.date) }, update: { bodyWeightKg: parsed.data.bodyWeightKg, proteinGrams: parsed.data.proteinGrams, notes: parsed.data.notes }, create: { date: parseDateOnly(parsed.data.date), bodyWeightKg: parsed.data.bodyWeightKg, proteinGrams: parsed.data.proteinGrams, notes: parsed.data.notes } });
    return { metric: serializeBodyMetric(metric) };
  });

  app.get('/api/plans/active', async () => {
    const [activePlan, days] = await Promise.all([prisma.userPlan.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } }), getPlanDays(true)]);
    return { plan: activePlan, days };
  });

  app.put('/api/plans/active', async (request, reply) => {
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid plan.', issues: parsed.error.flatten() });

    for (const day of parsed.data.days) {
      const trainingDay = await prisma.trainingDay.upsert({ where: { cycleDay: day.cycleDay }, update: { name: day.name }, create: { cycleDay: day.cycleDay, name: day.name } });
      for (const exercise of day.exercises) {
        if (exercise.id) {
          await prisma.exercise.update({ where: { id: exercise.id }, data: { trainingDayId: trainingDay.id, name: exercise.name, sets: exercise.sets, targetReps: exercise.targetReps, rpe: exercise.rpe, restSeconds: exercise.restSeconds, breath: exercise.breath, warmup: exercise.warmup, active: exercise.active, order: exercise.order } });
        } else {
          await prisma.exercise.create({ data: { trainingDayId: trainingDay.id, sourceId: exercise.sourceId ?? `custom-${Date.now()}-${exercise.order}`, name: exercise.name, sets: exercise.sets, targetReps: exercise.targetReps, rpe: exercise.rpe, restSeconds: exercise.restSeconds, breath: exercise.breath, warmup: exercise.warmup, active: exercise.active, order: exercise.order } });
        }
      }
    }

    await prisma.userPlan.updateMany({ data: { active: false }, where: { active: true } });
    const plan = await prisma.userPlan.create({ data: { name: parsed.data.name, active: true, data: parsed.data.days } });
    return { plan, days: await getPlanDays(true) };
  });

  app.post('/api/plans/reset-to-template', async (_request, reply) => {
    const template = await prisma.planTemplate.findUnique({ where: { name: 'Butterfly Base Hypertrophy Plan' } });
    if (!template) return reply.code(404).send({ message: 'Base template not found.' });
    for (const day of template.data as Array<{ cycleDay: number; name: string; exercises: Array<{ id: string; name: string; sets: number; reps: string; rpe: string | number; rest: number; breath: string; warmup: boolean; order: number; active: boolean }> }>) {
      const trainingDay = await prisma.trainingDay.upsert({ where: { cycleDay: day.cycleDay }, update: { name: day.name }, create: { cycleDay: day.cycleDay, name: day.name } });
      for (const exercise of day.exercises) {
        await prisma.exercise.upsert({ where: { sourceId: exercise.id }, update: { trainingDayId: trainingDay.id, name: exercise.name, sets: exercise.sets, targetReps: exercise.reps, rpe: String(exercise.rpe), restSeconds: exercise.rest, breath: exercise.breath, warmup: exercise.warmup, active: true, order: exercise.order }, create: { trainingDayId: trainingDay.id, sourceId: exercise.id, name: exercise.name, sets: exercise.sets, targetReps: exercise.reps, rpe: String(exercise.rpe), restSeconds: exercise.rest, breath: exercise.breath, warmup: exercise.warmup, active: true, order: exercise.order } });
      }
    }
    await prisma.userPlan.updateMany({ data: { active: false }, where: { active: true } });
    const plan = await prisma.userPlan.create({ data: { name: 'Agustin Active Plan', active: true, data: template.data ?? [] } });
    return { plan, days: await getPlanDays(true) };
  });
}



