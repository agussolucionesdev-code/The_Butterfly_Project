import { create } from 'zustand';
import type { Exercise, SetLog, TrainingDay } from '../types';

interface WorkoutState {
  cycleDay: number; cycleDate: string; day: TrainingDay | null; logs: SetLog[]; exerciseIndex: number; setNumber: number;
  timerSeconds: number; timerInitialSeconds: number; timerActive: boolean; timerPaused: boolean; completed: boolean;
  setWorkout: (cycleDay: number, cycleDate: string, day: TrainingDay, logs: SetLog[]) => void; addLog: (log: SetLog) => void;
  startTimer: (seconds: number) => void; tickTimer: () => void; addTimerSeconds: (seconds: number) => void; setTimerSeconds: (seconds: number) => void; resetTimer: () => void; togglePause: () => void; skipTimer: () => void; advance: () => void;
  getCurrentExercise: () => Exercise | null; getPreviousSet: () => SetLog | undefined;
}

function derivePosition(day: TrainingDay, logs: SetLog[]) {
  for (const [exerciseIndex, exercise] of day.exercises.entries()) {
    for (let setNumber = 1; setNumber <= exercise.sets; setNumber++) {
      if (!logs.some((log) => log.exerciseId === exercise.id && log.setNumber === setNumber)) return { exerciseIndex, setNumber, completed: false };
    }
  }
  return { exerciseIndex: 0, setNumber: 1, completed: day.exercises.length > 0 };
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  cycleDay: 1, cycleDate: '', day: null, logs: [], exerciseIndex: 0, setNumber: 1, timerSeconds: 0, timerInitialSeconds: 0, timerActive: false, timerPaused: false, completed: false,
  setWorkout: (cycleDay, cycleDate, day, logs) => set({ cycleDay, cycleDate, day, logs, ...derivePosition(day, logs), timerSeconds: 0, timerInitialSeconds: 0, timerActive: false, timerPaused: false }),
  addLog: (log) => set((state) => ({ logs: [...state.logs.filter((item) => item.id !== log.id), log] })),
  startTimer: (seconds) => set({ timerSeconds: Math.max(0, seconds), timerInitialSeconds: Math.max(0, seconds), timerActive: seconds > 0, timerPaused: false }),
  tickTimer: () => { const state = get(); if (!state.timerActive || state.timerPaused) return; if (state.timerSeconds <= 1) { navigator.vibrate?.(250); get().advance(); return; } set({ timerSeconds: state.timerSeconds - 1 }); },
  addTimerSeconds: (seconds) => set((state) => ({ timerSeconds: Math.max(0, state.timerSeconds + seconds) })),
  setTimerSeconds: (seconds) => set({ timerSeconds: Math.max(0, seconds) }),
  resetTimer: () => set((state) => ({ timerSeconds: state.timerInitialSeconds })),
  togglePause: () => set((state) => ({ timerPaused: !state.timerPaused })),
  skipTimer: () => get().advance(),
  advance: () => { const { day, exerciseIndex, setNumber } = get(); if (!day) return; const exercise = day.exercises[exerciseIndex]; if (!exercise) return set({ completed: true, timerActive: false, timerSeconds: 0 }); if (setNumber < exercise.sets) return set({ setNumber: setNumber + 1, timerActive: false, timerSeconds: 0, timerPaused: false }); if (exerciseIndex < day.exercises.length - 1) return set({ exerciseIndex: exerciseIndex + 1, setNumber: 1, timerActive: false, timerSeconds: 0, timerPaused: false }); set({ completed: true, timerActive: false, timerSeconds: 0, timerPaused: false }); },
  getCurrentExercise: () => { const { day, exerciseIndex, completed } = get(); if (!day || completed) return null; return day.exercises[exerciseIndex] ?? null; },
  getPreviousSet: () => { const { logs, getCurrentExercise, setNumber } = get(); const exercise = getCurrentExercise(); if (!exercise || setNumber <= 1) return undefined; return logs.find((log) => log.exerciseId === exercise.id && log.setNumber === setNumber - 1); }
}));
