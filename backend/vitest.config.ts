import { defineConfig } from 'vitest/config'
import { loadDotEnv } from './src/lib/env-file.js'
import { defaultTestDatabaseUrl, defaultTestRedisUrl } from './test/prepare-db.js'

loadDotEnv('.env')

// Tests get their own database and Redis logical database. The dev database is never read or written by a test.
export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl,
      REDIS_URL: process.env.TEST_REDIS_URL ?? defaultTestRedisUrl,
      CONTACT_HMAC_SECRET: 'test-secret-that-is-long-enough',
      FLAG_SALT: 'test-salt-velio',
      PG_POOL_MAX: '60',
      LOG_LEVEL: 'silent',
      WEB_ORIGIN: 'http://localhost:3000',
      PUBLIC_WEB_URL: 'http://localhost:3000',
      PUBLIC_API_URL: 'http://localhost:4000',
    },
  },
})
