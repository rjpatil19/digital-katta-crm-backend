import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { env } from './env';

// For migrations & queries in serverless or container runtimes:
// max 10 connections for app pooling
const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(queryClient, { schema });
export type AppDatabase = typeof db;
