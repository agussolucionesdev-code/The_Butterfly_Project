import { describe, expect, it } from 'vitest';
import { parseHighRep, summarizeVolume } from './analytics';

describe('progression analytics', () => {
  it('extracts the high end of a rep target', () => {
    expect(parseHighRep('6-8')).toBe(8);
    expect(parseHighRep('10/p')).toBe(10);
    expect(parseHighRep('FALLO')).toBeNull();
  });

  it('summarizes daily, exercise and weighted muscle volume', () => {
    const logs = [
      { cycleDate: new Date('2026-05-07T00:00:00Z'), weightKg: 100, reps: 8, exercise: { name: 'Press', metadata: { primaryMuscles: ['chest'], secondaryMuscles: ['triceps'], stabilizerMuscles: ['core'] } } },
      { cycleDate: new Date('2026-05-07T00:00:00Z'), weightKg: 50, reps: 10, exercise: { name: 'Pushdown', metadata: { primaryMuscles: ['triceps'], secondaryMuscles: [], stabilizerMuscles: [] } } }
    ];

    expect(summarizeVolume(logs)).toEqual({
      total: 1300,
      byDay: { '2026-05-07': 1300 },
      byExercise: { Press: 800, Pushdown: 500 },
      byMuscle: { chest: 800, triceps: 900, core: 200 }
    });
  });
});

