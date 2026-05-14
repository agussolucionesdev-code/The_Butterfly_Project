import type { BodyAnalysis, BodyMetric, CoachRecommendation, DailyChallenge, ExerciseHistory, ExerciseMetadata, FoodItem, HabitGoal, HabitLog, NutritionLog, ProgressPhoto, ProgressionAnalytics, ProgressionSuggestion, SetLog, TrainingDay, VolumeAnalytics, WorkoutSessionSummary } from './types';

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
  setType?: 'working' | 'approach';
  approachOrder?: number;
  weightKg: number;
  reps: number;
  rir?: number;
  actualRpe?: number;
  techniqueStatus?: 'clean' | 'grindy' | 'compensated';
  tempo?: string;
  tempoSeconds?: number;
  holdSeconds?: number;
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

export async function getProgressionSuggestions(): Promise<ProgressionAnalytics> {
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
export async function saveApproachSet(input: Parameters<typeof saveSet>[0] & { approachOrder: number }): Promise<{ log: SetLog; restSeconds: number; next: unknown }> {
  return api('/api/logs/approach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, setType: 'approach' }) });
}

export async function startSession(input: { cycleDay: number; cycleDate: string; notes?: string }): Promise<{ session: WorkoutSessionSummary }> {
  return api('/api/sessions/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function getSessionSummary(input: { cycleDay: number; cycleDate: string }): Promise<{ session: WorkoutSessionSummary | null }> {
  const params = new URLSearchParams({ cycleDay: String(input.cycleDay), cycleDate: input.cycleDate });
  return api(`/api/sessions?${params.toString()}`);
}

export async function resetSession(input: { cycleDay: number; cycleDate: string }): Promise<{ ok: true; deletedLogs: number }> {
  return api('/api/sessions/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function getCoachToday(): Promise<{ recommendation: CoachRecommendation }> {
  return api('/api/coach/today');
}

export async function recalculateCoach(): Promise<{ recommendation: CoachRecommendation }> {
  return api('/api/coach/recalculate', { method: 'POST' });
}

export async function getNutritionToday(): Promise<{ date: string; targetProtein: { min: number; max: number }; proteinTotal: number; caloriesTotal: number; remainingProtein: number; logs: NutritionLog[]; foods: FoodItem[] }> {
  return api('/api/nutrition/today');
}

export async function saveNutritionLog(input: { date: string; meal: string; foodName: string; quantity?: number; proteinGrams: number; calories: number; notes?: string }): Promise<{ log: NutritionLog }> {
  return api('/api/nutrition/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function getHabitsToday(): Promise<{ date: string; goals: HabitGoal[]; logs: HabitLog[] }> {
  return api('/api/habits/today');
}

export async function checkHabit(input: { date: string; goalKey: string; completed: boolean; value?: string; notes?: string }): Promise<{ log: HabitLog }> {
  return api('/api/habits/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function getPhotos(): Promise<{ photos: ProgressPhoto[] }> {
  return api('/api/photos');
}

export async function savePhoto(input: { date: string; angle: 'front' | 'side' | 'back'; imageDataUrl?: string; imageUrl?: string; notes?: string }): Promise<{ photo: ProgressPhoto }> {
  return api('/api/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function analyzePhoto(id: string): Promise<{ analysis: BodyAnalysis }> {
  return api(`/api/photos/${id}/analyze`, { method: 'POST' });
}

export async function getChallengeToday(): Promise<{ challenge: DailyChallenge }> {
  return api('/api/challenges/today');
}

export async function completeChallenge(id: string, completed: boolean): Promise<{ challenge: DailyChallenge }> {
  return api(`/api/challenges/${id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) });
}
