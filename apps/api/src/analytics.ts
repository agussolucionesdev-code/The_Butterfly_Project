export function parseHighRep(target: string): number | null {
  const numbers = target.match(/\d+/g)?.map(Number) ?? [];
  return numbers.length ? Math.max(...numbers) : null;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function volumeOf(log: { weightKg: unknown; reps: number }) {
  return Number(log.weightKg) * log.reps;
}

export function summarizeVolume(logs: Array<{ cycleDate: Date; weightKg: unknown; reps: number; exercise: { name: string; metadata: null | { primaryMuscles: string[]; secondaryMuscles: string[]; stabilizerMuscles: string[] } } }>) {
  const byDay: Record<string, number> = {};
  const byExercise: Record<string, number> = {};
  const byMuscle: Record<string, number> = {};
  let total = 0;

  for (const log of logs) {
    const volume = volumeOf(log);
    const day = formatDate(log.cycleDate);
    total += volume;
    byDay[day] = (byDay[day] ?? 0) + volume;
    byExercise[log.exercise.name] = (byExercise[log.exercise.name] ?? 0) + volume;
    for (const muscle of log.exercise.metadata?.primaryMuscles ?? []) byMuscle[muscle] = (byMuscle[muscle] ?? 0) + volume;
    for (const muscle of log.exercise.metadata?.secondaryMuscles ?? []) byMuscle[muscle] = (byMuscle[muscle] ?? 0) + volume * 0.5;
    for (const muscle of log.exercise.metadata?.stabilizerMuscles ?? []) byMuscle[muscle] = (byMuscle[muscle] ?? 0) + volume * 0.25;
  }

  return { total, byDay, byExercise, byMuscle };
}

export function parseLowRep(target: string): number | null {
  const numbers = target.match(/\d+/g)?.map(Number) ?? [];
  return numbers.length ? Math.min(...numbers) : null;
}

export function summarizeAdherence(days: Array<{ date: string; proteinTargetMet: boolean; trainingCompleted: boolean; completedHabits: number; totalHabits: number }>) {
  const proteinDays = days.filter((day) => day.proteinTargetMet).length;
  const trainingDays = days.filter((day) => day.trainingCompleted).length;
  const habitCompletionRate = days.length
    ? days.reduce((total, day) => total + (day.totalHabits > 0 ? day.completedHabits / day.totalHabits : 0), 0) / days.length
    : 0;

  let currentTrainingStreak = 0;
  for (const day of [...days].reverse()) {
    if (!day.trainingCompleted) break;
    currentTrainingStreak += 1;
  }

  return {
    days,
    proteinDays,
    trainingDays,
    habitCompletionRate,
    currentTrainingStreak
  };
}
