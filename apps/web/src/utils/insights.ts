import type { BodyAnalysis, FoodItem, ProgressPhoto } from '../types';

export interface ProteinActionPlan {
  id: string;
  name: string;
  serving: string;
  servings: number;
  proteinTotal: number;
  caloriesTotal: number;
  summary: string;
}

export interface PhotoComparison {
  angle: ProgressPhoto['angle'];
  first: ProgressPhoto;
  latest: ProgressPhoto;
  daysBetween: number;
  repeatedFocusAreas: string[];
  latestSummary: string;
}

function getLatestAnalysis(photo: ProgressPhoto): BodyAnalysis | null {
  return photo.analyses?.[0] ?? null;
}

export function buildProteinActionPlan(foodItems: FoodItem[], remainingProtein: number): ProteinActionPlan[] {
  if (remainingProtein <= 0) {
    return [];
  }

  return [...foodItems]
    .sort((a, b) => {
      if (a.budget !== b.budget) {
        return Number(b.budget) - Number(a.budget);
      }

      const aDensity = a.proteinGrams / Math.max(a.calories, 1);
      const bDensity = b.proteinGrams / Math.max(b.calories, 1);
      return bDensity - aDensity;
    })
    .slice(0, 6)
    .map((food) => {
      const servings = Math.min(4, Math.max(1, Math.ceil(remainingProtein / Math.max(food.proteinGrams, 1))));
      const proteinTotal = servings * food.proteinGrams;
      const caloriesTotal = servings * food.calories;
      return {
        id: food.id,
        name: food.name,
        serving: food.serving,
        servings,
        proteinTotal,
        caloriesTotal,
        summary: `${servings} x ${food.name} (${food.serving})`
      };
    })
    .slice(0, 3);
}

export function buildPhotoComparisons(photos: ProgressPhoto[]): PhotoComparison[] {
  const grouped = new Map<ProgressPhoto['angle'], ProgressPhoto[]>();

  for (const photo of photos) {
    const existing = grouped.get(photo.angle) ?? [];
    existing.push(photo);
    grouped.set(photo.angle, existing);
  }

  return Array.from(grouped.entries())
    .map(([angle, anglePhotos]) => {
      const ordered = [...anglePhotos].sort((a, b) => a.date.localeCompare(b.date));
      if (ordered.length < 2) {
        return null;
      }

      const first = ordered[0];
      const latest = ordered[ordered.length - 1];
      const firstAnalysis = getLatestAnalysis(first);
      const latestAnalysis = getLatestAnalysis(latest);
      const repeatedFocusAreas = (latestAnalysis?.focusAreas ?? []).filter((item) => firstAnalysis?.focusAreas?.includes(item));
      const daysBetween = Math.max(
        0,
        Math.round(
          (new Date(latest.date).getTime() - new Date(first.date).getTime()) / 86400000
        )
      );

      return {
        angle,
        first,
        latest,
        daysBetween,
        repeatedFocusAreas,
        latestSummary: latestAnalysis?.summary ?? 'Sin análisis comparativo todavía.'
      };
    })
    .filter((comparison): comparison is PhotoComparison => Boolean(comparison));
}
