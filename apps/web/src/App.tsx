import { Activity, ChevronLeft, ChevronRight, Clock3, Lock, RotateCcw, Timer, Zap } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getDay, getLogs, getToday, saveSet } from './api';
import { useWorkoutStore } from './store/workoutStore';
import { getEstimatedVolume, getWorkoutProgress, resolveCycleDate } from './utils/workout';

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function clampNumericInput(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function App() {
  const [weightKg, setWeightKg] = useState('');
  const [reps, setReps] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('0');
  const [timerSecondsInput, setTimerSecondsInput] = useState('0');
  const [selectedCycleDay, setSelectedCycleDay] = useState<number | null>(null);
  const [currentCycleDay, setCurrentCycleDay] = useState(1);
  const [currentCycleDate, setCurrentCycleDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingDay, setSwitchingDay] = useState(false);

  const store = useWorkoutStore();
  const exercise = store.getCurrentExercise();
  const previousSet = store.getPreviousSet();

  const progress = useMemo(() => getWorkoutProgress(store.day, store.logs), [store.day, store.logs]);
  const estimatedVolume = useMemo(() => getEstimatedVolume(store.logs), [store.logs]);
  const viewedCycleDay = selectedCycleDay ?? currentCycleDay;
  const isViewingToday = viewedCycleDay === currentCycleDay;
  const totalExercises = store.day?.exercises.length ?? 0;
  const nextExerciseName = store.day && exercise
    ? store.day.exercises[store.exerciseIndex + 1]?.name ?? 'Workout complete'
    : 'Workout complete';

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
    const minutes = Math.floor(store.timerSeconds / 60);
    const seconds = store.timerSeconds % 60;
    setTimerMinutes(String(minutes));
    setTimerSecondsInput(String(seconds));
  }, [store.timerSeconds]);

  const cycleDays = useMemo(() => Array.from({ length: 7 }, (_, i) => i + 1), []);

  async function handleDaySelection(targetCycleDay: number) {
    if (targetCycleDay > currentCycleDay || targetCycleDay === viewedCycleDay) return;
    setError('');
    setSwitchingDay(true);

    try {
      await loadWorkoutForDay(targetCycleDay);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch training day.');
    } finally {
      setSwitchingDay(false);
    }
  }

  function applyCustomTimer() {
    const safeMinutes = Math.max(0, Math.floor(clampNumericInput(timerMinutes)));
    const safeSeconds = Math.min(59, Math.max(0, Math.floor(clampNumericInput(timerSecondsInput))));
    const totalSeconds = safeMinutes * 60 + safeSeconds;
    store.setTimerSeconds(totalSeconds);
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
        reps: parsedReps
      });

      store.addLog(result.log);
      setWeightKg('');
      setReps('');

      if (result.restSeconds > 0) store.startTimer(result.restSeconds);
      else store.advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Set could not be saved.');
    } finally {
      setSaving(false);
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
        <p className="text-steel mb-6 max-w-md">
          Next step: <strong className="text-white">{store.setNumber < (exercise?.sets ?? 0) ? `Set ${store.setNumber + 1}` : nextExerciseName}</strong>
        </p>

        <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-4">
          {[-20, -15, -10, 10, 15, 20].map((seconds) => (
            <button
              key={seconds}
              className={`btn-secondary ${seconds < 0 ? 'text-red-200' : ''}`}
              onClick={() => store.addTimerSeconds(seconds)}
            >
              {seconds > 0 ? `+${seconds}s` : `${seconds}s`}
            </button>
          ))}
        </div>

        <div className="border border-charcoal bg-carbon rounded p-4 w-full max-w-md mb-4">
          <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Custom timer</p>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <label className="field text-left">
              Minutes
              <input value={timerMinutes} onChange={(event) => setTimerMinutes(event.target.value)} type="number" min="0" step="1" />
            </label>
            <span className="font-mono text-2xl mt-6">:</span>
            <label className="field text-left">
              Seconds
              <input value={timerSecondsInput} onChange={(event) => setTimerSecondsInput(event.target.value)} type="number" min="0" max="59" step="1" />
            </label>
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
      <section className="mx-auto max-w-3xl">
        <header className="mb-6 border border-charcoal bg-carbon p-5 rounded">
          <div className="flex items-center gap-2 text-volt font-mono uppercase tracking-[0.3em] text-xs">
            <Zap size={16} /> The Butterfly Project
          </div>

          <div className="flex items-start justify-between gap-4 mt-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold">{store.day?.name ?? 'Training day'}</h1>
              <p className="text-steel mt-2">Cycle day {store.cycleDay} - {store.cycleDate}</p>
              {!isViewingToday && <p className="text-volt mt-2 text-sm">Viewing previous day from this cycle block.</p>}
            </div>

            <div className="border border-charcoal bg-graphite p-4 rounded min-w-[220px]">
              <p className="text-xs uppercase tracking-[0.25em] text-steel mb-2">Progress</p>
              <p className="font-mono text-2xl text-volt">{progress.completedSets}/{progress.totalSets}</p>
              <div className="h-2 bg-obsidian rounded mt-3 overflow-hidden">
                <div className="h-full bg-volt" style={{ width: `${progress.completionRatio * 100}%` }} />
              </div>
              <p className="text-xs text-steel mt-3">Exercises: {totalExercises} - Volume: {estimatedVolume.toFixed(1)} kg</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mt-5">
            {cycleDays.map((day) => {
              const locked = day > currentCycleDay;
              const active = day === viewedCycleDay;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={locked || switchingDay}
                  onClick={() => handleDaySelection(day)}
                  className={`day-pill ${active ? 'day-pill-active' : ''} ${locked ? 'day-pill-locked' : ''}`}
                >
                  {locked ? <Lock size={14} /> : day}
                </button>
              );
            })}
          </div>
        </header>

        {error && <p className="mb-4 border border-red-500/40 bg-red-950/40 p-3 text-red-200 rounded">{error}</p>}

        {store.day?.exercises.length === 0 || store.completed ? (
          <section className="border border-charcoal bg-graphite p-6 rounded text-center">
            <Activity className="mx-auto text-volt mb-4" size={42} />
            <h2 className="text-2xl font-bold">Day complete</h2>
            <p className="text-steel mt-3">Consume <strong className="text-volt">160g-175g protein</strong> to grow from 77.78 kg to 83.0 kg. No atajos: consistencia, comida y registro.</p>
            <div className="grid grid-cols-2 gap-3 mt-6 text-left">
              <div className="metric"><span>Total sets</span><strong>{progress.completedSets}</strong></div>
              <div className="metric"><span>Estimated volume</span><strong>{estimatedVolume.toFixed(1)} kg</strong></div>
            </div>
          </section>
        ) : exercise && (
          <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <section className="border border-charcoal bg-graphite p-5 rounded">
              <p className="text-steel uppercase tracking-[0.25em] text-xs">Current exercise - Set {store.setNumber}/{exercise.sets}</p>
              <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                <h2 className="font-mono text-3xl text-volt">{exercise.name}</h2>
                <div className="flex items-center gap-2 text-sm text-steel">
                  <Clock3 size={16} /> Rest {exercise.restSeconds}s
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
                <div className="metric"><span>Target</span><strong>{exercise.targetReps}</strong></div>
                <div className="metric"><span>RPE</span><strong>{exercise.rpe}</strong></div>
                <div className="metric col-span-2"><span>Breath</span><strong>{exercise.breath}</strong></div>
              </div>

              {exercise.warmup && <p className="mt-4 text-volt text-sm">Warmup marker active.</p>}

              {previousSet && (
                <div className="mt-5 border border-volt/30 bg-volt/10 p-3 rounded text-sm">
                  <p>Ghost set: {previousSet.weightKg} kg x {previousSet.reps} reps</p>
                  <button className="btn-tertiary mt-3" type="button" onClick={useGhostSetValues}>Use previous set values</button>
                </div>
              )}

              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <label className="field">
                  Weight kg
                  <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" type="number" min="0" step="0.25" required />
                </label>
                <label className="field">
                  Reps
                  <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" type="number" min="1" step="1" required />
                </label>
                <button className="btn-primary disabled:opacity-40" disabled={!weightKg || !reps || saving}>
                  {saving ? 'Saving...' : 'Save set'}
                </button>
              </form>
            </section>

            <aside className="grid gap-4">
              <section className="border border-charcoal bg-carbon p-4 rounded">
                <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Navigation</p>
                <div className="grid gap-3">
                  <button className="btn-secondary" type="button" disabled={viewedCycleDay <= 1 || switchingDay} onClick={() => handleDaySelection(viewedCycleDay - 1)}>
                    <ChevronLeft size={16} /> Previous day
                  </button>
                  <button className="btn-secondary" type="button" disabled={viewedCycleDay >= currentCycleDay || switchingDay} onClick={() => handleDaySelection(viewedCycleDay + 1)}>
                    <ChevronRight size={16} /> Next day
                  </button>
                </div>
              </section>

              <section className="border border-charcoal bg-carbon p-4 rounded">
                <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Up next</p>
                <p className="text-white font-medium">{store.setNumber < exercise.sets ? `Repeat ${exercise.name}` : nextExerciseName}</p>
                <p className="text-steel text-sm mt-2">{store.setNumber < exercise.sets ? `Set ${store.setNumber + 1} after rest.` : 'You advance automatically after the last set.'}</p>
              </section>

              <section className="border border-charcoal bg-carbon p-4 rounded">
                <p className="text-xs uppercase tracking-[0.25em] text-steel mb-3">Session stats</p>
                <div className="grid gap-3">
                  <div className="metric"><span>Completed sets</span><strong>{progress.completedSets}</strong></div>
                  <div className="metric"><span>Estimated volume</span><strong>{estimatedVolume.toFixed(1)} kg</strong></div>
                </div>
              </section>
            </aside>
          </section>
        )}
      </section>
    </main>
  );
}

