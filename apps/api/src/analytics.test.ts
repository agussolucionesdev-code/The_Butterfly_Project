import { describe, expect, it } from 'vitest';
import { parseHighRep, summarizeAdherence, summarizeVolume } from './analytics';

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

  it('summarizes weekly adherence and training streak', () => {
    expect(summarizeAdherence([
      { date: '2026-05-08', proteinTargetMet: false, trainingCompleted: false, completedHabits: 2, totalHabits: 4 },
      { date: '2026-05-09', proteinTargetMet: true, trainingCompleted: true, completedHabits: 4, totalHabits: 4 },
      { date: '2026-05-10', proteinTargetMet: true, trainingCompleted: true, completedHabits: 3, totalHabits: 4 }
    ])).toEqual({
      days: [
        { date: '2026-05-08', proteinTargetMet: false, trainingCompleted: false, completedHabits: 2, totalHabits: 4 },
        { date: '2026-05-09', proteinTargetMet: true, trainingCompleted: true, completedHabits: 4, totalHabits: 4 },
        { date: '2026-05-10', proteinTargetMet: true, trainingCompleted: true, completedHabits: 3, totalHabits: 4 }
      ],
      proteinDays: 2,
      trainingDays: 2,
      habitCompletionRate: (0.5 + 1 + 0.75) / 3,
      currentTrainingStreak: 2
    });
  });
});

