import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { activityBucket } from '../src/modules/flags/flags.js'
import { api, createInvite, createUser, futureLocal, resetDb } from './helpers.js'

let kemi: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let tunde: Awaited<ReturnType<typeof createUser>>

const body = {
  title: 'Sunset Kayaking',
  description: 'Two hours on calm water.',
  category: 'outdoors',
  location: 'Harbour jetty, pier 3',
  startsAtLocal: futureLocal(10, '17:30'),
  timezone: 'Africa/Lagos',
  price: { amountMinor: 4500, currency: 'usd' },
  capacity: 12,
}

beforeAll(async () => {
  await resetDb()
  kemi = await createUser('Kemi')
  ada = await createUser('Ada', { contact: 'ada@example.com' })
  tunde = await createUser('Tunde', { contact: 'tunde@example.com' })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST and PATCH /activities', () => {
  it('creates an activity in the venue\'s time zone with a picked illustration and flag bucket', async () => {
    const res = await api.post('/activities').set('x-user-id', kemi.id).send(body)
    expect(res.status).toBe(201)
    const a = res.body.activity
    expect(a).toMatchObject({ title: 'Sunset Kayaking', category: 'outdoors', capacity: 12, spotsTaken: 0, spotsLeft: 12, status: 'open', price: { amountMinor: 4500, currency: 'USD' }, host: { id: kemi.id } })
    expect(['kayak', 'hike']).toContain(a.illustration)
    expect(a.startsAt).toBe(`${body.startsAtLocal.slice(0, 10)}T16:30:00.000Z`)
    const row = await prisma.activity.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.flagBucket).toBe(activityBucket(a.id))
    expect(typeof a.invitesEnabled).toBe('boolean')
  })

  it('rejects bad input with field messages', async () => {
    const past = await api.post('/activities').set('x-user-id', kemi.id).send({ ...body, startsAtLocal: '2020-01-01T10:00' })
    expect(past.body.error.details.fields.startsAtLocal).toMatch(/future/)
    const tz = await api.post('/activities').set('x-user-id', kemi.id).send({ ...body, timezone: 'Mars/Olympus' })
    expect(tz.body.error.details.fields.timezone).toBeDefined()
    const cap = await api.post('/activities').set('x-user-id', kemi.id).send({ ...body, capacity: 0 })
    expect(cap.body.error.details.fields.capacity).toBeDefined()
    expect((await api.post('/activities').send(body)).status).toBe(401)
  })

  it('lets only the host edit, and never below the people already booked', async () => {
    const created = (await api.post('/activities').set('x-user-id', kemi.id).send({ ...body, capacity: 3 })).body.activity
    await api.post(`/activities/${created.id}/bookings`).set('x-user-id', ada.id).send({ idempotencyKey: randomUUID() })
    await api.post(`/activities/${created.id}/bookings`).set('x-user-id', tunde.id).send({ idempotencyKey: randomUUID() })

    expect((await api.patch(`/activities/${created.id}`).set('x-user-id', ada.id).send({ title: 'Mine now' })).status).toBe(403)
    const shrink = await api.patch(`/activities/${created.id}`).set('x-user-id', kemi.id).send({ capacity: 1 })
    expect(shrink.status).toBe(400)
    expect(shrink.body.error.details.fields.capacity).toMatch(/2 people/)
    const grow = await api.patch(`/activities/${created.id}`).set('x-user-id', kemi.id).send({ capacity: 2, title: 'Sunset Kayaking, small boat', category: 'classes' })
    expect(grow.status).toBe(200)
    expect(grow.body.activity).toMatchObject({ capacity: 2, spotsLeft: 0, status: 'full', title: 'Sunset Kayaking, small boat', illustration: 'pottery' })
  })
})

// Ids are random, so one in ten created activities lands in the holdout. Attendance needs one where invites are on.
async function createWithInvites() {
  for (let i = 0; i < 20; i++) {
    const created = (await api.post('/activities').set('x-user-id', kemi.id).send(body)).body.activity
    if (created.invitesEnabled) return created
  }
  throw new Error('No activity outside the holdout after 20 tries')
}

