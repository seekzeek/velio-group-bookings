import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { api, createActivity, createUser, resetDb } from './helpers.js'

let host: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let femi: Awaited<ReturnType<typeof createUser>>

const book = (activityId: string, userId: string, idempotencyKey = randomUUID()) =>
  api.post(`/activities/${activityId}/bookings`).set('x-user-id', userId).send({ idempotencyKey, platform: 'web' })

beforeAll(async () => {
  await resetDb()
  host = await createUser('Kemi')
  ada = await createUser('Ada')
  femi = await createUser('Femi')
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /activities/:id/bookings', () => {
  it('books one spot and starts a plan owned by the booker', async () => {
    const activity = await createActivity(host.id, { capacity: 3 })
    const res = await book(activity.id, ada.id)
    expect(res.status).toBe(201)
    expect(res.body.replayed).toBe(false)
    expect(res.body.booking.status).toBe('confirmed')
    expect(res.body.plan.owner.id).toBe(ada.id)
    expect(res.body.plan.members).toEqual([expect.objectContaining({ userId: ada.id, role: 'owner', joinedVia: 'direct' })])
    expect(res.body.activity).toMatchObject({ spotsTaken: 1, spotsLeft: 2, version: 2, viewer: { planRole: 'owner', joinedVia: 'direct' } })
  })

  it('replays the same idempotency key instead of booking twice', async () => {
    const activity = await createActivity(host.id, { capacity: 3 })
    const key = randomUUID()
    const first = await book(activity.id, ada.id, key)
    const second = await book(activity.id, ada.id, key)
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.replayed).toBe(true)
    expect(second.body.booking.id).toBe(first.body.booking.id)
    expect(await prisma.booking.count({ where: { activityId: activity.id } })).toBe(1)
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } })).spotsTaken).toBe(1)
  })

  it('gives every racing retry with the same key the same booking', async () => {
    const activity = await createActivity(host.id, { capacity: 3 })
    const key = randomUUID()
    const responses = await Promise.all(Array.from({ length: 6 }, () => book(activity.id, ada.id, key)))
    const ids = new Set(responses.map((r) => r.body.booking.id))
    expect(ids.size).toBe(1)
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1)
    expect(responses.filter((r) => r.status === 200)).toHaveLength(5)
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } })).spotsTaken).toBe(1)
  })

  it('refuses a second spot for the same person with a different key', async () => {
    const activity = await createActivity(host.id, { capacity: 3 })
    const first = await book(activity.id, ada.id)
    const again = await book(activity.id, ada.id)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_BOOKED')
    expect(again.body.error.details.planId).toBe(first.body.plan.id)
  })

  it('refuses once the activity started, and when sold out points at the host', async () => {
    const started = await createActivity(host.id, { startsAt: new Date(Date.now() - 60_000) })
    const res = await book(started.id, ada.id)
    expect(res.status).toBe(410)
    expect(res.body.error.code).toBe('ACTIVITY_STARTED')

    const tiny = await createActivity(host.id, { capacity: 1 })
    expect((await book(tiny.id, ada.id)).status).toBe(201)
    const full = await book(tiny.id, femi.id)
    expect(full.status).toBe(409)
    expect(full.body.error).toMatchObject({ code: 'SOLD_OUT', details: { spotsLeft: 0, hostId: host.id } })
  })

  it('validates the body and the identity', async () => {
    const activity = await createActivity(host.id)
    expect((await api.post(`/activities/${activity.id}/bookings`).send({ idempotencyKey: randomUUID() })).status).toBe(401)
    const bad = await api.post(`/activities/${activity.id}/bookings`).set('x-user-id', ada.id).send({})
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('VALIDATION')
    expect(bad.body.error.details.fields.idempotencyKey).toBeDefined()
  })
})

describe('POST /bookings/:id/cancel', () => {
  it('gives the spot back, is idempotent, and lets the person book again', async () => {
    const activity = await createActivity(host.id, { capacity: 2 })
    const booked = await book(activity.id, ada.id)
    const bookingId = booked.body.booking.id

    const cancelled = await api.post(`/bookings/${bookingId}/cancel`).set('x-user-id', ada.id)
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.booking.status).toBe('cancelled')
    expect(cancelled.body.booking.cancelledAt).toBeTruthy()
    expect(cancelled.body.activity).toMatchObject({ spotsTaken: 0, spotsLeft: 2, version: 3 })

    const again = await api.post(`/bookings/${bookingId}/cancel`).set('x-user-id', ada.id)
    expect(again.status).toBe(200)
    expect(again.body.activity.version).toBe(3)

    const rebooked = await book(activity.id, ada.id)
    expect(rebooked.status).toBe(201)
    expect(rebooked.body.activity.spotsTaken).toBe(1)
    const rows = await prisma.booking.findMany({ where: { activityId: activity.id, userId: ada.id }, orderBy: { createdAt: 'asc' } })
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'confirmed'])
    const members = (await api.get(`/activities/${activity.id}`).set('x-user-id', ada.id)).body.activity
    expect(members.viewer.bookingId).toBe(rebooked.body.booking.id)
  })

  it('only the owner can cancel, and unknown ids 404', async () => {
    const activity = await createActivity(host.id)
    const booked = await book(activity.id, ada.id)
    const other = await api.post(`/bookings/${booked.body.booking.id}/cancel`).set('x-user-id', femi.id)
    expect(other.status).toBe(403)
    expect((await api.post(`/bookings/${randomUUID()}/cancel`).set('x-user-id', femi.id)).status).toBe(404)
  })
})

describe('GET /metrics', () => {
  it('exposes booking counters in prometheus format', async () => {
    const res = await api.get('/metrics')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.text).toContain('velio_booking_attempts_total')
    expect(res.text).toContain('velio_booking_rejections_total')
  })
})
