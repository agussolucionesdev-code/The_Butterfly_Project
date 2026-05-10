export interface ExerciseMetadata {
  id: string;
  exerciseId: string;
  kind: 'compound' | 'isolation';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  stabilizerMuscles: string[];
  videoUrl: string;
  referenceUrl?: string | null;
  referenceLabel?: string | null;
  instructions: string[];
  commonMistakes: string[];
  technicalCues: string[];
  overloadRecommendation: string;
}

export interface Exercise {
  id: string;
  sourceId: string;
  name: string;
  sets: number;
  targetReps: string;
  rpe: string;
  restSeconds: number;
  breath: string;
  warmup: boolean;
  active?: boolean;
  plannedWeightKg?: number | null;
  plannedRepGoal?: number | null;
  lastProgressionReason?: string | null;
  lastProgressionAction?: string | null;
  lastProgressionAt?: string | null;
  order: number;
  metadata?: ExerciseMetadata | null;
}

export interface TrainingDay {
  id: string;
  cycleDay: number;
  name: string;
  exercises: Exercise[];
}

export interface SetLog {
  id: string;
  exerciseId: string;
  cycleDay: number;
  cycleDate: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir?: number | null;
  actualRpe?: number | null;
  techniqueStatus?: 'clean' | 'grindy' | 'compensated' | null;
  tempo?: string | null;
  painLevel?: number | null;
  notes?: string | null;
  restTakenSeconds?: number | null;
  completedAt: string;
}

export interface ExerciseHistory {
  latestDate?: string;
  latestLogs: SetLog[];
  bestWeight: number;
  bestReps: number;
  bestVolume: number;
  logs: SetLog[];
}

export interface VolumeAnalytics {
  total: number;
  byDay: Record<string, number>;
  byExercise: Record<string, number>;
  byMuscle: Record<string, number>;
}

export interface ProgressionSuggestion {
  id: string;
  exerciseId: string;
  evaluatedCycleDate: string;
  reason: string;
  action: string;
  status: 'pending' | 'accepted' | 'rejected';
  autoApplied?: boolean;
  targetWeightKg?: number | null;
  targetRepGoal?: number | null;
  resolvedAt?: string | null;
  exercise?: Exercise;
}

export interface ProgressionAnalytics {
  suggestions: ProgressionSuggestion[];
  latestApplied: ProgressionSuggestion[];
}

export interface BodyMetric {
  id: string;
  date: string;
  bodyWeightKg: number;
  proteinGrams: number;
  notes?: string | null;
}
