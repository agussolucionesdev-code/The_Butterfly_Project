import type { BodyMetric, ExerciseHistory, ExerciseMetadata, ProgressionSuggestion, SetLog, TrainingDay, VolumeAnalytics } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Request failed.');
  return response.json();
}

export async function getToday(): Promise<{ cycleDay: number; cycleDate: string; day: TrainingDay }> {
  return api('/api/training/today');
}

export async function getDay(cycleDay: number): Promise<{ cycleDay: number; locked: boolean; day: TrainingDay }> {
  return api(`/api/training/day/${cycleDay}`);
}

export async function getLogs(cycleDate: string): Promise<{ logs: SetLog[] }> {
  return api(`/api/logs?cycleDate=${cycleDate}`);
}

export async function saveSet(input: {
  exerciseId: string;
  cycleDay: number;
  cycleDate: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir?: number;
  actualRpe?: number;
  tempo?: string;
  painLevel?: number;
  notes?: string;
  restTakenSeconds?: number;
}): Promise<{ log: SetLog; restSeconds: number; next: unknown }> {
  return api('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function resetDayLogs(input: { cycleDay: number; cycleDate: string }): Promise<{ ok: true; deletedLogs: number }> {
  return api('/api/logs/reset-day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function getExerciseHistory(exerciseId: string): Promise<{ history: ExerciseHistory }> {
  return api(`/api/exercises/${exerciseId}/history`);
}

export async function getExerciseMetadata(exerciseId: string): Promise<{ metadata: ExerciseMetadata }> {
  return api(`/api/exercises/${exerciseId}/metadata`);
}

export async function getVolumeAnalytics(from?: string, to?: string): Promise<{ from: string; to: string; volume: VolumeAnalytics }> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return api(`/api/analytics/volume${params.size ? `?${params}` : ''}`);
}

export async function getProgressionSuggestions(): Promise<{ suggestions: ProgressionSuggestion[] }> {
  return api('/api/analytics/progression');
}

export async function acceptProgression(id: string): Promise<{ suggestion: ProgressionSuggestion }> {
  return api(`/api/progression/${id}/accept`, { method: 'POST' });
}

export async function rejectProgression(id: string): Promise<{ suggestion: ProgressionSuggestion }> {
  return api(`/api/progression/${id}/reject`, { method: 'POST' });
}

export async function getBodyMetrics(): Promise<{ metrics: BodyMetric[] }> {
  return api('/api/body-metrics');
}

export async function saveBodyMetric(input: { date: string; bodyWeightKg: number; proteinGrams: number; notes?: string }): Promise<{ metric: BodyMetric }> {
  return api('/api/body-metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function getActivePlan(): Promise<{ plan: unknown; days: TrainingDay[] }> {
  return api('/api/plans/active');
}

export async function saveActivePlan(input: { name: string; days: TrainingDay[] }): Promise<{ plan: unknown; days: TrainingDay[] }> {
  return api('/api/plans/active', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function resetPlanToTemplate(): Promise<{ plan: unknown; days: TrainingDay[] }> {
  return api('/api/plans/reset-to-template', { method: 'POST' });
}
