import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { config } from '../src/config.js'
import { prisma } from '../src/db.js'
import { createActivity, createUser, resetDb } from './helpers.js'
import { reserveSpotNaive } from './naive-reserve.js'

const REQUESTS = 50
const CAPACITY = 5
const ROUNDS = 20

let host: Awaited<ReturnType<typeof createUser>>
let users: Awaited<ReturnType<typeof createUser>>[]
let server: Server
let naiveServer: Server

async function raceForSpots(target: Server, activityId: string) {
  const responses = await Promise.all(
    users.map((u) =>
      supertest(target).post(`/activities/${activityId}/bookings`).set('x-user-id', u.id).send({ idempotencyKey: randomUUID(), platform: 'web' }),
    ),
  )
  const statuses = responses.map((r) => r.status)
  const codes = responses.filter((r) => r.status >= 400).map((r) => r.body?.error?.code)
  const activity = await prisma.activity.findUniqueOrThrow({ where: { id: activityId } })
  const confirmed = await prisma.booking.count({ where: { activityId, status: 'confirmed' } })
  const plans = await prisma.plan.count({ where: { activityId } })
  return { statuses, codes, activity, confirmed, plans, responses }
}

beforeAll(async () => {
  expect(config.PG_POOL_MAX).toBeGreaterThanOrEqual(REQUESTS)
  await resetDb()
  host = await createUser('Kemi')
  users = await Promise.all(Array.from({ length: REQUESTS }, (_, i) => createUser(`Booker ${i + 1}`)))
  server = createApp().listen(0)
  naiveServer = createApp({ booking: { reserve: reserveSpotNaive } }).listen(0)
})

afterAll(async () => {
  server.close()
  naiveServer.close()
  await prisma.$disconnect()
})

describe(`${REQUESTS} parallel requests for ${CAPACITY} spots, ${ROUNDS} rounds`, () => {
  it('books exactly the capacity, rejects the rest with 409, never 500s, and the count matches the rows', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const activity = await createActivity(host.id, { title: `Round ${round}`, capacity: CAPACITY })
      const result = await raceForSpots(server, activity.id)
      const created = result.statuses.filter((s) => s === 201).length
      const soldOut = result.codes.filter((c) => c === 'SOLD_OUT').length
      const serverErrors = result.statuses.filter((s) => s >= 500).length
      expect({ round, created, soldOut, serverErrors }).toEqual({ round, created: CAPACITY, soldOut: REQUESTS - CAPACITY, serverErrors: 0 })
      expect(result.statuses.filter((s) => s === 409).length).toBe(REQUESTS - CAPACITY)
      expect(result.activity.spotsTaken).toBe(CAPACITY)
      expect(result.confirmed).toBe(CAPACITY)
      expect(result.plans).toBe(CAPACITY)
      expect(result.activity.version).toBe(1 + CAPACITY)
      const winners = result.responses.filter((r) => r.status === 201)
      for (const w of winners) {
        expect(w.body.activity.capacity).toBe(CAPACITY)
        expect(w.body.plan.members).toHaveLength(1)
      }
      for (const w of winners) expect(w.body.activity.spotsTaken).toBeGreaterThanOrEqual(1)
      for (const w of winners) expect(w.body.activity.spotsTaken).toBeLessThanOrEqual(CAPACITY)
    }
  })

  it('writes a rejected event for every sold-out answer and a success for every booking', async () => {
    const activity = await createActivity(host.id, { title: 'Events round', capacity: CAPACITY })
    await raceForSpots(server, activity.id)
    const names = await prisma.event.groupBy({ by: ['name'], where: { activityId: activity.id }, _count: true })
    const counts = Object.fromEntries(names.map((n) => [n.name, n._count]))
    expect(counts).toEqual({ booking_attempted: REQUESTS, booking_succeeded: CAPACITY, booking_rejected: REQUESTS - CAPACITY })
  })

  it('direct bookings and invite claims racing for the same last spots never oversell', async () => {
    const activity = await createActivity(host.id, { title: 'Mixed', capacity: CAPACITY })
    const link = await prisma.invite.create({
      data: { code: 'MXRACE2K', rail: 'public', inviterId: host.id, activityId: activity.id, planId: null, expiresAt: activity.startsAt },
    })
    const direct = users.slice(0, 25).map((u) =>
      supertest(server).post(`/activities/${activity.id}/bookings`).set('x-user-id', u.id).send({ idempotencyKey: randomUUID() }),
    )
    const claims = Array.from({ length: 25 }, (_, i) =>
      supertest(server).post(`/invites/${link.code}/claim`).send({ idempotencyKey: randomUUID(), displayName: `Guest ${i}`, contact: `guest${i}@example.com` }),
    )
    const responses = await Promise.all([...direct, ...claims])
    const created = responses.filter((r) => r.status === 201)
    const soldOut = responses.filter((r) => r.body?.error?.code === 'SOLD_OUT')
    expect(created).toHaveLength(CAPACITY)
    expect(soldOut).toHaveLength(REQUESTS - CAPACITY)
    expect(responses.some((r) => r.status >= 500)).toBe(false)
    const row = await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } })
    const confirmed = await prisma.booking.count({ where: { activityId: activity.id, status: 'confirmed' } })
    const attributions = await prisma.attribution.count({ where: { inviteId: link.id } })
    const claimedOk = created.filter((r) => r.body.isNewUser !== undefined).length
    expect(row.spotsTaken).toBe(CAPACITY)
    expect(confirmed).toBe(CAPACITY)
    expect(attributions).toBe(claimedOk)
    expect(await prisma.user.count({ where: { displayName: { startsWith: 'Guest ' } } })).toBe(claimedOk)
  })

  it('catches a read-then-write implementation overselling', async () => {
    const activity = await createActivity(host.id, { title: 'Naive', capacity: CAPACITY })
    const result = await raceForSpots(naiveServer, activity.id)
    const created = result.statuses.filter((s) => s === 201).length
    const oversold = result.confirmed > CAPACITY || result.confirmed !== result.activity.spotsTaken
    expect(created).toBeGreaterThan(CAPACITY)
    expect(oversold).toBe(true)
  })
})
