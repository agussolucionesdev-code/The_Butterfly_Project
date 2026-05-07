import { Activity, BarChart3, BookOpen, ChevronLeft, ChevronRight, Clock3, Lock, Plus, RotateCcw, Save, Target, Timer, TrendingUp, Zap } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { acceptProgression, getActivePlan, getBodyMetrics, getDay, getExerciseHistory, getLogs, getProgressionSuggestions, getToday, getVolumeAnalytics, rejectProgression, resetPlanToTemplate, saveActivePlan, saveBodyMetric, saveSet } from './api';
import { useWorkoutStore } from './store/workoutStore';
import type { BodyMetric, Exercise, ExerciseHistory, ProgressionSuggestion, TrainingDay, VolumeAnalytics } from './types';
import { getEstimatedVolume, getWorkoutProgress, resolveCycleDate } from './utils/workout';

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pecho',
  upper_chest: 'Pecho superior',
  front_delts: 'Deltoide ant.',
  side_delts: 'Deltoide lat.',
  rear_delts: 'Deltoide post.',
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
  hip_flexors: 'Flexores cadera'
};

type TabKey = 'flow' | 'dashboard' | 'analytics' | 'plan';

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
  return Object.entries(record).sort((a, b) => a[1] - b[1]).slice(0, count);
}

