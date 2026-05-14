import { describe, expect, it } from 'vitest';
import { buildPhotoComparisons, buildProteinActionPlan } from './insights';

describe('buildProteinActionPlan', () => {
  it('prioritizes budget foods and calculates servings to close the protein gap', () => {
    const suggestions = buildProteinActionPlan([
      { id: '1', name: 'Huevos', serving: '2 unidades', proteinGrams: 12, calories: 140, category: 'protein', budget: true },
      { id: '2', name: 'Atún', serving: '1 lata', proteinGrams: 27, calories: 150, category: 'protein', budget: true },
      { id: '3', name: 'Yogur', serving: '1 pote', proteinGrams: 10, calories: 120, category: 'protein', budget: false }
    ], 40);

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]?.name).toBe('Atún');
    expect(suggestions[0]?.servings).toBe(2);
    expect(suggestions[0]?.proteinTotal).toBe(54);
  });
});

describe('buildPhotoComparisons', () => {
  it('builds comparisons per angle using the first and latest photo', () => {
    const comparisons = buildPhotoComparisons([
      {
        id: 'p1',
        date: '2026-05-01',
        angle: 'front',
        imageUrl: 'front-1',
        analyses: [{ id: 'a1', photoId: 'p1', summary: 'Falta hombro', focusAreas: ['Hombros'], recommendations: [], postureNotes: [], source: 'coach', createdAt: '2026-05-01' }]
      },
      {
        id: 'p2',
        date: '2026-05-10',
        angle: 'front',
        imageUrl: 'front-2',
        analyses: [{ id: 'a2', photoId: 'p2', summary: 'Mejoró torso', focusAreas: ['Hombros', 'Pecho'], recommendations: [], postureNotes: [], source: 'coach', createdAt: '2026-05-10' }]
      }
    ]);

    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]?.daysBetween).toBe(9);
    expect(comparisons[0]?.repeatedFocusAreas).toEqual(['Hombros']);
    expect(comparisons[0]?.latestSummary).toBe('Mejoró torso');
  });
});
