import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.string().default('development')
});

export const env = envSchema.parse(process.env);
