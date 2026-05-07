export const REFERENCE_DATE = '2026-02-26';
export const MS_PER_DAY = 86_400_000;
export type RpeValue = number | 'FALLO';
export interface ExerciseSeed { id: string; name: string; sets: number; reps: string; rpe: RpeValue; rest: number; breath: string; warmup: boolean; }
export interface TrainingDaySeed { name: string; exercises: ExerciseSeed[]; }
export type TrainingDb = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, TrainingDaySeed>;

export const TRAINING_DB: TrainingDb = {
  1: { name: 'Empuje (Pecho / Hombro / Triceps)', exercises: [
    { id: 'e1', name: 'Press Smith Plano', sets: 3, reps: '6-8', rpe: 9, rest: 180, breath: 'Inhala bajar / Exhala empujar', warmup: true },
    { id: 'e2', name: 'Press Militar Manc.', sets: 3, reps: '8-10', rpe: 8, rest: 120, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e3', name: 'Vuelos Laterales', sets: 4, reps: '12-15', rpe: 'FALLO', rest: 60, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e4', name: 'Fondos Paralelas', sets: 3, reps: '10-12', rpe: 9, rest: 120, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e5', name: 'Triceps Polea Alta', sets: 3, reps: '12-15', rpe: 'FALLO', rest: 90, breath: 'Inhala subir / Exhala bajar', warmup: false }
  ] },
  2: { name: 'Tracción (Espalda / Biceps / Post.)', exercises: [
    { id: 'e6', name: 'Dominadas Supinas', sets: 3, reps: 'FALLO', rpe: 'FALLO', rest: 180, breath: 'Inhala bajar / Exhala subir', warmup: true },
    { id: 'e7', name: 'Remo Barra Libre 45°', sets: 3, reps: '8-10', rpe: 9, rest: 120, breath: 'Inhala estirar / Exhala traccionar', warmup: false },
    { id: 'e8', name: 'Jalón al Pecho', sets: 3, reps: '10-12', rpe: 9, rest: 90, breath: 'Inhala subir / Exhala bajar', warmup: false },
    { id: 'e9', name: 'Curl Barra Pesado', sets: 3, reps: '8-10', rpe: 9, rest: 90, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e10', name: 'Vuelos Posteriores', sets: 3, reps: '15', rpe: 'FALLO', rest: 60, breath: 'Inhala bajar / Exhala abrir', warmup: false }
  ] },
  3: { name: 'Pierna (Cuádr.) + Pecho F2 (Sup.)', exercises: [
    { id: 'e11', name: 'Sentadilla Smith', sets: 4, reps: '6-8', rpe: 9, rest: 240, breath: 'Valsalva', warmup: true },
    { id: 'e12', name: 'Zancadas Manc.', sets: 3, reps: '10/p', rpe: 9, rest: 120, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e13', name: 'Press Inclinado Smith', sets: 3, reps: '10-12', rpe: 9, rest: 120, breath: 'Inhala bajar / Exhala empujar', warmup: false },
    { id: 'e14', name: 'Extensión Cuadriceps', sets: 3, reps: '15', rpe: 'FALLO', rest: 90, breath: 'Inhala bajar / Exhala extender', warmup: false },
    { id: 'e15', name: 'Pantorrilla Sentado', sets: 4, reps: '15-20', rpe: 'FALLO', rest: 60, breath: 'Inhala abajo / Exhala arriba', warmup: false }
  ] },
  4: { name: 'Descanso Activo', exercises: [] },
  5: { name: 'Torso Estético (Pecho F3 / Hombro / Brazos)', exercises: [
    { id: 'e16', name: 'Vuelos Lat. Sentado', sets: 4, reps: '15', rpe: 'FALLO', rest: 60, breath: 'Inhala bajar / Exhala subir', warmup: true },
    { id: 'e17', name: 'Aperturas en Polea', sets: 3, reps: '15-20', rpe: 'FALLO', rest: 60, breath: 'Inhala abrir / Exhala cerrar', warmup: false },
    { id: 'e18', name: 'Curl Martillo (SS)', sets: 3, reps: '12', rpe: 'FALLO', rest: 0, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e19', name: 'Fondos entre Bancos', sets: 3, reps: 'FALLO', rpe: 'FALLO', rest: 90, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e20', name: 'Pull-over Mancuerna', sets: 3, reps: '12-15', rpe: 9, rest: 90, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e21', name: 'Flexiones al Fallo', sets: 2, reps: 'FALLO', rpe: 'FALLO', rest: 60, breath: 'Inhala bajar / Exhala subir', warmup: false }
  ] },
  6: { name: 'Pierna (Isquios F1) + Core (F1)', exercises: [
    { id: 'e22', name: 'Peso Muerto Rumano', sets: 4, reps: '8-10', rpe: 9, rest: 180, breath: 'Valsalva', warmup: true },
    { id: 'e23', name: 'Hip Thrust Smith', sets: 3, reps: '10-12', rpe: 9, rest: 120, breath: 'Inhala bajar / Exhala empujar', warmup: false },
    { id: 'e24', name: 'Crunch en Polea Alta', sets: 3, reps: '12-15', rpe: 'FALLO', rest: 90, breath: 'Inhala subir / Exhala contraer', warmup: false },
    { id: 'e25', name: 'Elevación Piernas', sets: 3, reps: 'FALLO', rpe: 'FALLO', rest: 90, breath: 'Inhala bajar / Exhala subir', warmup: false },
    { id: 'e26', name: 'Pantorrilla de pie', sets: 4, reps: '12', rpe: 9, rest: 60, breath: 'Inhala abajo / Exhala arriba', warmup: false }
  ] },
  7: { name: 'Descanso Total', exercises: [] }
};

export function toUtcDateOnly(date: Date): Date { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
export function parseDateOnly(input: string): Date { const [y,m,d] = input.split('-').map(Number); if (!y || !m || !d) throw new Error('Invalid date.'); return new Date(Date.UTC(y, m - 1, d)); }
export function formatDateOnly(date: Date): string { return toUtcDateOnly(date).toISOString().slice(0, 10); }
export function getCycleDay(date = new Date()): 1|2|3|4|5|6|7 { const diff = Math.floor((toUtcDateOnly(date).getTime() - parseDateOnly(REFERENCE_DATE).getTime()) / MS_PER_DAY); return ((((diff % 7) + 7) % 7) + 1) as 1|2|3|4|5|6|7; }
export function isFutureCycleDay(targetCycleDay: number, date = new Date()): boolean { return targetCycleDay > getCycleDay(date); }
