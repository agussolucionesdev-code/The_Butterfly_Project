import { describe, expect, it } from 'vitest';
import { getCycleDay, TRAINING_DB } from './training';

describe('cycle logic', () => {
  it('starts day 1 on reference date', () => {
    expect(getCycleDay(new Date('2026-02-26T12:00:00Z'))).toBe(1);
  });

  it('wraps after seven days', () => {
    expect(getCycleDay(new Date('2026-03-05T12:00:00Z'))).toBe(1);
  });
});

describe('seed data', () => {
  it('contains seven days and 26 exercises', () => {
    expect(Object.keys(TRAINING_DB)).toHaveLength(7);
    expect(Object.values(TRAINING_DB).flatMap((day) => day.exercises)).toHaveLength(26);
  });
});