describe('GET /activities/:id/attendance', () => {
  it('groups people by plan with how each arrived, host only', async () => {
    const created = await createWithInvites()
    const adaBooking = (await api.post(`/activities/${created.id}/bookings`).set('x-user-id', ada.id).send({ idempotencyKey: randomUUID() })).body
    await createInvite({ code: 'ATTNDVCH', rail: 'vouch', inviterId: ada.id, activityId: created.id, planId: adaBooking.plan.id, recipientContact: 'chioma@example.com', expiresAt: new Date(created.startsAt) })
    expect((await api.post('/invites/ATTNDVCH/claim').send({ idempotencyKey: randomUUID(), displayName: 'Chioma', contact: 'chioma@example.com' })).status).toBe(201)
    await createInvite({ code: 'ATTNDHST', rail: 'vouch', inviterId: kemi.id, activityId: created.id, planId: null, recipientContact: 'ife@example.com', expiresAt: new Date(created.startsAt) })
    expect((await api.post('/invites/ATTNDHST/claim').send({ idempotencyKey: randomUUID(), displayName: 'Ife', contact: 'ife@example.com' })).status).toBe(201)
    await api.post(`/activities/${created.id}/bookings`).set('x-user-id', tunde.id).send({ idempotencyKey: randomUUID() })

    expect((await api.get(`/activities/${created.id}/attendance`).set('x-user-id', ada.id)).status).toBe(403)
    const res = await api.get(`/activities/${created.id}/attendance`).set('x-user-id', kemi.id)
    expect(res.status).toBe(200)
    expect(res.body.totals).toMatchObject({ booked: 4, capacity: 12, spotsLeft: 8, plansCount: 3, groupsOfTwoOrMore: 1, viaInvites: { total: 2, vouch: 2, public: 0 } })
    expect(res.body.plans.map((p: { membersCount: number; owner: { displayName: string } }) => [p.owner.displayName, p.membersCount])).toEqual([['Ada', 2], ['Ife', 1], ['Tunde', 1]])
    const adas = res.body.plans[0]
    expect(adas.members.map((m: { displayName: string; joinedVia: string; invitedBy: { displayName: string } | null }) => [m.displayName, m.joinedVia, m.invitedBy?.displayName ?? null])).toEqual([['Ada', 'direct', null], ['Chioma', 'vouch', 'Ada']])
    expect(adas.latestJoinAt).toBe(adas.members[1].joinedAt)
    expect(res.body.plans[1].members[0]).toMatchObject({ displayName: 'Ife', joinedVia: 'vouch', invitedBy: { id: kemi.id } })
  })
})

describe('POST /activities/:id/watch', () => {
  it('records a watch once per viewer and never stores the raw contact', async () => {
    const created = (await api.post('/activities').set('x-user-id', kemi.id).send(body)).body.activity
    const first = await api.post(`/activities/${created.id}/watch`).send({ anonId: 'anon-watch-0001', contact: 'dami@example.com', platform: 'mobile' })
    expect(first.status).toBe(201)
    expect(first.body).toEqual({ watching: true })
    const again = await api.post(`/activities/${created.id}/watch`).send({ anonId: 'anon-watch-0001' })
    expect(again.status).toBe(200)
    const asUser = await api.post(`/activities/${created.id}/watch`).set('x-user-id', ada.id).send({})
    expect(asUser.status).toBe(201)
    const rows = await prisma.spotWatch.findMany({ where: { activityId: created.id } })
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.anonId)?.contactHmac).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(rows)).not.toContain('dami@')
    expect((await api.post(`/activities/${created.id}/watch`).send({})).status).toBe(400)
    expect((await api.post(`/activities/${randomUUID()}/watch`).send({ anonId: 'anon-watch-0002' })).status).toBe(404)
  })
})
