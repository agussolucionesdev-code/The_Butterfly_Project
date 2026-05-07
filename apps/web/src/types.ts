export interface Exercise { id: string; sourceId: string; name: string; sets: number; targetReps: string; rpe: string; restSeconds: number; breath: string; warmup: boolean; order: number; }
export interface TrainingDay { id: string; cycleDay: number; name: string; exercises: Exercise[]; }
export interface SetLog { id: string; exerciseId: string; cycleDay: number; cycleDate: string; setNumber: number; weightKg: number; reps: number; completedAt: string; }
