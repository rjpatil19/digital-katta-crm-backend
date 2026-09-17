import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgres://postgres:postgres@localhost:5432/digital_katta_crm'),
  JWT_SECRET: z
    .string()
    .min(16)
    .default('digital-katta-crm-secret-key-super-secure-jwt-2026'),
  REDIS_URL: z
    .string()
    .default('redis://localhost:6379'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  PORT: process.env.CRM_PORT || 3001,
  HOST: process.env.HOST,
  NODE_ENV: process.env.NODE_ENV
});
