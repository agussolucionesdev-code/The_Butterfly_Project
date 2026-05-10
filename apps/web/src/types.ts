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
  sessionId?: string | null;
  cycleDay: number;
  cycleDate: string;
  setNumber: number;
  setType?: 'working' | 'approach';
  approachOrder?: number | null;
  weightKg: number;
  reps: number;
  rir?: number | null;
  actualRpe?: number | null;
  techniqueStatus?: 'clean' | 'grindy' | 'compensated' | null;
  tempo?: string | null;
  tempoSeconds?: number | null;
  holdSeconds?: number | null;
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

export interface CoachRecommendation {
  id: string;
  exerciseId?: string | null;
  cycleDay?: number | null;
  cycleDate?: string | null;
  title: string;
  message: string;
  reason: string;
  action: string;
  source: string;
  status: string;
  createdAt: string;
}

export interface FoodItem {
  id: string;
  name: string;
  serving: string;
  proteinGrams: number;
  calories: number;
  category: string;
  budget: boolean;
  notes?: string | null;
}

export interface NutritionLog {
  id: string;
  date: string;
  meal: string;
  foodName: string;
  quantity: number;
  proteinGrams: number;
  calories: number;
  notes?: string | null;
}

export interface HabitGoal {
  id: string;
  key: string;
  label: string;
  target: string;
  active: boolean;
  order: number;
}

export interface HabitLog {
  id: string;
  goalKey: string;
  date: string;
  completed: boolean;
  value?: string | null;
  notes?: string | null;
}

export interface BodyAnalysis {
  id: string;
  photoId: string;
  summary: string;
  focusAreas: string[];
  recommendations: string[];
  postureNotes: string[];
  source: string;
  createdAt: string;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  angle: 'front' | 'side' | 'back';
  imageUrl: string;
  publicId?: string | null;
  notes?: string | null;
  analyses?: BodyAnalysis[];
}

export interface DailyChallenge {
  id: string;
  date: string;
  title: string;
  description: string;
  category: string;
  completed: boolean;
}
