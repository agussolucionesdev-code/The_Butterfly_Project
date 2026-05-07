import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { formatDateOnly, getCycleDay, isFutureCycleDay, parseDateOnly } from '@butterfly/shared';
import { prisma } from './db.js';

const setLogSchema = z.object({
  exerciseId: z.string().min(1),
  cycleDay: z.number().int().min(1).max(7),
  cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setNumber: z.number().int().positive(),
  weightKg: z.number().positive(),
  reps: z.number().int().positive()
});

function serializeLog(log: { weightKg: unknown; cycleDate: Date } & Record<string, unknown>) {
  return { ...log, weightKg: Number(log.weightKg), cycleDate: formatDateOnly(log.cycleDate) };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, service: 'butterfly-api' }));

  app.get('/api/training/today', async () => {
    const cycleDay = getCycleDay();
    const day = await prisma.trainingDay.findUnique({ where: { cycleDay }, include: { exercises: { orderBy: { order: 'asc' } } } });
    return { cycleDay, cycleDate: formatDateOnly(new Date()), locked: false, day };
  });

  app.get('/api/training/day/:cycleDay', async (request, reply) => {
    const params = z.object({ cycleDay: z.coerce.number().int().min(1).max(7) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Invalid cycle day.' });
    const cycleDay = params.data.cycleDay;
    const locked = isFutureCycleDay(cycleDay);
    const day = await prisma.trainingDay.findUnique({ where: { cycleDay }, include: { exercises: { orderBy: { order: 'asc' } } } });
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
    if (!exercise) return reply.code(404).send({ message: 'Exercise not found.' });
    if (exercise.trainingDay.cycleDay !== input.cycleDay) return reply.code(400).send({ message: 'Exercise does not belong to cycle day.' });
    if (input.setNumber > exercise.sets) return reply.code(400).send({ message: 'Set number exceeds exercise set count.' });

    const log = await prisma.setLog.upsert({
      where: { exerciseId_cycleDate_setNumber: { exerciseId: input.exerciseId, cycleDate: parseDateOnly(input.cycleDate), setNumber: input.setNumber } },
      update: { weightKg: input.weightKg, reps: input.reps, completedAt: new Date() },
      create: { exerciseId: input.exerciseId, cycleDay: input.cycleDay, cycleDate: parseDateOnly(input.cycleDate), setNumber: input.setNumber, weightKg: input.weightKg, reps: input.reps }
    });

    const next = input.setNumber < exercise.sets ? { type: 'next-set', exerciseId: exercise.id, setNumber: input.setNumber + 1 } : { type: 'next-exercise' };
    return reply.code(201).send({ log: serializeLog(log), restSeconds: exercise.restSeconds, next });
  });
}
