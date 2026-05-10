import { parseHighRep, parseLowRep } from './analytics.js';

type ExerciseLike = {
  id: string;
  name: string;
  sets: number;
  targetReps: string;
  rpe: string;
  plannedWeightKg: unknown | null;
  metadata: null | {
    kind: string;
    overloadRecommendation: string;
  };
  logs: Array<{
    cycleDate: Date;
    setNumber: number;
    weightKg: unknown;
    reps: number;
    rir: number | null;
    actualRpe: number | null;
    painLevel: number | null;
    techniqueStatus: string | null;
  }>;
};

export type ProgressionOutcome = {
  evaluatedCycleDate: Date;
  reason: string;
  action: string;
  plannedWeightKg: number | null;
  plannedRepGoal: number | null;
  autoApplied: boolean;
};

function formatDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

function roundLoad(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function latestSessionLogs(exercise: ExerciseLike) {
  const latestDate = exercise.logs[0]?.cycleDate;
  if (!latestDate) return null;
  const latestKey = formatDateOnly(latestDate);
  const logs = exercise.logs
    .filter((log) => formatDateOnly(log.cycleDate) === latestKey)
    .sort((a, b) => a.setNumber - b.setNumber);

  if (logs.length < exercise.sets) return null;
  return { latestDate, logs };
}

function loadIncrement(exercise: ExerciseLike) {
  const name = exercise.name.toLowerCase();
  const kind = exercise.metadata?.kind ?? 'compound';

  if (kind === 'isolation') {
    if (name.includes('manc')) return 1;
    return 0.5;
  }

  if (name.includes('manc')) return 1;
  if (name.includes('sentadilla') || name.includes('peso muerto') || name.includes('hip thrust')) return 5;
  return 2.5;
}

function deriveLoad(logs: ExerciseLike['logs']) {
  return Math.max(...logs.map((log) => Number(log.weightKg)), 0);
}

function deriveTechnique(logs: ExerciseLike['logs']) {
  if (logs.some((log) => log.techniqueStatus === 'compensated')) return 'compensated';
  if (logs.some((log) => log.techniqueStatus === 'grindy')) return 'grindy';
  return 'clean';
}

function derivePain(logs: ExerciseLike['logs']) {
  return Math.max(...logs.map((log) => log.painLevel ?? 0), 0);
}

export function evaluateExerciseProgression(exercise: ExerciseLike): ProgressionOutcome | null {
  const session = latestSessionLogs(exercise);
  if (!session) return null;

  const lowRep = parseLowRep(exercise.targetReps);
  const highRep = parseHighRep(exercise.targetReps);
  const currentWeight = deriveLoad(session.logs);
  const currentTopRep = Math.max(...session.logs.map((log) => log.reps), 0);
  const plannedWeight = exercise.plannedWeightKg == null ? null : Number(exercise.plannedWeightKg);
  const increment = loadIncrement(exercise);
  const pain = derivePain(session.logs);
  const technique = deriveTechnique(session.logs);
  const allAtTop = highRep != null && session.logs.every((log) => log.reps >= highRep);
  const anyBelowLow = lowRep != null && session.logs.some((log) => log.reps < lowRep);
  const effortControlled = session.logs.every((log) => (log.rir ?? 1) >= 1) && session.logs.every((log) => (log.actualRpe ?? 8) <= 9);
  const kind = exercise.metadata?.kind ?? 'compound';

  if (pain >= 4 || technique === 'compensated') {
    const reducedWeight = currentWeight > 0 ? roundLoad(Math.max(currentWeight - increment, currentWeight * 0.95)) : plannedWeight;
    return {
      evaluatedCycleDate: session.latestDate,
      reason: pain >= 4
        ? `Hubo dolor relevante (${pain}/10) en la sesión del ${formatDateOnly(session.latestDate)}.`
        : `La técnica se compensó en la sesión del ${formatDateOnly(session.latestDate)}.`,
      action: 'Bajé la exigencia para la próxima sesión: priorizá rango limpio, control y cero dolor antes de volver a empujar carga.',
      plannedWeightKg: reducedWeight,
      plannedRepGoal: lowRep,
      autoApplied: true
    };
  }

  if (kind === 'isolation') {
    if (allAtTop && effortControlled) {
      return {
        evaluatedCycleDate: session.latestDate,
        reason: `Cerraste todas las series en el tope del rango (${exercise.targetReps}) con técnica controlada.`,
        action: 'Auto-progresé este aislado: primero mantengo control y subo el mínimo peso posible.',
        plannedWeightKg: currentWeight > 0 ? roundLoad(currentWeight + increment) : plannedWeight,
        plannedRepGoal: lowRep,
        autoApplied: true
      };
    }

    const nextRepGoal = highRep == null ? currentTopRep : Math.min(highRep, currentTopRep + 1);
    return {
      evaluatedCycleDate: session.latestDate,
      reason: `Todavía hay margen para exprimir repeticiones útiles en ${exercise.name}.`,
      action: 'Mantengo la carga y te pido una repetición más limpia antes de mover el peso.',
      plannedWeightKg: currentWeight || plannedWeight,
      plannedRepGoal: nextRepGoal || lowRep,
      autoApplied: true
    };
  }

  if (allAtTop && effortControlled) {
    return {
      evaluatedCycleDate: session.latestDate,
      reason: `Completaste ${exercise.sets} series en el rango alto (${exercise.targetReps}) sin perder control.`,
      action: 'Auto-progresé la carga para aumentar tensión mecánica en la próxima sesión.',
      plannedWeightKg: currentWeight > 0 ? roundLoad(currentWeight + increment) : plannedWeight,
      plannedRepGoal: lowRep,
      autoApplied: true
    };
  }

  if (anyBelowLow) {
    return {
      evaluatedCycleDate: session.latestDate,
      reason: `Te quedaste por debajo del mínimo del rango (${exercise.targetReps}) en al menos una serie.`,
      action: 'Mantengo o bajo levemente la exigencia: buscá consolidar el piso del rango antes de volver a subir.',
      plannedWeightKg: currentWeight > 0 ? roundLoad(currentWeight) : plannedWeight,
      plannedRepGoal: lowRep,
      autoApplied: true
    };
  }

  const nextRepGoal = highRep == null ? currentTopRep : Math.min(highRep, Math.max(lowRep ?? currentTopRep, currentTopRep + 1));
  return {
    evaluatedCycleDate: session.latestDate,
    reason: `La sesión quedó dentro del rango, pero todavía no pidió más carga.`,
    action: 'Mantengo la carga y te marco una repetición objetivo extra para seguir acumulando calidad.',
    plannedWeightKg: currentWeight || plannedWeight,
    plannedRepGoal: nextRepGoal || lowRep,
    autoApplied: true
  };
}
