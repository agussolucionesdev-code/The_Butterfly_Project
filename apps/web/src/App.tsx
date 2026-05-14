import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  HeartPulse,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Utensils,
  Volume2,
  Zap
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  acceptProgression,
  analyzePhoto,
  checkHabit,
  completeChallenge,
  getActivePlan,
  getAdherenceAnalytics,
  getBodyMetrics,
  getChallengeToday,
  getCoachToday,
  getDay,
  getExerciseHistory,
  getExerciseTrends,
  getHabitsToday,
  getLogs,
  getNutritionToday,
  getPhotos,
  getProgressionSuggestions,
  getSessionSummary,
  getToday,
  getVolumeAnalytics,
  recalculateCoach,
  rejectProgression,
  resetDayLogs,
  resetPlanToTemplate,
  resetSession,
  saveActivePlan,
  saveApproachSet,
  saveBodyMetric,
  saveNutritionLog,
  savePhoto,
  saveSet,
  startSession
} from './api';
import { useWorkoutStore } from './store/workoutStore';
import type { AdherenceAnalytics, BodyMetric, CoachRecommendation, DailyChallenge, Exercise, ExerciseHistory, ExerciseTrend, FoodItem, HabitGoal, HabitLog, NutritionLog, ProgressPhoto, ProgressionSuggestion, TrainingDay, VolumeAnalytics, WorkoutSessionSummary } from './types';
import { buildPhotoComparisons, buildProteinActionPlan } from './utils/insights';
import { getEstimatedVolume, getWorkoutProgress, resolveCycleDate } from './utils/workout';

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pecho',
  upper_chest: 'Pecho superior',
  front_delts: 'Deltoide anterior',
  side_delts: 'Deltoide lateral',
  rear_delts: 'Deltoide posterior',
  shoulders: 'Hombros',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Antebrazo',
  lats: 'Dorsal',
  upper_back: 'Espalda alta',
  traps: 'Trapecio',
  quads: 'Cuadriceps',
  hamstrings: 'Isquios',
  glutes: 'Gluteos',
  calves: 'Pantorrillas',
  abs: 'Abdominales',
  core: 'Core',
  spinal_erectors: 'Erectores',
  hip_flexors: 'Flexores de cadera'
};

type TabKey = 'flow' | 'dashboard' | 'analytics' | 'nutrition' | 'habits' | 'photos' | 'plan' | 'settings';
type TechniqueStatus = 'clean' | 'grindy' | 'compensated';
const APP_TABS: Array<[TabKey, string]> = [
  ['flow', 'Entreno'],
  ['dashboard', 'Tablero'],
  ['analytics', 'Analitica'],
  ['nutrition', 'Nutricion'],
  ['habits', 'Objetivos'],
  ['photos', 'Fotos'],
  ['plan', 'Plan'],
  ['settings', 'Ajustes']
];

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function clampNumericInput(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function muscleName(key: string) {
  return MUSCLE_LABELS[key] ?? key.replaceAll('_', ' ');
}

function topEntries(record: Record<string, number>, count = 5) {
  return Object.entries(record).sort((a, b) => b[1] - a[1]).slice(0, count);
}

function lowEntries(record: Record<string, number>, count = 3) {
  return Object.entries(record)
    .filter(([, value]) => value > 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, count);
}

function formatBestSet(history: ExerciseHistory | null) {
  if (!history || history.bestWeight <= 0 || history.bestReps <= 0) return 'Sin historial';
  return `${history.bestWeight} kg x ${history.bestReps}`;
}

function formatEquivalentSet(log?: ExerciseHistory['latestLogs'][number]) {
  if (!log) return 'Sin dato';
  return `${log.weightKg} kg x ${log.reps}`;
}

function formatTechnique(status?: TechniqueStatus | null) {
  if (status === 'clean') return 'Limpia';
  if (status === 'grindy') return 'Muy exigida';
  if (status === 'compensated') return 'Compensada';
  return 'Sin dato';
}

function dayLabel(cycleDay: number) {
  return `Dia ${cycleDay}`;
}

function buildYoutubeSearchUrl(exerciseName: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} tecnica ejercicio hipertrofia`)}`;
}

function buildExrxSearchUrl(exerciseName: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:exrx.net ${exerciseName}`)}`;
}

function buildAceSearchUrl(exerciseName: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:acefitness.org ${exerciseName}`)}`;
}

function resolveVideoResource(videoUrl: string | null | undefined, exerciseName: string) {
  const fallbackWatchUrl = buildYoutubeSearchUrl(exerciseName);

  if (!videoUrl || videoUrl.includes('youtube.com/embed?listType=search')) {
    return { embedUrl: null, watchUrl: fallbackWatchUrl };
  }

  return { embedUrl: videoUrl, watchUrl: fallbackWatchUrl };
}

function playTimerDoneSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch {
    // Audio feedback is best-effort only.
  }
}

function AnatomyMap({ exercise }: { exercise: Exercise | null }) {
  const primary = new Set(exercise?.metadata?.primaryMuscles ?? []);
  const secondary = new Set(exercise?.metadata?.secondaryMuscles ?? []);
  const stabilizers = new Set(exercise?.metadata?.stabilizerMuscles ?? []);

  const fill = (muscle: string) => {
    if (primary.has(muscle)) return '#CCFF00';
    if (secondary.has(muscle)) return '#94A3B8';
    if (stabilizers.has(muscle)) return '#5B6473';
    return '#161616';
  };

  return (
    <div className="surface-card p-4">
      <p className="section-label">Mapa muscular</p>
      <svg viewBox="0 0 220 320" className="mx-auto h-72 w-full max-w-[260px]">
        <circle cx="110" cy="28" r="18" fill="#161616" stroke="#2A2A2A" />
        <rect x="82" y="50" width="56" height="74" rx="18" fill={fill('chest')} stroke="#2A2A2A" />
        <rect x="72" y="54" width="18" height="56" rx="9" fill={fill('front_delts')} stroke="#2A2A2A" />
        <rect x="130" y="54" width="18" height="56" rx="9" fill={fill('front_delts')} stroke="#2A2A2A" />
        <rect x="52" y="84" width="18" height="72" rx="9" fill={fill('biceps')} stroke="#2A2A2A" />
        <rect x="150" y="84" width="18" height="72" rx="9" fill={fill('triceps')} stroke="#2A2A2A" />
        <rect x="86" y="126" width="48" height="48" rx="12" fill={fill('abs')} stroke="#2A2A2A" />
        <rect x="76" y="178" width="28" height="74" rx="11" fill={fill('quads')} stroke="#2A2A2A" />
        <rect x="116" y="178" width="28" height="74" rx="11" fill={fill('quads')} stroke="#2A2A2A" />
        <rect x="78" y="254" width="24" height="44" rx="10" fill={fill('calves')} stroke="#2A2A2A" />
        <rect x="118" y="254" width="24" height="44" rx="10" fill={fill('calves')} stroke="#2A2A2A" />
        <rect x="18" y="54" width="44" height="92" rx="16" fill={fill('lats')} stroke="#2A2A2A" opacity="0.95" />
        <rect x="158" y="54" width="44" height="92" rx="16" fill={fill('upper_back')} stroke="#2A2A2A" opacity="0.95" />
        <rect x="78" y="178" width="64" height="40" rx="16" fill={fill('glutes')} stroke="#2A2A2A" opacity="0.8" />
        <rect x="76" y="216" width="68" height="32" rx="14" fill={fill('hamstrings')} stroke="#2A2A2A" opacity="0.8" />
      </svg>
      <div className="mt-3 grid gap-2 text-xs text-steel">
        <p><span className="text-volt">Primarios:</span> {(exercise?.metadata?.primaryMuscles ?? []).map(muscleName).join(', ') || 'Sin datos'}</p>
        <p><span className="text-white">Secundarios:</span> {(exercise?.metadata?.secondaryMuscles ?? []).map(muscleName).join(', ') || 'Sin datos'}</p>
        <p><span className="text-steel">Estabilizadores:</span> {(exercise?.metadata?.stabilizerMuscles ?? []).map(muscleName).join(', ') || 'Sin datos'}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-steel">
        <span className="legend-chip"><span className="legend-dot bg-volt" />Primario</span>
        <span className="legend-chip"><span className="legend-dot bg-steel" />Secundario</span>
        <span className="legend-chip"><span className="legend-dot bg-[#5B6473]" />Estabiliza</span>
      </div>
    </div>
  );
}

