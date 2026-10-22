import { execFileSync } from 'node:child_process'
import pg from 'pg'

export const defaultTestDatabaseUrl = 'postgresql://velio:velio@localhost:5432/velio_test'
export const defaultTestRedisUrl = 'redis://localhost:6379/1'

export function testDatabaseUrl() {
  return process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl
}

// Creates the test database if it's missing and brings it up to date. Refuses anything not named *_test so it can never touch the dev database.
export async function prepareTestDatabase(url = testDatabaseUrl()) {
  const parsed = new URL(url)
  const dbName = parsed.pathname.slice(1)
  if (!dbName.endsWith('_test')) throw new Error(`Refusing to prepare "${dbName}": test databases must end with _test`)

  parsed.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: parsed.toString() })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`)
  } finally {
    await admin.end()
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: process.env.CI ? 'inherit' : 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  })
  return url
}
