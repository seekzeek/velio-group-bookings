// Fills a separate database for the k6 load test: one host, hundreds of bookers with nothing booked, and a handful of
// activities with room. Writes the ids to load-test/fixture.json. Run with `npm run load:seed`. It wipes that database first.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { activityBucket } from '../src/modules/flags/flags.js'

const url = process.env.LOAD_DATABASE_URL ?? 'postgresql://velio:velio@localhost:5432/velio_load'
const userCount = Number(process.env.LOAD_USERS ?? 601)
const activityCount = Number(process.env.LOAD_ACTIVITIES ?? 12)
const capacity = Number(process.env.LOAD_CAPACITY ?? 40)
const apiBase = process.env.LOAD_API_BASE ?? 'http://localhost:4001'

async function ensureDatabase() {
  const parsed = new URL(url)
  const dbName = parsed.pathname.slice(1)
  if (!dbName.endsWith('_load')) throw new Error(`Refusing to seed "${dbName}": the load database must end with _load so this never touches dev data`)
  parsed.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: parsed.toString() })
  await admin.connect()
  try {
    // Drop and recreate rather than `migrate reset`, which would also run the sample seed into this database.
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
    await admin.query(`CREATE DATABASE "${dbName}"`)
  } finally {
    await admin.end()
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } })
}

async function main() {
  await ensureDatabase()
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) })
  try {
    const hostId = randomUUID()
    const users = Array.from({ length: userCount }, (_, i) => ({ id: randomUUID(), displayName: `Load user ${i + 1}`, generation: 0 }))
    await prisma.user.createMany({ data: [{ id: hostId, displayName: 'Load host', generation: 0 }, ...users] })

    const startsAt = new Date(Date.now() + 7 * 24 * 3_600_000)
    const activities = Array.from({ length: activityCount }, (_, i) => {
      const id = randomUUID()
      return {
        id, hostId, title: `Load activity ${i + 1}`, description: 'Exists only to be booked by k6.', category: 'other' as const, illustration: 'other' as const,
        location: 'Nowhere in particular', startsAt, timezone: 'Africa/Lagos', priceMinor: 0, currency: 'USD', capacity, spotsTaken: 0, version: 1, flagBucket: activityBucket(id),
      }
    })
    await prisma.activity.createMany({ data: activities })

    const here = dirname(fileURLToPath(import.meta.url))
    const out = resolve(here, '../../load-test/fixture.json')
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify({ apiBase, capacity, activities: activities.map((a) => a.id), users: users.map((u) => u.id) }, null, 2))
    console.log(`${url}\n${users.length} bookers, ${activities.length} activities with ${capacity} spots each (${activities.length * capacity} spots)\nfixture: ${out}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
