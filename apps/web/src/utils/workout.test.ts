import { describe, expect, it } from 'vitest';
import { getEstimatedVolume, getWorkoutProgress, resolveCycleDate } from './workout';

describe('workout utilities', () => {
  it('resolves a past cycle date inside the current 7-day block', () => {
    expect(resolveCycleDate(5, '2026-05-07', 3)).toBe('2026-05-05');
  });

  it('calculates workout progress and volume', () => {
    const day = {
      id: 'd1',
      cycleDay: 1,
      name: 'Empuje',
      exercises: [
        { id: 'a', sourceId: 'e1', name: 'A', sets: 3, targetReps: '6-8', rpe: '9', restSeconds: 180, breath: 'x', warmup: false, order: 1 },
        { id: 'b', sourceId: 'e2', name: 'B', sets: 2, targetReps: '8-10', rpe: '8', restSeconds: 120, breath: 'y', warmup: false, order: 2 }
      ]
    };
    const logs = [
      { id: '1', exerciseId: 'a', cycleDay: 1, cycleDate: '2026-05-07', setNumber: 1, weightKg: 80, reps: 8, completedAt: '' },
      { id: '2', exerciseId: 'a', cycleDay: 1, cycleDate: '2026-05-07', setNumber: 2, weightKg: 82.5, reps: 7, completedAt: '' }
    ];

    expect(getWorkoutProgress(day, logs)).toEqual({
      completedSets: 2,
      totalSets: 5,
      completionRatio: 0.4
    });
    expect(getEstimatedVolume(logs)).toBe(1217.5);
  });
});
