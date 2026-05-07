import { describe, expect, it } from 'vitest';
import { useWorkoutStore } from './store/workoutStore';

const day = { id: 'd1', cycleDay: 1, name: 'Empuje', exercises: [
  { id: 'ex1', sourceId: 'e1', name: 'Press Smith Plano', sets: 3, targetReps: '6-8', rpe: '9', restSeconds: 180, breath: 'Inhala bajar / Exhala empujar', warmup: true, order: 1 },
  { id: 'ex2', sourceId: 'e2', name: 'Press Militar Manc.', sets: 3, targetReps: '8-10', rpe: '8', restSeconds: 120, breath: 'Inhala bajar / Exhala subir', warmup: false, order: 2 }
] };

describe('workout store', () => {
  it('shows the first incomplete exercise and ghost set for set 2', () => {
    useWorkoutStore.getState().setWorkout(1, '2026-02-26', day, [{ id: 'l1', exerciseId: 'ex1', cycleDay: 1, cycleDate: '2026-02-26', setNumber: 1, weightKg: 80, reps: 8, completedAt: '' }]);
    expect(useWorkoutStore.getState().getCurrentExercise()?.name).toBe('Press Smith Plano');
    expect(useWorkoutStore.getState().setNumber).toBe(2);
    expect(useWorkoutStore.getState().getPreviousSet()?.weightKg).toBe(80);
  });
});
