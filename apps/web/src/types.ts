export interface ExerciseMetadata {
  id: string;
  exerciseId: string;
  kind: 'compound' | 'isolation';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  stabilizerMuscles: string[];
  videoUrl: string;
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
  order: number;
  metadata?: ExerciseMetadata | null;
}

export interface TrainingDay { id: string; cycleDay: number; name: string; exercises: Exercise[]; }

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
  reason: string;
  action: string;
  status: 'pending' | 'accepted' | 'rejected';
  exercise?: Exercise;
}

export interface BodyMetric {
  id: string;
  date: string;
  bodyWeightKg: number;
  proteinGrams: number;
  notes?: string | null;
}

