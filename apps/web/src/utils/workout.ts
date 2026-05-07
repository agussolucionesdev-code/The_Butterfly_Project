import type { SetLog, TrainingDay } from '../types';

export interface WorkoutProgress {
  completedSets: number;
  totalSets: number;
  completionRatio: number;
}

export function resolveCycleDate(currentCycleDay: number, currentCycleDate: string, targetCycleDay: number): string {
  const baseDate = new Date(`${currentCycleDate}T00:00:00`);
  const offset = currentCycleDay - targetCycleDay;
  baseDate.setDate(baseDate.getDate() - offset);
  return baseDate.toISOString().slice(0, 10);
}

export function getWorkoutProgress(day: TrainingDay | null, logs: SetLog[]): WorkoutProgress {
  const totalSets = day?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const completedSets = logs.length;

  return {
    completedSets,
    totalSets,
    completionRatio: totalSets === 0 ? 0 : completedSets / totalSets
  };
}

export function getEstimatedVolume(logs: SetLog[]): number {
  return logs.reduce((sum, log) => sum + log.weightKg * log.reps, 0);
}