function AnatomyMap({ exercise }: { exercise: Exercise | null }) {
  const primary = new Set(exercise?.metadata?.primaryMuscles ?? []);
  const secondary = new Set(exercise?.metadata?.secondaryMuscles ?? []);
  const fill = (muscle: string) => primary.has(muscle) ? '#CCFF00' : secondary.has(muscle) ? '#94A3B8' : '#1A1A1A';

  return (
    <div className="rounded border border-charcoal bg-obsidian p-3">
      <p className="text-xs uppercase tracking-[0.25em] text-steel mb-2">Mapa muscular</p>
      <svg viewBox="0 0 220 320" className="mx-auto h-72 w-full max-w-[260px]">
        <circle cx="110" cy="28" r="18" fill="#1A1A1A" stroke="#2A2A2A" />
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
        <rect x="18" y="54" width="44" height="92" rx="16" fill={fill('lats')} stroke="#2A2A2A" opacity="0.9" />
        <rect x="158" y="54" width="44" height="92" rx="16" fill={fill('upper_back')} stroke="#2A2A2A" opacity="0.9" />
        <rect x="78" y="178" width="64" height="40" rx="16" fill={fill('glutes')} stroke="#2A2A2A" opacity="0.5" />
        <rect x="76" y="216" width="68" height="32" rx="14" fill={fill('hamstrings')} stroke="#2A2A2A" opacity="0.65" />
      </svg>
      <div className="grid gap-2 text-xs text-steel">
        <p><span className="text-volt">Primarios:</span> {(exercise?.metadata?.primaryMuscles ?? []).map(muscleName).join(', ') || 'Sin datos'}</p>
        <p><span className="text-white">Secundarios:</span> {(exercise?.metadata?.secondaryMuscles ?? []).map(muscleName).join(', ') || 'Sin datos'}</p>
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
  const [notes, setNotes] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('0');
  const [timerSecondsInput, setTimerSecondsInput] = useState('0');
  const [selectedCycleDay, setSelectedCycleDay] = useState<number | null>(null);
  const [currentCycleDay, setCurrentCycleDay] = useState(1);
  const [currentCycleDate, setCurrentCycleDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingDay, setSwitchingDay] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('flow');
  const [history, setHistory] = useState<ExerciseHistory | null>(null);
  const [volume, setVolume] = useState<VolumeAnalytics | null>(null);
  const [suggestions, setSuggestions] = useState<ProgressionSuggestion[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [metricWeight, setMetricWeight] = useState('77.78');
  const [metricProtein, setMetricProtein] = useState('160');
  const [planDays, setPlanDays] = useState<TrainingDay[]>([]);
  const [planSaving, setPlanSaving] = useState(false);

  const store = useWorkoutStore();
  const exercise = store.getCurrentExercise();
  const previousSet = store.getPreviousSet();
  const progress = useMemo(() => getWorkoutProgress(store.day, store.logs), [store.day, store.logs]);
  const estimatedVolume = useMemo(() => getEstimatedVolume(store.logs), [store.logs]);
  const viewedCycleDay = selectedCycleDay ?? currentCycleDay;
  const isViewingToday = viewedCycleDay === currentCycleDay;
  const totalExercises = store.day?.exercises.length ?? 0;
  const nextExerciseName = store.day && exercise ? store.day.exercises[store.exerciseIndex + 1]?.name ?? 'Workout complete' : 'Workout complete';
  const latestMetric = metrics[0];
  const bodyProgress = latestMetric ? Math.min(100, Math.max(0, ((latestMetric.bodyWeightKg - 77.78) / (83 - 77.78)) * 100)) : 0;
  const strongestMuscles = topEntries(volume?.byMuscle ?? {}, 3);
  const weakestMuscles = lowEntries(volume?.byMuscle ?? {}, 3).filter(([, value]) => value > 0);
  const currentSuggestion = suggestions.find((item) => item.exerciseId === exercise?.id);
  const lastEquivalentSet = useMemo(() => history?.latestLogs.find((log) => log.setNumber === store.setNumber), [history, store.setNumber]);
  const recommendedWeight = exercise?.plannedWeightKg ?? null;
  const recommendedReps = exercise?.plannedRepGoal ?? null;

  async function refreshCoachData(currentExercise = exercise) {
    const [volumeResponse, progressionResponse] = await Promise.all([
      getVolumeAnalytics(),
      getProgressionSuggestions()
    ]);
    setVolume(volumeResponse.volume);
    setSuggestions(progressionResponse.suggestions);
    if (currentExercise) {
      setHistory((await getExerciseHistory(currentExercise.id)).history);
    }
  }

  async function loadWorkoutForDay(targetCycleDay?: number) {
    const today = await getToday();
    const nextCycleDay = targetCycleDay ?? today.cycleDay;
    const targetDate = resolveCycleDate(today.cycleDay, today.cycleDate, nextCycleDay);
    const [dayResponse, logsResponse] = await Promise.all([
      nextCycleDay === today.cycleDay ? Promise.resolve({ cycleDay: today.cycleDay, locked: false, day: today.day }) : getDay(nextCycleDay),
      getLogs(targetDate)
    ]);

    if (dayResponse.locked) throw new Error('Future training days are locked.');

    store.setWorkout(nextCycleDay, targetDate, dayResponse.day, logsResponse.logs);
    setCurrentCycleDay(today.cycleDay);
    setCurrentCycleDate(today.cycleDate);
    setSelectedCycleDay(nextCycleDay);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadWorkoutForDay();
        const [plan, body] = await Promise.all([getActivePlan(), getBodyMetrics()]);
        setPlanDays(plan.days);
        setMetrics(body.metrics);
        await refreshCoachData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize workout.');
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
    if (exercise) {
      void getExerciseHistory(exercise.id).then((response) => setHistory(response.history)).catch(() => undefined);
    }
  }, [exercise?.id]);

  async function handleDaySelection(targetCycleDay: number) {
    if (targetCycleDay > currentCycleDay || targetCycleDay === viewedCycleDay) return;
    setError('');
    setSwitchingDay(true);

    try {
      await loadWorkoutForDay(targetCycleDay);
      await refreshCoachData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch training day.');
    } finally {
      setSwitchingDay(false);
    }
  }

  function applyCustomTimer() {
    store.setTimerSeconds(Math.max(0, Math.floor(clampNumericInput(timerMinutes))) * 60 + Math.min(59, Math.max(0, Math.floor(clampNumericInput(timerSecondsInput)))));
  }

  function useGhostSetValues() {
    if (!previousSet) return;
    setWeightKg(String(previousSet.weightKg));
    setReps(String(previousSet.reps));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!exercise || !weightKg || !reps || saving) return;

    const parsedWeight = Number(weightKg);
    const parsedReps = Number(reps);
    if (!(parsedWeight > 0) || !(parsedReps > 0)) {
      setError('Weight and reps must be positive values.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const result = await saveSet({
        exerciseId: exercise.id,
        cycleDay: store.cycleDay,
        cycleDate: store.cycleDate,
        setNumber: store.setNumber,
        weightKg: parsedWeight,
        reps: parsedReps,
        rir: rir ? Number(rir) : undefined,
        actualRpe: actualRpe ? Number(actualRpe) : undefined,
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
      setNotes('');
      await refreshCoachData(exercise);

      if (result.restSeconds > 0) store.startTimer(result.restSeconds);
      else store.advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Set could not be saved.');
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
  }

  async function resolveSuggestion(id: string, accepted: boolean) {
    if (accepted) await acceptProgression(id);
    else await rejectProgression(id);
    await loadWorkoutForDay(viewedCycleDay);
    await refreshCoachData();
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
    } finally {
      setPlanSaving(false);
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-obsidian text-volt font-mono">Loading metamorphosis...</main>;
  }

  if (store.timerActive) {
    return (
      <main className="min-h-screen bg-obsidian text-white p-6 flex flex-col items-center justify-center text-center">
        <Timer className="text-volt mb-6" size={48} />
        <p className="uppercase tracking-[0.4em] text-steel text-xs mb-3">Active recovery</p>
        <h1 className="font-mono text-7xl text-volt mb-4">{formatTime(store.timerSeconds)}</h1>
        <p className="text-steel mb-6 max-w-md">Next step: <strong className="text-white">{store.setNumber < (exercise?.sets ?? 0) ? `Set ${store.setNumber + 1}` : nextExerciseName}</strong></p>
        <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-4">
          {[-20, -15, -10, 10, 15, 20].map((seconds) => (
            <button key={seconds} className={`btn-secondary ${seconds < 0 ? 'text-red-200' : ''}`} onClick={() => store.addTimerSeconds(seconds)}>
              {seconds > 0 ? `+${seconds}s` : `${seconds}s`}
            </button>
          ))}
        </div>
        <div className="border border-charcoal bg-carbon rounded p-4 w-full max-w-md mb-4">
          <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Custom timer</p>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <label className="field text-left">Minutes<input value={timerMinutes} onChange={(event) => setTimerMinutes(event.target.value)} type="number" min="0" step="1" /></label>
            <span className="font-mono text-2xl mt-6">:</span>
            <label className="field text-left">Seconds<input value={timerSecondsInput} onChange={(event) => setTimerSecondsInput(event.target.value)} type="number" min="0" max="59" step="1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button className="btn-secondary" onClick={applyCustomTimer}>Apply time</button>
            <button className="btn-secondary" onClick={store.resetTimer}><RotateCcw size={16} /> Reset</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          <button className="btn-primary" onClick={store.togglePause}>{store.timerPaused ? 'Resume' : 'Pause'}</button>
          <button className="btn-secondary" onClick={store.skipTimer}>Skip Rest</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-obsidian text-white p-4 sm:p-8">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 border border-charcoal bg-carbon p-5 rounded">
          <div className="flex items-center gap-2 text-volt font-mono uppercase tracking-[0.3em] text-xs"><Zap size={16} /> The Butterfly Project</div>
          <div className="flex items-start justify-between gap-4 mt-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold">{store.day?.name ?? 'Training day'}</h1>
              <p className="text-steel mt-2">Cycle day {store.cycleDay} - {store.cycleDate}</p>
              {!isViewingToday && <p className="text-volt mt-2 text-sm">Viewing previous day from this cycle block.</p>}
            </div>
            <div className="border border-charcoal bg-graphite p-4 rounded min-w-[220px]">
              <p className="text-xs uppercase tracking-[0.25em] text-steel mb-2">Progress</p>
              <p className="font-mono text-2xl text-volt">{progress.completedSets}/{progress.totalSets}</p>
              <div className="h-2 bg-obsidian rounded mt-3 overflow-hidden"><div className="h-full bg-volt" style={{ width: `${progress.completionRatio * 100}%` }} /></div>
              <p className="text-xs text-steel mt-3">Exercises: {totalExercises} - Volume: {estimatedVolume.toFixed(1)} kg</p>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 mt-5">
            {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => (
              <button key={day} type="button" disabled={day > currentCycleDay || switchingDay} onClick={() => handleDaySelection(day)} className={`day-pill ${day === viewedCycleDay ? 'day-pill-active' : ''} ${day > currentCycleDay ? 'day-pill-locked' : ''}`}>
                {day > currentCycleDay ? <Lock size={14} /> : day}
              </button>
            ))}
          </div>
        </header>

        <nav className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {([
            ['flow', 'Workout'],
            ['dashboard', 'Dashboard'],
            ['analytics', 'Analytics'],
            ['plan', 'Plan']
          ] as Array<[TabKey, string]>).map(([key, label]) => (
            <button key={key} className={activeTab === key ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </nav>

        {error && <p className="mb-4 border border-red-500/40 bg-red-950/40 p-3 text-red-200 rounded">{error}</p>}

        {activeTab === 'dashboard' && (
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric"><span>Peso hacia 83 kg</span><strong>{latestMetric?.bodyWeightKg ?? 77.78} kg</strong><div className="h-2 bg-obsidian rounded mt-3 overflow-hidden"><div className="h-full bg-volt" style={{ width: `${bodyProgress}%` }} /></div></div>
            <div className="metric"><span>Proteina hoy</span><strong>{latestMetric?.proteinGrams ?? 0}g / 160-175g</strong></div>
            <div className="metric"><span>Volumen semanal</span><strong>{(volume?.total ?? 0).toFixed(0)} kg</strong></div>

            <form onSubmit={saveMetric} className="md:col-span-3 border border-charcoal bg-carbon p-4 rounded grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="field">Peso<input value={metricWeight} onChange={(e) => setMetricWeight(e.target.value)} type="number" step="0.01" /></label>
              <label className="field">Proteina<input value={metricProtein} onChange={(e) => setMetricProtein(e.target.value)} type="number" /></label>
              <button className="btn-primary"><Save size={16} /> Guardar</button>
            </form>

            <div className="border border-charcoal bg-carbon p-4 rounded">
              <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Musculos mas cargados</p>
              {strongestMuscles.length ? strongestMuscles.map(([muscle, value]) => <p key={muscle} className="flex justify-between py-2 border-b border-charcoal text-sm"><span>{muscleName(muscle)}</span><strong>{value.toFixed(0)} kg</strong></p>) : <p className="text-steel">Todavia sin volumen suficiente.</p>}
            </div>

            <div className="border border-charcoal bg-carbon p-4 rounded">
              <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Musculos menos trabajados</p>
              {weakestMuscles.length ? weakestMuscles.map(([muscle, value]) => <p key={muscle} className="flex justify-between py-2 border-b border-charcoal text-sm"><span>{muscleName(muscle)}</span><strong>{value.toFixed(0)} kg</strong></p>) : <p className="text-steel">Aun no hay distribucion suficiente para comparar.</p>}
            </div>

            <div className="border border-charcoal bg-carbon p-4 rounded">
              <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Meta diaria</p>
              <p className="text-sm text-steel">Hoy la app tiene que empujarte a 83 kg con consistencia, proteina y progresion real.</p>
              <p className="mt-3 text-white font-medium">Volumen del dia: {(volume?.byDay?.[store.cycleDate] ?? 0).toFixed(0)} kg</p>
            </div>

            <div className="md:col-span-3 border border-charcoal bg-carbon p-4 rounded">
              <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Alertas de progresion</p>
              {suggestions.length ? suggestions.map((item) => (
                <div key={item.id} className="border border-volt/30 bg-volt/10 p-3 rounded mb-2">
                  <strong>{item.exercise?.name}</strong>
                  <p className="text-steel text-sm mt-1">{item.reason} {item.action}</p>
                  <div className="flex gap-2 mt-3">
                    <button className="btn-tertiary" onClick={() => resolveSuggestion(item.id, true)}>Aceptar</button>
                    <button className="btn-tertiary" onClick={() => resolveSuggestion(item.id, false)}>Rechazar</button>
                  </div>
                </div>
              )) : <p className="text-steel">Todavia no hay alertas. Segui registrando sets con RIR/RPE para que el sistema piense mejor.</p>}
            </div>
          </section>
        )}

        {activeTab === 'analytics' && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="border border-charcoal bg-carbon p-4 rounded">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><BarChart3 /> Volumen por musculo</h2>
              {topEntries(volume?.byMuscle ?? {}).map(([muscle, value]) => (
                <div key={muscle} className="mb-3">
                  <div className="flex justify-between text-sm"><span>{muscleName(muscle)}</span><span>{value.toFixed(0)} kg</span></div>
                  <div className="h-2 bg-obsidian rounded"><div className="h-full bg-volt" style={{ width: `${Math.min(100, value / Math.max(1, volume?.total ?? 1) * 100)}%` }} /></div>
                </div>
              ))}
            </div>

            <div className="border border-charcoal bg-carbon p-4 rounded">
              <h2 className="font-mono text-volt mb-3 flex gap-2"><TrendingUp /> Volumen por ejercicio</h2>
              {topEntries(volume?.byExercise ?? {}).map(([name, value]) => <p key={name} className="flex justify-between border-b border-charcoal py-2 text-sm"><span>{name}</span><strong>{value.toFixed(0)} kg</strong></p>)}
            </div>

            <div className="md:col-span-2 border border-charcoal bg-carbon p-4 rounded">
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
          </section>
        )}

        {activeTab === 'plan' && (
          <section className="grid gap-4">
            <div className="flex gap-3 flex-wrap">
              <button className="btn-primary" disabled={planSaving} onClick={persistPlan}>Guardar plan</button>
              <button className="btn-secondary" disabled={planSaving} onClick={resetPlan}>Restaurar rutina base</button>
            </div>

            {planDays.map((day, dayIndex) => (
              <section key={day.id} className="border border-charcoal bg-carbon p-4 rounded">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <h2 className="font-mono text-volt">Dia {day.cycleDay}: {day.name}</h2>
                  <button className="btn-tertiary" onClick={() => addCustomExercise(dayIndex)}><Plus size={14} /> Agregar ejercicio</button>
                </div>

                <div className="grid gap-3">
                  {day.exercises.map((item, exerciseIndex) => (
                    <div key={`${item.id || 'new'}-${exerciseIndex}`} className="grid gap-2 md:grid-cols-[2fr_80px_100px_100px_90px] items-end">
                      <label className="field">Ejercicio<input value={item.name} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { name: e.target.value })} /></label>
                      <label className="field">Sets<input type="number" value={item.sets} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { sets: Number(e.target.value) })} /></label>
                      <label className="field">Reps<input value={item.targetReps} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { targetReps: e.target.value })} /></label>
                      <label className="field">Rest<input type="number" value={item.restSeconds} onChange={(e) => updatePlanExercise(dayIndex, exerciseIndex, { restSeconds: Number(e.target.value) })} /></label>
                      <button className="btn-secondary" onClick={() => updatePlanExercise(dayIndex, exerciseIndex, { active: !item.active })}>{item.active === false ? 'Off' : 'On'}</button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </section>
        )}

        {activeTab === 'flow' && (store.day?.exercises.length === 0 || store.completed ? (
          <section className="border border-charcoal bg-graphite p-6 rounded text-center">
            <Activity className="mx-auto text-volt mb-4" size={42} />
            <h2 className="text-2xl font-bold">Day complete</h2>
            <p className="text-steel mt-3">Consume <strong className="text-volt">160g-175g protein</strong> to grow from 77.78 kg to 83.0 kg.</p>
          </section>
        ) : exercise && (
          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="border border-charcoal bg-graphite p-5 rounded">
              <p className="text-steel uppercase tracking-[0.25em] text-xs">Current exercise - Set {store.setNumber}/{exercise.sets}</p>
              <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                <h2 className="font-mono text-3xl text-volt">{exercise.name}</h2>
                <div className="flex items-center gap-2 text-sm text-steel"><Clock3 size={16} /> Rest {exercise.restSeconds}s</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
                <div className="metric"><span>Target</span><strong>{exercise.targetReps}</strong></div>
                <div className="metric"><span>RPE</span><strong>{exercise.rpe}</strong></div>
                <div className="metric"><span>Tipo</span><strong>{exercise.metadata?.kind === 'isolation' ? 'Aislado' : 'Compuesto'}</strong></div>
                <div className="metric"><span>Mejor set</span><strong>{history ? `${history.bestWeight}kg x ${history.bestReps}` : '-'}</strong></div>
                <div className="metric"><span>Ultimo set equivalente</span><strong>{lastEquivalentSet ? `${lastEquivalentSet.weightKg}kg x ${lastEquivalentSet.reps}` : 'Sin dato'}</strong></div>
                <div className="metric"><span>Breath</span><strong>{exercise.breath}</strong></div>
              </div>

              <div className="mt-4 border border-charcoal bg-carbon p-4 rounded">
                <p className="text-xs uppercase tracking-[0.25em] text-steel mb-2 flex gap-2"><Target size={14} /> Objetivo recomendado hoy</p>
                <p className="font-mono text-xl text-volt">{recommendedWeight ? `${recommendedWeight} kg` : 'Sin cambio de carga'} {recommendedReps ? `x ${recommendedReps}+ reps` : ''}</p>
                <p className="text-sm text-steel mt-2">{currentSuggestion ? `${currentSuggestion.reason} ${currentSuggestion.action}` : exercise.metadata?.overloadRecommendation}</p>
              </div>

              {previousSet && (
                <div className="mt-5 border border-volt/30 bg-volt/10 p-3 rounded text-sm">
                  <p>Ghost set: {previousSet.weightKg} kg x {previousSet.reps} reps</p>
                  <button className="btn-tertiary mt-3" type="button" onClick={useGhostSetValues}>Use previous set values</button>
                </div>
              )}

              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="field">Weight kg<input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" type="number" min="0" step="0.25" required /></label>
                  <label className="field">Reps<input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" type="number" min="1" step="1" required /></label>
                  <label className="field">RIR<input value={rir} onChange={(e) => setRir(e.target.value)} type="number" min="0" max="10" /></label>
                  <label className="field">RPE real<input value={actualRpe} onChange={(e) => setActualRpe(e.target.value)} type="number" min="1" max="10" /></label>
                  <label className="field">Dolor 0-10<input value={painLevel} onChange={(e) => setPainLevel(e.target.value)} type="number" min="0" max="10" /></label>
                  <label className="field">Notas<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
                </div>
                <button className="btn-primary disabled:opacity-40" disabled={!weightKg || !reps || saving}>{saving ? 'Saving...' : 'Save set'}</button>
              </form>
            </section>

            <aside className="grid gap-4">
              <AnatomyMap exercise={exercise} />
              <section className="border border-charcoal bg-carbon p-4 rounded">
                <h3 className="font-mono text-volt flex gap-2"><BookOpen /> Guia tecnica</h3>
                <p className="text-xs uppercase tracking-[0.25em] text-steel mt-3">Video</p>
                <iframe title={`${exercise.name} video`} src={exercise.metadata?.videoUrl} className="mt-2 aspect-video w-full rounded border border-charcoal" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                <p className="text-xs uppercase tracking-[0.25em] text-steel mt-4">Cues</p>
                <ul className="list-disc pl-5 text-sm text-steel">{exercise.metadata?.technicalCues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
                <p className="text-xs uppercase tracking-[0.25em] text-steel mt-4">Errores comunes</p>
                <ul className="list-disc pl-5 text-sm text-steel">{exercise.metadata?.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
              </section>
              <section className="border border-charcoal bg-carbon p-4 rounded">
                <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Up next</p>
                <p className="text-white font-medium">{store.setNumber < exercise.sets ? `Repeat ${exercise.name}` : nextExerciseName}</p>
                <p className="text-steel text-sm mt-2">Ultima sesion: {history?.latestDate ?? 'sin datos previos'}</p>
                {currentSuggestion && <div className="mt-3 flex gap-2"><button className="btn-tertiary" onClick={() => resolveSuggestion(currentSuggestion.id, true)}>Aceptar progreso</button><button className="btn-tertiary" onClick={() => resolveSuggestion(currentSuggestion.id, false)}>Posponer</button></div>}
              </section>
              <section className="border border-charcoal bg-carbon p-4 rounded">
                <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Navegacion</p>
                <div className="grid gap-3">
                  <button className="btn-secondary" type="button" disabled={viewedCycleDay <= 1 || switchingDay} onClick={() => handleDaySelection(viewedCycleDay - 1)}><ChevronLeft size={16} /> Previous day</button>
                  <button className="btn-secondary" type="button" disabled={viewedCycleDay >= currentCycleDay || switchingDay} onClick={() => handleDaySelection(viewedCycleDay + 1)}><ChevronRight size={16} /> Next day</button>
                </div>
              </section>
            </aside>
          </section>
        ))}
      </section>
    </main>
  );
}