export function App() {
  const [weightKg, setWeightKg] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('');
  const [actualRpe, setActualRpe] = useState('');
  const [painLevel, setPainLevel] = useState('0');
  const [techniqueStatus, setTechniqueStatus] = useState<TechniqueStatus>('clean');
  const [notes, setNotes] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('0');
  const [timerSecondsInput, setTimerSecondsInput] = useState('0');
  const [selectedCycleDay, setSelectedCycleDay] = useState<number | null>(null);
  const [currentCycleDay, setCurrentCycleDay] = useState(1);
  const [currentCycleDate, setCurrentCycleDate] = useState('');
  const [error, setError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingDay, setResettingDay] = useState(false);
  const [switchingDay, setSwitchingDay] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('flow');
  const [history, setHistory] = useState<ExerciseHistory | null>(null);
  const [volume, setVolume] = useState<VolumeAnalytics | null>(null);
  const [adherence, setAdherence] = useState<AdherenceAnalytics | null>(null);
  const [exerciseTrends, setExerciseTrends] = useState<ExerciseTrend[]>([]);
  const [suggestions, setSuggestions] = useState<ProgressionSuggestion[]>([]);
  const [latestApplied, setLatestApplied] = useState<ProgressionSuggestion[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [metricWeight, setMetricWeight] = useState('77.78');
  const [metricProtein, setMetricProtein] = useState('160');
  const [planDays, setPlanDays] = useState<TrainingDay[]>([]);
  const [planSaving, setPlanSaving] = useState(false);
  const [coachRecommendation, setCoachRecommendation] = useState<CoachRecommendation | null>(null);
  const [session, setSession] = useState<WorkoutSessionSummary | null>(null);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [nutritionTotals, setNutritionTotals] = useState({ proteinTotal: 0, caloriesTotal: 0, remainingProtein: 160 });
  const [habits, setHabits] = useState<{ goals: HabitGoal[]; logs: HabitLog[] }>({ goals: [], logs: [] });
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [approachMode, setApproachMode] = useState<'idle' | 'active' | 'skipped'>('idle');
  const [approachWeight, setApproachWeight] = useState('');
  const [approachReps, setApproachReps] = useState('');
  const [approachNotes, setApproachNotes] = useState('');
  const [approachPain, setApproachPain] = useState('0');
  const [nutritionMeal, setNutritionMeal] = useState('Almuerzo');
  const [nutritionFood, setNutritionFood] = useState('');
  const [nutritionProtein, setNutritionProtein] = useState('');
  const [nutritionCalories, setNutritionCalories] = useState('');
  const [photoAngle, setPhotoAngle] = useState<'front' | 'side' | 'back'>('front');
  const [photoDataUrl, setPhotoDataUrl] = useState('');

  const store = useWorkoutStore();
  const exercise = store.getCurrentExercise();
  const previousSet = store.getPreviousSet();
  const progress = useMemo(() => getWorkoutProgress(store.day, store.logs), [store.day, store.logs]);
  const estimatedVolume = useMemo(() => getEstimatedVolume(store.logs), [store.logs]);
  const viewedCycleDay = selectedCycleDay ?? currentCycleDay;
  const isViewingToday = viewedCycleDay === currentCycleDay;
  const nextExerciseName = store.day && exercise ? store.day.exercises[store.exerciseIndex + 1]?.name ?? 'Sesion completa' : 'Sesion completa';
  const metricForToday = metrics.find((metric) => metric.date === todayIso()) ?? null;
  const latestMetric = metricForToday ?? metrics[0] ?? null;
  const bodyProgress = latestMetric ? Math.min(100, Math.max(0, ((latestMetric.bodyWeightKg - 77.78) / (83 - 77.78)) * 100)) : 0;
  const strongestMuscles = topEntries(volume?.byMuscle ?? {}, 3);
  const weakestMuscles = lowEntries(volume?.byMuscle ?? {}, 3);
  const currentSuggestion = suggestions.find((item) => item.exerciseId === exercise?.id);
  const lastAppliedForCurrentExercise = latestApplied.find((item) => item.exerciseId === exercise?.id);
  const lastEquivalentSet = useMemo(() => history?.latestLogs.find((log) => log.setNumber === store.setNumber), [history, store.setNumber]);
  const recommendedWeight = exercise?.plannedWeightKg ?? null;
  const recommendedReps = exercise?.plannedRepGoal ?? null;
  const videoResource = resolveVideoResource(exercise?.metadata?.videoUrl, exercise?.name ?? '');
  const remainingSets = Math.max(0, progress.totalSets - progress.completedSets);
  const proteinToday = nutritionTotals.proteinTotal > 0 ? nutritionTotals.proteinTotal : metricForToday?.proteinGrams ?? 0;
  const proteinFloorGap = Math.max(0, 160 - proteinToday);
  const proteinTopGap = Math.max(0, 175 - proteinToday);
  const todayVolume = volume?.byDay?.[store.cycleDate] ?? 0;
  const completedHabitsCount = habits.logs.filter((log) => log.completed).length;
  const activeHabitsCount = habits.goals.length;
  const sessionCompleted = session?.status === 'completed';
  const sessionStarted = Boolean(session);
  const sessionProgressLabel = session ? `${session.completedWorkingSets}/${session.totalWorkingSets}` : 'Sin iniciar';
  const trainingStreak = adherence?.currentTrainingStreak ?? 0;
  const proteinConsistency = adherence ? `${adherence.proteinDays}/${adherence.days.length}` : '0/0';
  const trainingConsistency = adherence ? `${adherence.trainingDays}/${adherence.days.length}` : '0/0';
  const nextCoachCue = exercise?.metadata?.technicalCues?.[0] ?? 'Mantene la tecnica estable.';
  const nextCoachMistake = exercise?.metadata?.commonMistakes?.[0] ?? 'No compenses el patron por cargar de mas.';
  const firstExerciseFocus = store.day?.exercises[0]?.metadata?.technicalCues?.[0] ?? 'Cargue peso y proteina antes de arrancar.';
  const approachLogs = store.logs.filter((log) => log.exerciseId === exercise?.id && log.setType === 'approach');
  const shouldSuggestApproach = Boolean(exercise && approachMode === 'idle' && approachLogs.length === 0 && (exercise.warmup || store.exerciseIndex === 0));
  const proteinActionPlan = useMemo(() => buildProteinActionPlan(foodItems, proteinFloorGap), [foodItems, proteinFloorGap]);
  const photoComparisons = useMemo(() => buildPhotoComparisons(photos), [photos]);
  const approachBaseWeight = recommendedWeight ?? Number(lastEquivalentSet?.weightKg ?? history?.bestWeight ?? 0);
  const approachSuggestions = approachBaseWeight > 0
    ? [
        { label: '40-50%', weight: Math.max(1, Math.round(approachBaseWeight * 0.45 * 4) / 4), reps: '8-10' },
        { label: '60-70%', weight: Math.max(1, Math.round(approachBaseWeight * 0.65 * 4) / 4), reps: '5' },
        { label: '75-85%', weight: Math.max(1, Math.round(approachBaseWeight * 0.8 * 4) / 4), reps: '3' },
        { label: '90-95%', weight: Math.max(1, Math.round(approachBaseWeight * 0.92 * 4) / 4), reps: '1-2' }
      ]
    : [];

  async function refreshCoachData(currentExercise = exercise) {
    const [volumeResponse, progressionResponse, adherenceResponse, trendsResponse] = await Promise.all([
      getVolumeAnalytics(),
      getProgressionSuggestions(),
      getAdherenceAnalytics(),
      getExerciseTrends()
    ]);

    setVolume(volumeResponse.volume);
    setSuggestions(progressionResponse.suggestions);
    setLatestApplied(progressionResponse.latestApplied);
    setAdherence(adherenceResponse);
    setExerciseTrends(trendsResponse.trends);

    if (currentExercise) {
      setHistory((await getExerciseHistory(currentExercise.id)).history);
    } else {
      setHistory(null);
    }
  }

  async function refreshLifeData() {
    const [coach, nutrition, habitsResponse, photosResponse, challengeResponse] = await Promise.all([
      getCoachToday().catch(() => ({ recommendation: null })),
      getNutritionToday(),
      getHabitsToday(),
      getPhotos(),
      getChallengeToday()
    ]);
    setCoachRecommendation(coach.recommendation);
    setNutritionLogs(nutrition.logs);
    setFoodItems(nutrition.foods);
    setNutritionTotals({
      proteinTotal: nutrition.proteinTotal,
      caloriesTotal: nutrition.caloriesTotal,
      remainingProtein: nutrition.remainingProtein
    });
    setHabits({ goals: habitsResponse.goals, logs: habitsResponse.logs });
    setPhotos(photosResponse.photos);
    setChallenge(challengeResponse.challenge);
  }

  async function refreshSessionSummary(cycleDay = store.cycleDay, cycleDate = store.cycleDate) {
    if (!cycleDay || !cycleDate) {
      setSession(null);
      return null;
    }

    const response = await getSessionSummary({ cycleDay, cycleDate });
    setSession(response.session);
    return response.session;
  }

  async function ensureSessionStarted() {
    const response = await startSession({ cycleDay: store.cycleDay, cycleDate: store.cycleDate });
    setSession(response.session);
    return response.session;
  }

  async function refreshCoachNow(message = 'Coach recalculado con tus datos actuales.') {
    const response = await recalculateCoach();
    setCoachRecommendation(response.recommendation);
    await refreshSessionSummary();
    await refreshLifeData();
    setStatusNotice(message);
  }

  async function loadWorkoutForDay(targetCycleDay?: number) {
    const today = await getToday();
    const nextCycleDay = targetCycleDay ?? today.cycleDay;
    const targetDate = resolveCycleDate(today.cycleDay, today.cycleDate, nextCycleDay);
    const [dayResponse, logsResponse] = await Promise.all([
      nextCycleDay === today.cycleDay ? Promise.resolve({ cycleDay: today.cycleDay, locked: false, day: today.day }) : getDay(nextCycleDay),
      getLogs(targetDate)
    ]);

    if (dayResponse.locked) throw new Error('Los dias futuros estan bloqueados.');

    store.setWorkout(nextCycleDay, targetDate, dayResponse.day, logsResponse.logs);
    setCurrentCycleDay(today.cycleDay);
    setCurrentCycleDate(today.cycleDate);
    setSelectedCycleDay(nextCycleDay);
    const sessionResponse = await getSessionSummary({ cycleDay: nextCycleDay, cycleDate: targetDate });
    setSession(sessionResponse.session);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadWorkoutForDay();
        const [plan, body] = await Promise.all([getActivePlan(), getBodyMetrics()]);
        setPlanDays(plan.days);
        setMetrics(body.metrics);
        await refreshCoachData();
        await refreshLifeData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No pude inicializar la consola de entrenamiento.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!store.timerActive || store.timerPaused) return;
    const id = window.setInterval(() => store.tickTimer(), 1000);
    return () => window.clearInterval(id);
  }, [store.timerActive, store.timerPaused, store.tickTimer]);

  useEffect(() => {
    setTimerMinutes(String(Math.floor(store.timerSeconds / 60)));
    setTimerSecondsInput(String(store.timerSeconds % 60));
  }, [store.timerSeconds]);

  useEffect(() => {
    if (store.timerActive && !store.timerPaused && store.timerSeconds === 1) playTimerDoneSound();
  }, [store.timerActive, store.timerPaused, store.timerSeconds]);

  useEffect(() => {
    if (exercise) {
      void getExerciseHistory(exercise.id).then((response) => setHistory(response.history)).catch(() => undefined);
      setApproachMode('idle');
      setApproachWeight('');
      setApproachReps('');
      setApproachNotes('');
    }
  }, [exercise?.id]);

  useEffect(() => {
    if (!statusNotice) return;
    const id = window.setTimeout(() => setStatusNotice(''), 4500);
    return () => window.clearTimeout(id);
  }, [statusNotice]);

  async function handleDaySelection(targetCycleDay: number) {
    if (targetCycleDay > currentCycleDay || targetCycleDay === viewedCycleDay) return;
    setError('');
    setSwitchingDay(true);

    try {
      await loadWorkoutForDay(targetCycleDay);
      await refreshCoachData();
      setStatusNotice(targetCycleDay === currentCycleDay ? 'Volviste a tu sesion actual.' : `Cargue el historial del dia ${targetCycleDay}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude cambiar de dia.');
    } finally {
      setSwitchingDay(false);
    }
  }

  function applyCustomTimer() {
    store.setTimerSeconds(Math.max(0, Math.floor(clampNumericInput(timerMinutes))) * 60 + Math.min(59, Math.max(0, Math.floor(clampNumericInput(timerSecondsInput)))));
    setStatusNotice('Timer manual aplicado.');
  }

  function useGhostSetValues() {
    if (!previousSet) return;
    setWeightKg(String(previousSet.weightKg));
    setReps(String(previousSet.reps));
    setStatusNotice('Reutilice los valores del ghost set.');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!exercise || !weightKg || !reps || saving) return;

    const parsedWeight = Number(weightKg);
    const parsedReps = Number(reps);
    if (!(parsedWeight > 0) || !(parsedReps > 0)) {
      setError('Peso y reps tienen que ser positivos.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      if (!sessionStarted) await ensureSessionStarted();
      const result = await saveSet({
        exerciseId: exercise.id,
        cycleDay: store.cycleDay,
        cycleDate: store.cycleDate,
        setNumber: store.setNumber,
        weightKg: parsedWeight,
        reps: parsedReps,
        rir: rir ? Number(rir) : undefined,
        actualRpe: actualRpe ? Number(actualRpe) : undefined,
        techniqueStatus,
        painLevel: painLevel ? Number(painLevel) : undefined,
        notes: notes || undefined,
        restTakenSeconds: store.timerInitialSeconds || undefined
      });

      store.addLog(result.log);
      setWeightKg('');
      setReps('');
      setRir('');
      setActualRpe('');
      setPainLevel('0');
      setTechniqueStatus('clean');
      setNotes('');
      await refreshCoachData(exercise);
      await refreshSessionSummary();
      await refreshLifeData();
      setStatusNotice(result.restSeconds > 0 ? 'Set guardado. Arranca el descanso.' : 'Set guardado. Seguis sin descanso.');

      if (result.restSeconds > 0) store.startTimer(result.restSeconds);
      else store.advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude guardar el set.');
    } finally {
      setSaving(false);
    }
  }

  async function onApproachSubmit(event: FormEvent) {
    event.preventDefault();
    if (!exercise || !approachWeight || !approachReps || saving) return;
    const parsedWeight = Number(approachWeight);
    const parsedReps = Number(approachReps);
    if (!(parsedWeight > 0) || !(parsedReps > 0)) {
      setError('La aproximacion necesita peso y reps positivos.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (!sessionStarted) await ensureSessionStarted();
      const result = await saveApproachSet({
        exerciseId: exercise.id,
        cycleDay: store.cycleDay,
        cycleDate: store.cycleDate,
        setNumber: approachLogs.length + 1,
        approachOrder: approachLogs.length + 1,
        weightKg: parsedWeight,
        reps: parsedReps,
        painLevel: approachPain ? Number(approachPain) : undefined,
        notes: approachNotes || undefined
      });
      store.addLog(result.log);
      setApproachWeight('');
      setApproachReps('');
      setApproachNotes('');
      setApproachPain('0');
      setApproachMode('active');
      await refreshSessionSummary();
      setStatusNotice('Aproximacion guardada. No cuenta para volumen ni progresion.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude guardar la aproximacion.');
    } finally {
      setSaving(false);
    }
  }

  async function saveMetric(event: FormEvent) {
    event.preventDefault();
    const response = await saveBodyMetric({
      date: todayIso(),
      bodyWeightKg: Number(metricWeight),
      proteinGrams: Number(metricProtein)
    });

    setMetrics([response.metric, ...metrics.filter((metric) => metric.date !== response.metric.date)]);
    setStatusNotice('Metricas corporales guardadas para hoy.');
  }

  async function addNutrition(event: FormEvent) {
    event.preventDefault();
    const response = await saveNutritionLog({
      date: todayIso(),
      meal: nutritionMeal,
      foodName: nutritionFood,
      quantity: 1,
      proteinGrams: Number(nutritionProtein),
      calories: Number(nutritionCalories)
    });
    setNutritionLogs([...nutritionLogs, response.log]);
    await refreshLifeData();
    setNutritionFood('');
    setNutritionProtein('');
    setNutritionCalories('');
    await refreshCoachNow('Comida registrada. Coach actualizado con tu proteina real.');
  }

  async function toggleHabit(goalKey: string, completed: boolean) {
    const response = await checkHabit({ date: todayIso(), goalKey, completed });
    setHabits((current) => ({
      ...current,
      logs: [...current.logs.filter((log) => log.goalKey !== goalKey), response.log]
    }));
    await refreshCoachNow(completed ? 'Habito cumplido. Coach actualizado.' : 'Habito desmarcado. Coach actualizado.');
  }

  async function toggleChallengeCompletion() {
    if (!challenge) return;
    const response = await completeChallenge(challenge.id, !challenge.completed);
    setChallenge(response.challenge);
    setStatusNotice(response.challenge.completed ? 'Reto diario marcado como cumplido.' : 'Reto diario vuelto a pendiente.');
  }

  async function handlePhotoFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

  async function uploadPhoto() {
    if (!photoDataUrl) return;
    const response = await savePhoto({ date: todayIso(), angle: photoAngle, imageDataUrl: photoDataUrl });
    const analysis = await analyzePhoto(response.photo.id);
    setPhotos([{ ...response.photo, analyses: [analysis.analysis] }, ...photos]);
    setPhotoDataUrl('');
    setStatusNotice('Foto guardada y analisis inicial creado.');
  }

  async function resolveSuggestion(id: string, accepted: boolean) {
    if (accepted) await acceptProgression(id);
    else await rejectProgression(id);
    await loadWorkoutForDay(viewedCycleDay);
    await refreshCoachData();
    setStatusNotice(accepted ? 'Progresion aplicada.' : 'Progresion pospuesta.');
  }

  async function resetCurrentSession() {
    const sessionLabel = isViewingToday ? 'la sesion de hoy' : `el dia ${viewedCycleDay}`;
    if (!window.confirm(`Vas a borrar todos los sets guardados de ${sessionLabel} y volver a empezar desde cero. ¿Continuar?`)) return;

    setResettingDay(true);
    setError('');

    try {
      await resetSession({ cycleDay: viewedCycleDay, cycleDate: store.cycleDate });
      setWeightKg('');
      setReps('');
      setRir('');
      setActualRpe('');
      setPainLevel('0');
      setTechniqueStatus('clean');
      setNotes('');
      setApproachMode('idle');
      setApproachWeight('');
      setApproachReps('');
      setApproachNotes('');
      await loadWorkoutForDay(viewedCycleDay);
      await refreshCoachData();
      await refreshLifeData();
      setSession(null);
      setActiveTab('flow');
      setStatusNotice('Sesion reiniciada desde cero.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reiniciar la sesion.');
    } finally {
      setResettingDay(false);
    }
  }

  function updatePlanExercise(dayIndex: number, exerciseIndex: number, patch: Partial<Exercise>) {
    setPlanDays((days) =>
      days.map((day, index) =>
        index !== dayIndex
          ? day
          : { ...day, exercises: day.exercises.map((item, itemIndex) => itemIndex !== exerciseIndex ? item : { ...item, ...patch }) }
      )
    );
  }

  function addCustomExercise(dayIndex: number) {
    setPlanDays((days) =>
      days.map((day, index) =>
        index !== dayIndex
          ? day
          : {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  id: '',
                  sourceId: '',
                  name: 'Nuevo ejercicio',
                  sets: 3,
                  targetReps: '8-10',
                  rpe: '8',
                  restSeconds: 90,
                  breath: 'Inhala / Exhala',
                  warmup: false,
                  active: true,
                  order: day.exercises.length + 1
                }
              ]
            }
      )
    );
  }

  async function persistPlan() {
    setPlanSaving(true);
    try {
      const response = await saveActivePlan({ name: 'Agustin Active Plan', days: planDays });
      setPlanDays(response.days);
      await loadWorkoutForDay(viewedCycleDay);
      await refreshCoachData();
      setStatusNotice('Plan guardado.');
    } finally {
      setPlanSaving(false);
    }
  }

  async function resetPlan() {
    setPlanSaving(true);
    try {
      const response = await resetPlanToTemplate();
      setPlanDays(response.days);
      await loadWorkoutForDay(viewedCycleDay);
      await refreshCoachData();
      setStatusNotice('Restaure la rutina base.');
    } finally {
      setPlanSaving(false);
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-obsidian text-volt font-mono">Cargando consola de entrenamiento...</main>;
  }

  if (store.timerActive) {
    return (
      <main className="app-shell flex min-h-screen flex-col items-center justify-center p-6 text-center text-white">
        <div className="hero-panel w-full max-w-3xl p-8">
          <Timer className="mx-auto mb-6 text-volt" size={48} />
          <p className="section-label mb-3">Recuperacion activa</p>
          <h1 className="font-mono text-7xl text-volt mb-4">{formatTime(store.timerSeconds)}</h1>
          <p className="mx-auto mb-6 max-w-md text-steel">
            Siguiente paso: <strong className="text-white">{store.setNumber < (exercise?.sets ?? 0) ? `Set ${store.setNumber + 1}` : nextExerciseName}</strong>
          </p>
          <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-4">
            {[-20, -15, -10, 10, 15, 20].map((seconds) => (
              <button key={seconds} className={`btn-secondary ${seconds < 0 ? 'text-red-200' : ''}`} onClick={() => store.addTimerSeconds(seconds)}>
                {seconds > 0 ? `+${seconds}s` : `${seconds}s`}
              </button>
            ))}
          </div>
          <div className="surface-card mx-auto mb-4 w-full max-w-md p-4">
            <p className="section-label mb-3">Timer manual</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <label className="field text-left">Minutos<input value={timerMinutes} onChange={(event) => setTimerMinutes(event.target.value)} type="number" min="0" step="1" /></label>
              <span className="font-mono text-2xl mt-6">:</span>
              <label className="field text-left">Segundos<input value={timerSecondsInput} onChange={(event) => setTimerSecondsInput(event.target.value)} type="number" min="0" max="59" step="1" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button className="btn-secondary" onClick={applyCustomTimer}>Aplicar tiempo</button>
              <button className="btn-secondary" onClick={store.resetTimer}><RotateCcw size={16} /> Reiniciar</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            <button className="btn-primary" onClick={store.togglePause}>{store.timerPaused ? 'Continuar' : 'Pausar'}</button>
            <button className="btn-secondary" onClick={store.skipTimer}>Estoy listo, seguir ahora</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen p-4 pb-24 text-white sm:p-8 sm:pb-8">
      <section className="mx-auto max-w-7xl">
        <header className="hero-panel mb-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-volt font-mono uppercase tracking-[0.3em] text-xs"><Zap size={14} /> The Butterfly Project</div>
              <h1 className="mt-3 text-3xl font-mono text-white sm:text-4xl">{store.day?.name ?? 'Sin entrenamiento cargado'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-steel">
                {isViewingToday ? 'Hoy entrenas en vivo.' : `Estas revisando el historial del dia ${viewedCycleDay}.`} La app te marca que hacer ahora, que tocar despues y como progresar sin improvisar.
              </p>
            </div>
            <div className="grid min-w-[240px] gap-3 sm:grid-cols-2">
              <div className="metric metric-highlight">
                <span>Dia actual</span>
                <strong>{dayLabel(currentCycleDay)}</strong>
                <p className="mt-2 text-xs text-steel">Fecha base: {currentCycleDate || todayIso()}</p>
              </div>
              <div className="metric">
                <span>Set en curso</span>
                <strong>{store.completed ? 'Completo' : `${store.setNumber}/${exercise?.sets ?? 0}`}</strong>
                <p className="mt-2 text-xs text-steel">{exercise?.name ?? 'Sin ejercicio activo'}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="metric"><span>Sets listos</span><strong>{progress.completedSets}/{progress.totalSets}</strong></div>
            <div className="metric"><span>Volumen del dia</span><strong>{todayVolume.toFixed(0)} kg</strong></div>
            <div className="metric"><span>Proteina hoy</span><strong>{proteinToday} g</strong></div>
            <div className="metric"><span>Meta hacia 83 kg</span><strong>{latestMetric?.bodyWeightKg ?? 77.78} kg</strong></div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => {
              const locked = day > currentCycleDay;
              const selected = day === viewedCycleDay;

              return (
                <button
                  key={day}
                  type="button"
                  title={`${dayLabel(day)}${locked ? ' - bloqueado' : day === currentCycleDay ? ' - disponible hoy' : ' - historial disponible'}`}
                  aria-label={`${dayLabel(day)}${locked ? ' bloqueado' : ''}`}
                  disabled={locked || switchingDay}
                  onClick={() => handleDaySelection(day)}
                  className={`day-pill flex min-h-14 flex-col items-center justify-center gap-1 ${selected ? 'day-pill-active' : ''} ${locked ? 'day-pill-locked' : ''}`}
                >
                  <span className="font-mono text-sm">{locked ? <Lock size={14} /> : day}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-steel">{dayLabel(day)}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <nav className="surface-card hidden grid-cols-2 gap-2 p-2 md:grid md:grid-cols-4 xl:grid-cols-8">
            {APP_TABS.map(([key, label]) => (
              <button key={key} className={activeTab === key ? 'btn-primary' : 'nav-tab'} onClick={() => setActiveTab(key)}>{label}</button>
            ))}
          </nav>
          <div className="surface-card flex flex-wrap items-center gap-2 p-2">
            <button className="btn-danger" type="button" onClick={resetCurrentSession} disabled={resettingDay || !store.day}><RotateCcw size={16} /> {resettingDay ? 'Reiniciando...' : 'Reiniciar sesion'}</button>
            {!isViewingToday && <button className="btn-tertiary" type="button" onClick={() => void handleDaySelection(currentCycleDay)}>Volver a hoy</button>}
          </div>
        </div>

        {error && <p className="notice notice-error mb-4"><AlertTriangle size={16} /> {error}</p>}
        {statusNotice && <p className="notice notice-success mb-4"><CheckCircle2 size={16} /> {statusNotice}</p>}

        {activeTab === 'dashboard' && (
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric"><span>Peso hacia 83 kg</span><strong>{latestMetric?.bodyWeightKg ?? 77.78} kg</strong><div className="h-2 bg-obsidian rounded mt-3 overflow-hidden"><div className="h-full bg-volt" style={{ width: `${bodyProgress}%` }} /></div><p className="mt-2 text-xs text-steel">{bodyProgress.toFixed(0)}% del camino hacia 83 kg.</p></div>
            <div className="metric"><span>Proteina hoy</span><strong>{proteinToday} g / 160-175 g</strong><p className="mt-2 text-xs text-steel">{proteinTopGap > 0 ? `Te faltan ${proteinTopGap} g para tocar el techo del rango.` : 'Ya estas dentro del rango alto.'}</p></div>
            <div className="metric"><span>Volumen semanal</span><strong>{(volume?.total ?? 0).toFixed(0)} kg</strong><p className="mt-2 text-xs text-steel">Volumen local del dia: {todayVolume.toFixed(0)} kg.</p></div>
            <div className="metric"><span>Racha de entreno</span><strong>{trainingStreak} dias</strong><p className="mt-2 text-xs text-steel">Cumplimiento entrenamiento: {trainingConsistency}.</p></div>
            <div className="metric"><span>Consistencia proteica</span><strong>{proteinConsistency}</strong><p className="mt-2 text-xs text-steel">Dias dentro del piso semanal reciente.</p></div>
            <div className="metric"><span>Adherencia habitos</span><strong>{adherence ? `${Math.round(adherence.habitCompletionRate * 100)}%` : '0%'}</strong><p className="mt-2 text-xs text-steel">Promedio de cumplimiento en la ventana reciente.</p></div>

            <div className="surface-card p-4 md:col-span-2">
              <p className="section-label mb-3">Listo para entrenar</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="metric"><span>Sets pendientes</span><strong>{remainingSets}</strong><p className="mt-2 text-xs text-steel">{store.completed ? 'La sesion ya quedo cerrada.' : `Te espera ${exercise?.name ?? 'el proximo ejercicio'}.`}</p></div>
                <div className="metric"><span>Foco tecnico inicial</span><strong className="text-base">{firstExerciseFocus}</strong><p className="mt-2 text-xs text-steel">Si no cargaste metricas hoy, hacelo antes de arrancar.</p></div>
                <div className="metric"><span>Estado de sesion</span><strong>{sessionCompleted ? 'Completada' : sessionStarted ? 'Activa' : 'Sin iniciar'}</strong><p className="mt-2 text-xs text-steel">{sessionProgressLabel} sets efectivos registrados.</p></div>
                <div className="metric"><span>Proxima prioridad</span><strong>{exercise?.name ?? nextExerciseName}</strong><p className="mt-2 text-xs text-steel">{nextCoachCue}</p></div>
              </div>
            </div>

            <form onSubmit={saveMetric} className="surface-card md:col-span-3 grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="field">Peso<input value={metricWeight} onChange={(e) => setMetricWeight(e.target.value)} type="number" step="0.01" /></label>
              <label className="field">Proteina<input value={metricProtein} onChange={(e) => setMetricProtein(e.target.value)} type="number" /></label>
              <button className="btn-primary"><Save size={16} /> Guardar hoy</button>
            </form>

            <div className="surface-card p-4">
              <p className="section-label mb-3">Adherencia de hoy</p>
              <p className="text-white font-mono text-2xl">{completedHabitsCount}/{activeHabitsCount}</p>
              <p className="mt-2 text-xs text-steel">Proteina y entrenamiento se sincronizan solos cuando cargás datos reales.</p>
            </div>

            <div className="surface-card p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="section-label mb-2">Reto del dia</p>
                  <p className="text-white font-medium">{challenge?.title ?? 'Sin reto cargado'}</p>
                  <p className="mt-2 text-sm text-steel">{challenge?.description ?? 'Todavia no hay reto generado.'}</p>
                </div>
                {challenge && (
                  <button type="button" className={challenge.completed ? 'btn-secondary' : 'btn-primary'} onClick={() => void toggleChallengeCompletion()}>
                    {challenge.completed ? 'Marcar pendiente' : 'Marcar cumplido'}
                  </button>
                )}
              </div>
            </div>

            <div className="surface-card p-4">
              <p className="section-label mb-3">Musculos mas cargados</p>
              {strongestMuscles.length ? strongestMuscles.map(([muscle, value]) => <p key={muscle} className="flex justify-between py-2 border-b border-charcoal text-sm"><span>{muscleName(muscle)}</span><strong>{value.toFixed(0)} kg</strong></p>) : <p className="text-steel">Todavia sin volumen suficiente.</p>}
            </div>

            <div className="surface-card p-4">
              <p className="section-label mb-3">Musculos menos trabajados</p>
              {weakestMuscles.length ? weakestMuscles.map(([muscle, value]) => <p key={muscle} className="flex justify-between py-2 border-b border-charcoal text-sm"><span>{muscleName(muscle)}</span><strong>{value.toFixed(0)} kg</strong></p>) : <p className="text-steel">Aun no hay distribucion suficiente para comparar.</p>}
            </div>

            <div className="surface-card p-4">
              <p className="section-label mb-3">Ultima progresion aplicada</p>
              {latestApplied[0] ? (
                <>
                  <p className="font-medium text-white">{latestApplied[0].exercise?.name}</p>
                  <p className="mt-2 text-sm text-steel">{latestApplied[0].reason}</p>
                  <p className="mt-2 text-sm text-volt">{latestApplied[0].action}</p>
                </>
              ) : <p className="text-steel">Todavia no hay progresiones aplicadas. Segui registrando sets con calidad.</p>}
            </div>

            <div className="coach-banner md:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="section-label mb-2">Coach diario</p>
                  <p className="text-white">{coachRecommendation?.message ?? 'Cargá entrenamiento, proteína y hábitos para recibir una guía más precisa.'}</p>
                  {coachRecommendation?.reason && <p className="mt-2 text-sm text-steel">{coachRecommendation.reason}</p>}
                </div>
                <button type="button" className="btn-tertiary" onClick={() => void refreshCoachNow()}>Recalcular coach</button>
              </div>
            </div>

            <div className="surface-card p-4 md:col-span-3">
              <p className="section-label mb-3">Tendencia reciente por ejercicio</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {exerciseTrends.slice(0, 6).map((trend) => (
                  <div key={trend.exerciseId} className="metric">
                    <span>{trend.latestDate}</span>
                    <strong>{trend.exerciseName}</strong>
                    <p className="mt-2 text-sm text-white">{trend.latestWeightKg} kg x {trend.latestReps}</p>
                    <p className={`mt-2 text-xs ${trend.status === 'up' ? 'text-volt' : trend.status === 'down' ? 'text-red-300' : 'text-steel'}`}>
                      {trend.status === 'new'
                        ? 'Primer registro util.'
                        : trend.status === 'up'
                          ? `Mejorando vs anterior (${trend.deltaWeightKg ?? 0} kg / ${trend.deltaReps ?? 0} reps).`
                          : trend.status === 'down'
                            ? `Cayo vs anterior (${trend.deltaWeightKg ?? 0} kg / ${trend.deltaReps ?? 0} reps).`
                            : 'Sin cambio relevante vs anterior.'}
                    </p>
                  </div>
                ))}
                {!exerciseTrends.length && <p className="text-steel">Todavia no hay suficientes sesiones para mostrar tendencias.</p>}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'analytics' && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="surface-card p-4">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><CheckCircle2 /> Adherencia semanal</h2>
              <div className="grid gap-3">
                <div className="metric"><span>Proteina cumplida</span><strong>{proteinConsistency}</strong></div>
                <div className="metric"><span>Entreno completado</span><strong>{trainingConsistency}</strong></div>
                <div className="metric"><span>Racha actual</span><strong>{trainingStreak} dias</strong></div>
              </div>
              <div className="mt-4 grid gap-2">
                {(adherence?.days ?? []).map((day) => (
                  <div key={day.date} className="rounded-md border border-charcoal bg-obsidian/70 p-3 text-sm text-steel">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-white">{day.date}</strong>
                      <span>{day.completedHabits}/{day.totalHabits} habitos</span>
                    </div>
                    <p className="mt-2">{day.trainingCompleted ? 'Entreno completo' : 'Entreno no completo'} · {day.proteinTargetMet ? 'Proteina OK' : 'Proteina pendiente'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-4">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><BarChart3 /> Volumen por músculo</h2>
              {topEntries(volume?.byMuscle ?? {}).map(([muscle, value]) => (
                <div key={muscle} className="mb-3">
                  <div className="flex justify-between text-sm"><span>{muscleName(muscle)}</span><span>{value.toFixed(0)} kg</span></div>
                  <div className="h-2 bg-obsidian rounded"><div className="h-full bg-volt" style={{ width: `${Math.min(100, value / Math.max(1, volume?.total ?? 1) * 100)}%` }} /></div>
                </div>
              ))}
            </div>

            <div className="surface-card p-4">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><TrendingUp /> Volumen por ejercicio</h2>
              {topEntries(volume?.byExercise ?? {}).map(([name, value]) => <p key={name} className="flex justify-between border-b border-charcoal py-2 text-sm"><span>{name}</span><strong>{value.toFixed(0)} kg</strong></p>)}
            </div>

            <div className="surface-card p-4">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><TrendingUp /> Progreso por ejercicio</h2>
              <div className="grid gap-3">
                {exerciseTrends.map((trend) => (
                  <div key={trend.exerciseId} className="rounded-md border border-charcoal bg-obsidian/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-white">{trend.exerciseName}</strong>
                      <span className="text-xs uppercase tracking-[0.18em] text-steel">{trend.latestDate}</span>
                    </div>
                    <p className="mt-2 text-sm text-steel">Último mejor set: <span className="text-white">{trend.latestWeightKg} kg x {trend.latestReps}</span></p>
                    <p className={`mt-2 text-xs ${trend.status === 'up' ? 'text-volt' : trend.status === 'down' ? 'text-red-300' : 'text-steel'}`}>
                      {trend.status === 'new' ? 'Todavia no hay referencia anterior.' : `Cambio vs sesión anterior: ${trend.deltaWeightKg ?? 0} kg / ${trend.deltaReps ?? 0} reps.`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card md:col-span-2 p-4">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><Activity /> Volumen diario</h2>
              <div className="grid md:grid-cols-7 gap-3">
                {Object.entries(volume?.byDay ?? {}).map(([day, value]) => (
                  <div key={day} className="metric">
                    <span>{day}</span>
                    <strong>{value.toFixed(0)} kg</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card md:col-span-2 p-4">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><Target /> Progresiones recientes</h2>
              {latestApplied.length ? latestApplied.map((item) => (
                <div key={item.id} className="rounded-2xl border border-volt/20 bg-volt/5 p-4 mb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <strong className="text-white">{item.exercise?.name}</strong>
                    <span className="text-xs uppercase tracking-[0.2em] text-steel">{item.evaluatedCycleDate}</span>
                  </div>
                  <p className="mt-2 text-sm text-steel">{item.reason}</p>
                  <p className="mt-2 text-sm text-volt">{item.action}</p>
                  <p className="mt-2 text-xs text-steel">Objetivo generado: {item.targetWeightKg ? `${item.targetWeightKg} kg` : 'sin cambio de carga'}{item.targetRepGoal ? ` x ${item.targetRepGoal}+ reps` : ''}</p>
                </div>
              )) : <p className="text-steel">Todavia no hay progresiones suficientes para analizar.</p>}
            </div>
          </section>
        )}

        {activeTab === 'nutrition' && (
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="hero-panel p-5">
              <h2 className="font-mono text-2xl text-volt flex gap-2"><Utensils /> Nutrición diaria</h2>
              <p className="mt-2 text-steel">Objetivo realista para subir de peso: proteína 160-175 g, comida barata y constancia. Sin azúcar agregada y sin alcohol como reglas de adherencia.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="metric metric-highlight"><span>Proteína</span><strong>{nutritionTotals.proteinTotal.toFixed(0)} g</strong><p className="mt-2 text-xs text-steel">Faltan {nutritionTotals.remainingProtein.toFixed(0)} g para el piso.</p></div>
                <div className="metric"><span>Calorías estimadas</span><strong>{nutritionTotals.caloriesTotal} kcal</strong></div>
                <div className="metric"><span>Meta</span><strong>160-175 g</strong></div>
              </div>

              <form onSubmit={addNutrition} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_120px_120px_auto]">
                <label className="field">Comida<input value={nutritionMeal} onChange={(e) => setNutritionMeal(e.target.value)} /></label>
                <label className="field">Alimento<input value={nutritionFood} onChange={(e) => setNutritionFood(e.target.value)} placeholder="Ej. Huevos" required /></label>
                <label className="field">Proteína<input value={nutritionProtein} onChange={(e) => setNutritionProtein(e.target.value)} type="number" min="0" required /></label>
                <label className="field">Kcal<input value={nutritionCalories} onChange={(e) => setNutritionCalories(e.target.value)} type="number" min="0" required /></label>
                <button className="btn-primary"><Plus size={16} /> Sumar</button>
              </form>

              <div className="mt-5 grid gap-2">
                {nutritionLogs.length ? nutritionLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 rounded-md border border-charcoal bg-obsidian/70 p-3 text-sm">
                    <span><strong>{log.foodName}</strong> · {log.meal}</span>
                    <span className="font-mono text-volt">{log.proteinGrams} g · {log.calories} kcal</span>
                  </div>
                )) : <p className="text-steel">Todavía no cargaste comidas hoy.</p>}
              </div>
            </div>

            <aside className="surface-card p-5">
              <h3 className="font-mono text-volt flex gap-2"><Flame /> Alimentos baratos útiles</h3>
              <div className="mt-4 grid gap-3">
                {foodItems.slice(0, 10).map((food) => (
                  <button key={food.id} type="button" className="metric text-left" onClick={() => { setNutritionFood(food.name); setNutritionProtein(String(food.proteinGrams)); setNutritionCalories(String(food.calories)); }}>
                    <span>{food.serving}</span>
                    <strong>{food.name}</strong>
                    <p className="mt-2 text-xs text-steel">{food.proteinGrams} g proteína · {food.calories} kcal</p>
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-volt/20 bg-volt/5 p-4">
                <p className="section-label mb-2">Cómo cerrar la proteína hoy</p>
                {proteinActionPlan.length ? (
                  <div className="grid gap-3">
                    {proteinActionPlan.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="metric text-left"
                        onClick={() => {
                          setNutritionFood(item.name);
                          setNutritionProtein(String(item.proteinTotal));
                          setNutritionCalories(String(item.caloriesTotal));
                          setNutritionMeal('Cena');
                        }}
                      >
                        <span>{item.summary}</span>
                        <strong>{item.proteinTotal} g proteína</strong>
                        <p className="mt-2 text-xs text-steel">{item.caloriesTotal} kcal aproximadas</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-steel">Ya estás en rango. Ahora importa sostener calidad y calorías.</p>
                )}
              </div>
            </aside>
          </section>
        )}

        {activeTab === 'habits' && (
          <section className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
            <div className="surface-card p-5">
              <h2 className="font-mono text-2xl text-volt flex gap-2"><Trophy /> Objetivos diarios</h2>
              <p className="mt-2 text-steel">No buscamos motivación: buscamos evidencia diaria. Marcá lo que cumpliste y el sistema te va mostrando adherencia.</p>
              <div className="mt-5 grid gap-3">
                {habits.goals.map((goal) => {
                  const log = habits.logs.find((item) => item.goalKey === goal.key);
                  return (
                    <button key={goal.key} type="button" className={log?.completed ? 'btn-primary justify-between' : 'btn-secondary justify-between'} onClick={() => toggleHabit(goal.key, !log?.completed)}>
                      <span>{goal.label}</span>
                      <span className="text-xs">{log?.completed ? 'Cumplido' : goal.target}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <aside className="hero-panel p-5">
              <h3 className="font-mono text-volt flex gap-2"><Dumbbell /> Reto de hoy</h3>
              <p className="mt-4 text-xl font-semibold">{challenge?.title ?? 'Sin reto cargado'}</p>
              <p className="mt-2 text-steel">{challenge?.description ?? 'Cargá datos para generar un reto diario.'}</p>
              {challenge && (
                <button type="button" className={`mt-4 ${challenge.completed ? 'btn-secondary' : 'btn-primary'}`} onClick={() => void toggleChallengeCompletion()}>
                  {challenge.completed ? 'Pasar a pendiente' : 'Lo cumpli'}
                </button>
              )}
              {coachRecommendation && (
                <div className="coach-banner mt-5">
                  <p className="section-label">Coach</p>
                  <p className="mt-2 text-white">{coachRecommendation.message}</p>
                  <p className="mt-2 text-sm text-steel">{coachRecommendation.reason}</p>
                </div>
              )}
            </aside>
          </section>
        )}

        {activeTab === 'photos' && (
          <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="surface-card p-5">
              <h2 className="font-mono text-2xl text-volt flex gap-2"><Camera /> Fotos de progreso</h2>
              <p className="mt-2 text-steel">Subí frente, lateral y espalda. No es diagnóstico médico: es seguimiento visual para decidir foco muscular con más contexto.</p>
              <div className="mt-4 grid gap-3">
                <label className="field">Ángulo
                  <select className="rounded-md border border-charcoal bg-obsidian/90 p-4 font-mono text-white" value={photoAngle} onChange={(e) => setPhotoAngle(e.target.value as typeof photoAngle)}>
                    <option value="front">Frente</option>
                    <option value="side">Lateral</option>
                    <option value="back">Espalda</option>
                  </select>
                </label>
                <input className="block w-full text-sm text-steel" type="file" accept="image/*" onChange={(event) => void handlePhotoFile(event.target.files?.[0] ?? null)} />
                {photoDataUrl && <img src={photoDataUrl} alt="Vista previa" className="max-h-72 rounded-md border border-charcoal object-cover" />}
                <button className="btn-primary" disabled={!photoDataUrl} onClick={uploadPhoto}><Camera size={16} /> Guardar y analizar</button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {photoComparisons.length > 0 && (
                <article className="surface-card p-4 md:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="section-label">Comparación visual útil</p>
                      <p className="mt-2 text-sm text-steel">No es decoración: sirve para ver si los focos musculares se están repitiendo en el tiempo.</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-steel">Seguimiento persistente</p>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    {photoComparisons.map((comparison) => (
                      <div key={comparison.angle} className="rounded-2xl border border-charcoal bg-obsidian/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-white capitalize">{comparison.angle}</strong>
                          <span className="text-xs text-steel">{comparison.daysBetween} días</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <img src={comparison.first.imageUrl} alt={`${comparison.angle} inicial`} className="h-36 w-full rounded-md object-cover" />
                          <img src={comparison.latest.imageUrl} alt={`${comparison.angle} actual`} className="h-36 w-full rounded-md object-cover" />
                        </div>
                        <p className="mt-3 text-sm text-steel">{comparison.latestSummary}</p>
                        <p className="mt-3 text-xs text-steel">
                          {comparison.repeatedFocusAreas.length
                            ? `Focos repetidos: ${comparison.repeatedFocusAreas.join(', ')}.`
                            : 'No se repiten focos anteriores con claridad.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              )}
              {photos.length ? photos.map((photo) => (
                <article key={photo.id} className="surface-card overflow-hidden">
                  <img src={photo.imageUrl} alt={`Foto ${photo.angle}`} className="h-72 w-full object-cover" />
                  <div className="p-4">
                    <p className="section-label">{photo.date} · {photo.angle}</p>
                    <p className="mt-2 text-sm text-steel">{photo.analyses?.[0]?.summary ?? 'Sin análisis todavía.'}</p>
                    <ul className="mt-3 list-disc pl-5 text-sm text-steel">
                      {(photo.analyses?.[0]?.recommendations ?? []).slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </article>
              )) : <p className="text-steel">Todavía no hay fotos cargadas.</p>}
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="surface-card p-5">
              <h2 className="font-mono text-2xl text-volt flex gap-2"><HeartPulse /> Ajustes del coach</h2>
              <p className="mt-3 text-steel">Las API keys se configuran en Render/Vercel, nunca por chat. Cloudinary guarda fotos si están presentes las variables; si no, la app mantiene modo local/base.</p>
              <div className="mt-4 grid gap-3">
                <div className="metric"><span>Proveedor IA</span><strong>OpenAI-ready</strong></div>
                <div className="metric"><span>Fotos</span><strong>Cloudinary-ready</strong></div>
                <div className="metric"><span>Seguridad</span><strong>Single-user sin login</strong></div>
              </div>
            </div>
            <div className="surface-card p-5">
              <h3 className="font-mono text-volt flex gap-2"><Volume2 /> Timer</h3>
              <p className="mt-3 text-steel">El descanso vibra y emite sonido al finalizar si el navegador lo permite. Nunca baja de 0 y podés saltarlo si ya estás listo.</p>
            </div>
          </section>
        )}

        {activeTab === 'plan' && (
          <section className="grid gap-4">
            <div className="surface-card flex gap-3 flex-wrap p-3">
              <button className="btn-primary" disabled={planSaving} onClick={persistPlan}>Guardar plan</button>
              <button className="btn-secondary" disabled={planSaving} onClick={resetPlan}>Restaurar rutina base</button>
            </div>

            {planDays.map((day, dayIndex) => (
              <section key={day.id} className="surface-card p-4">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <h2 className="font-mono text-volt">Dia {day.cycleDay}: {day.name}</h2>
                  <button className="btn-tertiary" onClick={() => addCustomExercise(dayIndex)}><Plus size={14} /> Agregar ejercicio</button>
                </div>

                <div className="grid gap-3">
                  {day.exercises.map((item, exerciseIndex) => (
                    <div key={`${item.id || 'new'}-${exerciseIndex}`} className="grid gap-2 md:grid-cols-[2fr_72px_96px_76px_86px_110px] items-end">
                      <label className="field">Ejercicio<input value={item.name} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { name: e.target.value })} /></label>
                      <label className="field">Sets<input type="number" value={item.sets} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { sets: Number(e.target.value) })} /></label>
                      <label className="field">Reps<input value={item.targetReps} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { targetReps: e.target.value })} /></label>
                      <label className="field">RPE<input value={item.rpe} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { rpe: e.target.value })} /></label>
                      <label className="field">Rest<input type="number" value={item.restSeconds} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { restSeconds: Number(e.target.value) })} /></label>
                      <button className="btn-secondary" onClick={() => updatePlanExercise(dayIndex, exerciseIndex, { active: !item.active })}>{item.active === false ? 'Apagado' : 'Activo'}</button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </section>
        )}

        {activeTab === 'flow' && (store.day?.exercises.length === 0 || store.completed ? (
          <section className="hero-panel p-6 text-center">
            <Activity className="mx-auto text-volt mb-4" size={42} />
            <h2 className="text-2xl font-bold">Dia completo</h2>
            <p className="text-steel mt-3">Consumi <strong className="text-volt">160g-175g de proteina</strong> para seguir subiendo de 77.78 kg hacia 83.0 kg.</p>
            <p className="text-steel mt-2">Volumen registrado hoy: {todayVolume.toFixed(0)} kg.</p>
            <div className="mt-6 flex justify-center">
              <button className="btn-secondary" onClick={resetCurrentSession} disabled={resettingDay}><RotateCcw size={16} /> {resettingDay ? 'Reiniciando...' : 'Reiniciar dia'}</button>
            </div>
          </section>
        ) : exercise && (
          <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <section className="surface-card p-5">
              {!isViewingToday && <div className="notice notice-warning mb-4"><AlertTriangle size={16} /> Estas mirando historial. No es el flujo vivo del dia actual.</div>}
              <p className="section-label">Ejercicio actual - Set {store.setNumber}/{exercise.sets}</p>
              <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                <h2 className="font-mono text-3xl text-volt">{exercise.name}</h2>
                <div className="flex items-center gap-2 text-sm text-steel"><Clock3 size={16} /> Descanso {exercise.restSeconds}s</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {exercise.warmup && <span className="status-pill">Activacion incluida</span>}
                <span className="status-pill">{exercise.metadata?.kind === 'isolation' ? 'Aislado' : 'Compuesto'}</span>
                <span className="status-pill">Volumen del dia {todayVolume.toFixed(0)} kg</span>
                <span className="status-pill">{sessionCompleted ? 'Sesion completada' : sessionStarted ? `Sesion activa ${sessionProgressLabel}` : 'Sesion sin iniciar'}</span>
              </div>

              <div className="coach-banner mt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="section-label mb-2">Sesion del dia</p>
                    <p className="text-white">{sessionCompleted ? 'Ya cerraste todos los sets efectivos del dia.' : sessionStarted ? `Llevas ${sessionProgressLabel} sets efectivos.` : 'Todavia no iniciaste formalmente la sesion.'}</p>
                    <p className="mt-2 text-sm text-steel">{isViewingToday ? 'Cuando guardes el primer set, la sesion queda persistida en backend.' : 'Estas viendo una fecha historica; la sesion no se puede reabrir desde aca.'}</p>
                  </div>
                  {isViewingToday && !sessionStarted && <button type="button" className="btn-tertiary" onClick={() => void ensureSessionStarted()}>Iniciar sesion</button>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 text-sm lg:grid-cols-3">
                <div className="metric"><span>Objetivo</span><strong>{exercise.targetReps}</strong></div>
                <div className="metric"><span>RPE plan</span><strong>{exercise.rpe}</strong></div>
                <div className="metric"><span>Respiracion</span><strong>{exercise.breath}</strong></div>
                <div className="metric"><span>Mejor set</span><strong>{formatBestSet(history)}</strong></div>
                <div className="metric"><span>Ultimo set equivalente</span><strong>{formatEquivalentSet(lastEquivalentSet)}</strong></div>
                <div className="metric"><span>Tecnica previa</span><strong>{formatTechnique(lastEquivalentSet?.techniqueStatus as TechniqueStatus | undefined)}</strong></div>
              </div>

              <div className="coach-banner mt-4">
                <p className="section-label mb-2 flex gap-2"><Target size={14} /> Objetivo recomendado hoy</p>
                <p className="font-mono text-xl text-volt">{recommendedWeight ? `${recommendedWeight} kg` : 'Sin cambio de carga'} {recommendedReps ? `x ${recommendedReps}+ reps` : ''}</p>
                <p className="text-sm text-steel mt-2">{currentSuggestion ? `${currentSuggestion.reason} ${currentSuggestion.action}` : exercise.lastProgressionAction ?? exercise.metadata?.overloadRecommendation}</p>
                {exercise.lastProgressionReason && <p className="mt-2 text-xs text-steel">Ultima progresion: {exercise.lastProgressionReason}</p>}
              </div>

              <div className="grid gap-3 md:grid-cols-2 mt-5">
                <div className="coach-banner text-sm">
                  <p className="section-label mb-2">Cue principal</p>
                  <p className="text-white">{nextCoachCue}</p>
                </div>
                <div className="coach-banner text-sm">
                  <p className="section-label mb-2">Error a evitar</p>
                  <p className="text-white">{nextCoachMistake}</p>
                </div>
              </div>

              {previousSet && (
                <div className="coach-banner mt-5 text-sm">
                  <p>Ghost set: {previousSet.weightKg} kg x {previousSet.reps} reps</p>
                  <button className="btn-tertiary mt-3" type="button" onClick={useGhostSetValues}>Usar valores del set previo</button>
                </div>
              )}

              <div className="surface-card mt-5 border-volt/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="section-label">Series de aproximación</p>
                    <p className="mt-1 text-sm text-steel">
                      Calientan el patrón sin contar para volumen, PRs ni progresión. Hacelas cuando el músculo todavía está frío.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-tertiary" onClick={() => setApproachMode('active')}>Hacer aproximación</button>
                    <button type="button" className="btn-tertiary" onClick={() => setApproachMode('skipped')}>Saltar aproximación</button>
                  </div>
                </div>
                {shouldSuggestApproach && <p className="notice notice-warning mt-3"><AlertTriangle size={16} /> Conviene aproximar antes de esta serie efectiva.</p>}
                {approachSuggestions.length > 0 && (
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    {approachSuggestions.map((item) => (
                      <button key={item.label} type="button" className="segment" onClick={() => { setApproachWeight(String(item.weight)); setApproachReps(item.reps.split('-')[0]); setApproachMode('active'); }}>
                        {item.label}: {item.weight} kg x {item.reps}
                      </button>
                    ))}
                  </div>
                )}
                {approachLogs.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {approachLogs.map((log) => <p key={log.id} className="rounded-md border border-charcoal bg-obsidian/70 p-2 text-sm text-steel">Aprox {log.approachOrder ?? log.setNumber}: <strong className="text-white">{log.weightKg} kg x {log.reps}</strong></p>)}
                  </div>
                )}
                {approachMode === 'active' && (
                  <form onSubmit={onApproachSubmit} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_2fr_auto]">
                    <label className="field">Peso<input value={approachWeight} onChange={(e) => setApproachWeight(e.target.value)} type="number" min="0" step="0.25" required /></label>
                    <label className="field">Reps<input value={approachReps} onChange={(e) => setApproachReps(e.target.value)} type="number" min="1" required /></label>
                    <label className="field">Dolor<input value={approachPain} onChange={(e) => setApproachPain(e.target.value)} type="number" min="0" max="10" /></label>
                    <label className="field">Sensación<input value={approachNotes} onChange={(e) => setApproachNotes(e.target.value)} placeholder="Se sintió liviano/pesado..." /></label>
                    <button className="btn-secondary" disabled={saving}><Plus size={16} /> Guardar aprox</button>
                  </form>
                )}
              </div>

              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="field">Peso kg<input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" type="number" min="0" step="0.25" placeholder="Ej. 80" required /></label>
                  <label className="field">Reps<input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" type="number" min="1" step="1" placeholder="Ej. 8" required /></label>
                  <label className="field">RIR<input value={rir} onChange={(e) => setRir(e.target.value)} type="number" min="0" max="10" /></label>
                  <label className="field">Esfuerzo real 1-10<input value={actualRpe} onChange={(e) => setActualRpe(e.target.value)} type="number" min="1" max="10" /></label>
                  <label className="field">Dolor 0-10<input value={painLevel} onChange={(e) => setPainLevel(e.target.value)} type="number" min="0" max="10" /></label>
                  <label className="field">Notas<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Molestias, tecnica, sensaciones" /></label>
                </div>

                <div>
                  <p className="section-label mb-2">RPE/RIR: 6 cómodo · 7 quedan 3 reps · 8 quedan 2 · 9 queda 1 · 10 fallo real</p>
                  <p className="section-label mb-2">Estado tecnico del set</p>
                  <div className="segmented-grid">
                    {([
                      ['clean', 'Limpia'],
                      ['grindy', 'Muy exigida'],
                      ['compensated', 'Compensada']
                    ] as Array<[TechniqueStatus, string]>).map(([value, label]) => (
                      <button key={value} type="button" className={techniqueStatus === value ? 'segment-active' : 'segment'} onClick={() => setTechniqueStatus(value)}>{label}</button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <button className="btn-primary disabled:opacity-40" disabled={!weightKg || !reps || saving}>{saving ? 'Guardando...' : 'Guardar set'}</button>
                  <button className="btn-danger" type="button" onClick={resetCurrentSession} disabled={resettingDay}>{resettingDay ? 'Reiniciando...' : 'Reiniciar sesion del dia'}</button>
                </div>
              </form>
            </section>

            <aside className="grid gap-4">
              <div className="surface-card p-4">
                <p className="section-label mb-3">Preparacion</p>
                <div className="grid gap-3">
                  <div className="metric"><span>Sets pendientes</span><strong>{remainingSets}</strong></div>
                  <div className="metric"><span>Proteina faltante</span><strong>{proteinFloorGap > 0 ? `${proteinFloorGap} g` : '0 g'}</strong></div>
                  <div className="metric"><span>Volumen acumulado</span><strong>{estimatedVolume.toFixed(0)} kg</strong></div>
                  <div className="metric"><span>Habitos del dia</span><strong>{completedHabitsCount}/{activeHabitsCount}</strong></div>
                  <div className="metric"><span>Proximo paso</span><strong>{store.setNumber < exercise.sets ? `Repeti ${exercise.name}` : nextExerciseName}</strong></div>
                  <div className="metric"><span>Estado de sesion</span><strong>{sessionCompleted ? 'Completa' : sessionStarted ? sessionProgressLabel : 'Sin iniciar'}</strong></div>
                </div>
              </div>
              <AnatomyMap exercise={exercise} />
              <section className="surface-card p-4">
                <h3 className="font-mono text-volt flex gap-2"><BookOpen /> Guia tecnica</h3>
                <p className="section-label mt-3">Video</p>
                {videoResource.embedUrl ? (
                  <iframe title={`${exercise.name} video`} src={videoResource.embedUrl} className="mt-2 aspect-video w-full rounded border border-charcoal" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                ) : (
                  <div className="mt-2 rounded border border-charcoal bg-obsidian p-4">
                    <p className="text-sm text-steel">Todavia no hay un embed confiable para este ejercicio. En vez de mostrar un video roto, te dejo accesos tecnicos utiles.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a className="btn-tertiary" href={videoResource.watchUrl} target="_blank" rel="noreferrer">Buscar video</a>
                      <a className="btn-tertiary" href={exercise.metadata?.referenceUrl ?? buildExrxSearchUrl(exercise.name)} target="_blank" rel="noreferrer">{exercise.metadata?.referenceLabel ?? 'Ver ExRx'}</a>
                      <a className="btn-tertiary" href={buildAceSearchUrl(exercise.name)} target="_blank" rel="noreferrer">Ver ACE</a>
                    </div>
                  </div>
                )}
                <p className="section-label mt-4">Instrucciones</p>
                <ul className="list-disc pl-5 text-sm text-steel">{exercise.metadata?.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ul>
                <p className="section-label mt-4">Cues</p>
                <ul className="list-disc pl-5 text-sm text-steel">{exercise.metadata?.technicalCues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
                <p className="section-label mt-4">Errores comunes</p>
                <ul className="list-disc pl-5 text-sm text-steel">{exercise.metadata?.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
              </section>
              <section className="surface-card p-4">
                <p className="section-label mb-3">Sigue despues</p>
                <p className="text-white font-medium">{store.setNumber < exercise.sets ? `Repeti ${exercise.name}` : nextExerciseName}</p>
                <p className="text-steel text-sm mt-2">{isViewingToday ? 'Sesion actual' : `Mirando historial del dia ${viewedCycleDay}`}</p>
                <p className="text-steel text-sm mt-1">Ultima sesion registrada: {history?.latestDate ?? 'sin datos previos'}</p>
                {currentSuggestion && <div className="mt-3 flex gap-2"><button className="btn-tertiary" onClick={() => resolveSuggestion(currentSuggestion.id, true)}>Aceptar progreso</button><button className="btn-tertiary" onClick={() => resolveSuggestion(currentSuggestion.id, false)}>Posponer</button></div>}
                {lastAppliedForCurrentExercise && (
                  <div className="mt-4 rounded-2xl border border-volt/20 bg-volt/5 p-3">
                    <p className="section-label mb-2">Ultima progresion aplicada</p>
                    <p className="text-sm text-steel">{lastAppliedForCurrentExercise.reason}</p>
                    <p className="text-sm text-volt mt-2">{lastAppliedForCurrentExercise.action}</p>
                  </div>
                )}
              </section>
              <section className="surface-card p-4">
                <p className="section-label mb-3">Navegacion</p>
                <div className="grid gap-3">
                  <button className="btn-secondary" type="button" disabled={viewedCycleDay <= 1 || switchingDay} onClick={() => handleDaySelection(viewedCycleDay - 1)}><ChevronLeft size={16} /> Dia anterior</button>
                  <button className="btn-secondary" type="button" disabled={viewedCycleDay >= currentCycleDay || switchingDay} onClick={() => handleDaySelection(viewedCycleDay + 1)}><ChevronRight size={16} /> Dia siguiente</button>
                </div>
              </section>
            </aside>
          </section>
        ))}
      </section>
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-charcoal bg-[#050505]/95 p-2 backdrop-blur md:hidden">
        <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto">
          {APP_TABS.map(([key, label]) => (
            <button key={key} className={activeTab === key ? 'bottom-tab-active' : 'bottom-tab'} onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

