import { z } from 'zod'
import { loadDotEnv } from './lib/env-file.js'

if (process.env.NODE_ENV !== 'test') loadDotEnv('.env')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  REDIS_CHANNEL_PREFIX: z.string().default('velio'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),
  PUBLIC_API_URL: z.url().default('http://localhost:4000'),
  CONTACT_HMAC_SECRET: z.string().min(16),
  FLAG_SALT: z.string().min(8),
  DEFAULT_PHONE_REGION: z.string().length(2).default('US'),
  LOG_LEVEL: z.string().default('info'),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
  BOOKING_TX_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  UPLOADS_DIR: z.string().default('uploads'),
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  SCENARIO_DATABASE_URL: z.url().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')
  throw new Error(`Invalid environment:\n  ${problems}\nSee backend/.env.example`)
}

export const config = {
  ...parsed.data,
  webOrigins: parsed.data.WEB_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
}

export type Config = typeof config
