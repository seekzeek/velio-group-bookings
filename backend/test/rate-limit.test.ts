import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { ensureConnected, redis } from '../src/lib/redis.js'
import { bookDirectly, createActivity, createInvite, createUser, resetDb } from './helpers.js'

let server: Server
let app: ReturnType<typeof createApp>
let code: string

async function clearLimits() {
  await ensureConnected(redis)
  const keys = await redis.keys('rl:*')
  if (keys.length) await redis.del(...keys)
}

beforeAll(async () => {
  await resetDb()
  await clearLimits()
  const kemi = await createUser('Kemi')
  const ada = await createUser('Ada')
  const activity = await createActivity(kemi.id)
  const { plan } = await bookDirectly(activity.id, ada.id)
  code = (await createInvite({ code: 'RATEKQWX', rail: 'public', inviterId: ada.id, activityId: activity.id, planId: plan.id, expiresAt: activity.startsAt })).code
  app = createApp({ rateLimits: { enabled: true, claimPerIp: 3, claimPerCode: 2, lookupPerIp: 4, generalPerIp: 1000, windowMs: 60_000 } })
  server = app.listen(0)
})

afterAll(async () => {
  await app?.locals.live.close()
  server?.close()
  await clearLimits()
  await prisma.$disconnect()
})

describe('rate limits', () => {
  it('limits claims per code before per IP, with a Retry-After', async () => {
    const attempt = () => supertest(server).post(`/invites/${code}/claim`).send({ idempotencyKey: randomUUID(), displayName: 'X', contact: `${randomUUID()}@example.com` })
    const first = await attempt()
    const second = await attempt()
    const third = await attempt()
    expect([first.status, second.status]).toEqual([201, 201])
    expect(third.status).toBe(429)
    expect(third.body.error.code).toBe('RATE_LIMITED')
    expect(third.headers['retry-after']).toBeDefined()
    expect(third.body.error.details.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('limits invite lookups per IP', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) statuses.push((await supertest(server).get(`/invites/${code}`)).status)
    expect(statuses).toEqual([200, 200, 200, 200, 429])
  })
})
