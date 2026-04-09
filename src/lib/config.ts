import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/wiktionary'),
  LOG_LEVEL: z.string().default('info'),
  BASE_URL: z.string().default(''),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(20),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(10000),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(100),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  logLevel: env.LOG_LEVEL,
  baseUrl: env.BASE_URL,
  dbPoolMax: env.DB_POOL_MAX,
  dbStatementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS,
  corsOrigin: env.CORS_ORIGIN,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX,
};
