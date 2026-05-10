import { describe, expect, it } from 'vitest';
import { evaluateExerciseProgression } from './progression';

function baseExercise() {
  return {
    id: 'ex-1',
    name: 'Press Smith Plano',
    sets: 3,
    targetReps: '6-8',
    rpe: '9',
    plannedWeightKg: null,
    metadata: { kind: 'compound', overloadRecommendation: 'x' },
    logs: [
      { cycleDate: new Date('2026-05-10T00:00:00Z'), setNumber: 1, weightKg: 80, reps: 8, rir: 1, actualRpe: 9, painLevel: 0, techniqueStatus: 'clean' },
      { cycleDate: new Date('2026-05-10T00:00:00Z'), setNumber: 2, weightKg: 80, reps: 8, rir: 1, actualRpe: 9, painLevel: 0, techniqueStatus: 'clean' },
      { cycleDate: new Date('2026-05-10T00:00:00Z'), setNumber: 3, weightKg: 80, reps: 8, rir: 1, actualRpe: 9, painLevel: 0, techniqueStatus: 'clean' }
    ]
  };
}

describe('evaluateExerciseProgression', () => {
  it('auto-subes la carga cuando un compuesto completa el tope del rango con control', () => {
    const outcome = evaluateExerciseProgression(baseExercise());
    expect(outcome?.plannedWeightKg).toBe(82.5);
    expect(outcome?.plannedRepGoal).toBe(6);
    expect(outcome?.autoApplied).toBe(true);
  });

  it('baja la exigencia si hubo dolor o técnica compensada', () => {
    const outcome = evaluateExerciseProgression({
      ...baseExercise(),
      logs: baseExercise().logs.map((log, index) => ({ ...log, painLevel: index === 0 ? 5 : 0, techniqueStatus: 'compensated' as const }))
    });

    expect(outcome?.plannedWeightKg).toBe(77.5);
    expect(outcome?.reason).toContain('dolor');
  });

  it('prioriza reps antes que peso en un aislado', () => {
    const outcome = evaluateExerciseProgression({
      ...baseExercise(),
      name: 'Vuelos Laterales',
      targetReps: '12-15',
      metadata: { kind: 'isolation', overloadRecommendation: 'x' },
      logs: [
        { cycleDate: new Date('2026-05-10T00:00:00Z'), setNumber: 1, weightKg: 10, reps: 12, rir: 1, actualRpe: 9, painLevel: 0, techniqueStatus: 'clean' },
        { cycleDate: new Date('2026-05-10T00:00:00Z'), setNumber: 2, weightKg: 10, reps: 12, rir: 1, actualRpe: 9, painLevel: 0, techniqueStatus: 'clean' },
        { cycleDate: new Date('2026-05-10T00:00:00Z'), setNumber: 3, weightKg: 10, reps: 12, rir: 1, actualRpe: 9, painLevel: 0, techniqueStatus: 'clean' }
      ]
    });

    expect(outcome?.plannedWeightKg).toBe(10);
    expect(outcome?.plannedRepGoal).toBe(13);
  });
});
