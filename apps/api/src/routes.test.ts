import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const schema = z.object({ weightKg: z.number().positive(), reps: z.number().int().positive() });

describe('set log validation', () => {
  it('requires weight and reps', () => {
    expect(schema.safeParse({ weightKg: 80 }).success).toBe(false);
    expect(schema.safeParse({ weightKg: 80, reps: 8 }).success).toBe(true);
  });
});
