import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { localToUtc } from '../src/lib/time.js'
import { api, bookDirectly, createActivity, createInvite, createUser, futureLocal, resetDb } from './helpers.js'

let kemi: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let tunde: Awaited<ReturnType<typeof createUser>>
let kayak: Awaited<ReturnType<typeof createActivity>>
let holdout: Awaited<ReturnType<typeof createActivity>>
let past: Awaited<ReturnType<typeof createActivity>>
let adaPlanId: string

beforeAll(async () => {
  await resetDb()
  kemi = await createUser('Kemi', { contact: 'kemi@example.com' })
  ada = await createUser('Ada', { contact: 'ada@example.com' })
  tunde = await createUser('Tunde', { contact: 'tunde@example.com', generation: 1 })
  kayak = await createActivity(kemi.id, { title: 'Sunset Kayaking', capacity: 12 })
  holdout = await createActivity(kemi.id, { title: 'Sunrise Hike', capacity: 15, holdout: true })
  past = await createActivity(kemi.id, { title: 'Board Game Night', capacity: 8, startsAt: new Date(Date.now() - 86_400_000) })
  const booked = await bookDirectly(kayak.id, ada.id, new Date(Date.now() - 60_000))
  adaPlanId = booked.plan.id
  await bookDirectly(kayak.id, kemi.id)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /health', () => {
  it('reports postgres and redis', async () => {
    const res = await api.get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, postgres: 'up', redis: 'up' })
  })
})

describe('GET /users and GET /me', () => {
  it('lists hosts first for the picker', async () => {
    const res = await api.get('/users')
    expect(res.status).toBe(200)
    expect(res.body.users[0]).toMatchObject({ displayName: 'Kemi', isHost: true, role: 'host' })
    expect(res.body.users[0].hosting).toBeGreaterThan(0)
    expect(res.body.users.map((u: { displayName: string; role: string }) => `${u.displayName}:${u.role}`)).toEqual(['Kemi:host', 'Ada:booker', 'Tunde:guest'])
  })

  it('needs a known x-user-id', async () => {
    expect((await api.get('/me')).status).toBe(401)
    expect((await api.get('/me').set('x-user-id', 'not-a-uuid')).body.error.code).toBe('UNAUTHENTICATED')
    expect((await api.get('/me').set('x-user-id', '00000000-0000-4000-8000-000000000000')).status).toBe(401)
    const res = await api.get('/me').set('x-user-id', ada.id)
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: ada.id, displayName: 'Ada', generation: 0, remindDayBefore: true, friendUpdates: false, hasContact: true })
  })

  it('updates preferences', async () => {
    const res = await api.patch('/me/preferences').set('x-user-id', tunde.id).send({ friendUpdates: true })
    expect(res.status).toBe(200)
    expect(res.body.user.friendUpdates).toBe(true)
    expect((await api.patch('/me/preferences').set('x-user-id', tunde.id).send({ friendUpdates: 'yes' })).body.error.code).toBe('VALIDATION')
  })
})

describe('GET /activities', () => {
  it('returns upcoming activities with derived counts and the flag', async () => {
    const res = await api.get('/activities')
    expect(res.status).toBe(200)
    const titles = res.body.activities.map((a: { title: string }) => a.title)
    expect(titles).toContain('Sunset Kayaking')
    expect(titles).not.toContain('Board Game Night')
    const k = res.body.activities.find((a: { id: string }) => a.id === kayak.id)
    expect(k).toMatchObject({ capacity: 12, spotsTaken: 2, spotsLeft: 10, status: 'open', plansCount: 2, invitesEnabled: true, viewer: null })
    expect(k.host).toEqual({ id: kemi.id, displayName: 'Kemi' })
    expect(k.price).toEqual({ amountMinor: 4500, currency: 'USD' })
    const h = res.body.activities.find((a: { id: string }) => a.id === holdout.id)
    expect(h.invitesEnabled).toBe(false)
  })

  it('includes past activities on request and filters by host, spots and category', async () => {
    const all = await api.get('/activities?includePast=true')
    expect(all.body.activities.map((a: { title: string }) => a.title)).toContain('Board Game Night')
    const byHost = await api.get(`/activities?hostId=${kemi.id}&excludeId=${kayak.id}`)
    expect(byHost.body.activities.map((a: { id: string }) => a.id)).not.toContain(kayak.id)
    const roomy = await api.get('/activities?minSpotsLeft=11')
    expect(roomy.body.activities.map((a: { id: string }) => a.id)).toEqual([holdout.id])
    expect((await api.get('/activities?category=nope')).body.error.code).toBe('VALIDATION')
  })

  it('fills viewer for someone who booked', async () => {
    const res = await api.get('/activities').set('x-user-id', ada.id)
    const k = res.body.activities.find((a: { id: string }) => a.id === kayak.id)
    expect(k.viewer).toMatchObject({ planId: adaPlanId, planRole: 'owner', joinedVia: 'direct' })
  })
})

describe('GET /activities/:id', () => {
  it('returns one activity and writes a single exposure per viewer', async () => {
    const res = await api.get(`/activities/${kayak.id}`).set('x-user-id', ada.id)
    expect(res.status).toBe(200)
    expect(res.body.activity.id).toBe(kayak.id)
    await api.get(`/activities/${kayak.id}`).set('x-user-id', ada.id)
    await api.get(`/activities/${holdout.id}?anonId=anon-guest-1`)
    await api.get(`/activities/${holdout.id}?anonId=anon-guest-1`)
    const exposures = await prisma.flagExposure.findMany({ orderBy: { createdAt: 'asc' } })
    expect(exposures.map((e) => [e.userId ?? e.anonId, e.variant])).toEqual([[ada.id, 'on'], ['anon-guest-1', 'holdout']])
  })

  it('404s for unknown ids', async () => {
    const res = await api.get('/activities/00000000-0000-4000-8000-000000000000')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /invites/:code', () => {
  it('resolves an open vouch with the plan and never the recipient', async () => {
    await createInvite({ code: 'AX7K29QM', rail: 'vouch', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, recipientContact: 'dami@example.com', recipientLabel: 'Dami', expiresAt: kayak.startsAt })
    const res = await api.get('/invites/ax7k-29qm')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ code: 'AX7K29QM', codeDisplay: 'AX7K-29QM', rail: 'vouch', isHostInvite: false, status: 'open' })
    expect(res.body.inviter).toEqual({ id: ada.id, displayName: 'Ada' })
    expect(res.body.plan.members.map((m: { displayName: string; role: string }) => [m.displayName, m.role])).toEqual([['Ada', 'owner']])
    expect(JSON.stringify(res.body)).not.toContain('dami')
    expect(JSON.stringify(res.body)).not.toContain('Dami')
    expect(res.body.activity.viewer).toBeUndefined()
  })

  it('tells a viewer who is already going', async () => {
    const res = await api.get('/invites/AX7K29QM').set('x-user-id', kemi.id)
    expect(res.body.viewer).toMatchObject({ alreadyInPlan: true })
  })

  it('reports expired, used, revoked and off instead of failing', async () => {
    await createInvite({ code: 'QR4T82NP', rail: 'vouch', inviterId: ada.id, activityId: past.id, planId: null, recipientContact: 'kola@example.com', expiresAt: past.startsAt })
    expect((await api.get('/invites/QR4T82NP')).body.status).toBe('expired')

    const used = await createInvite({ code: 'BQ7N4XKD', rail: 'vouch', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, recipientContact: 'tunde@example.com', expiresAt: kayak.startsAt })
    const tundeBooking = await prisma.booking.create({ data: { activityId: kayak.id, planId: adaPlanId, userId: tunde.id, inviteId: used.id, idempotencyKey: 'fixture-tunde' } })
    await prisma.activity.update({ where: { id: kayak.id }, data: { spotsTaken: { increment: 1 } } })
    await prisma.attribution.create({ data: { inviteId: used.id, rail: 'vouch', code: used.code, inviterId: ada.id, inviteeId: tunde.id, inviteeWasNew: true, hopGeneration: 1, planId: adaPlanId, bookingId: tundeBooking.id } })
    const usedRes = await api.get('/invites/BQ7N4XKD')
    expect(usedRes.body.status).toBe('used')
    expect(usedRes.body.plan.members.map((m: { displayName: string; joinedVia: string }) => [m.displayName, m.joinedVia])).toEqual([['Ada', 'direct'], ['Tunde', 'vouch']])

    const link = await createInvite({ code: 'M2QW7HTA', rail: 'public', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, expiresAt: kayak.startsAt })
    await prisma.inviteRevocation.create({ data: { inviteId: link.id, reason: 'turned_off' } })
    expect((await api.get('/invites/M2QW7HTA')).body.status).toBe('revoked')

    await createInvite({ code: 'H7PD3KXA', rail: 'public', inviterId: kemi.id, activityId: holdout.id, planId: null, expiresAt: holdout.startsAt })
    const off = await api.get('/invites/H7PD3KXA')
    expect(off.body.status).toBe('off')
    expect(off.body.isHostInvite).toBe(true)
    expect(off.body.plan).toBeNull()
  })

  it('404s for unknown or malformed codes', async () => {
    expect((await api.get('/invites/ZZZZZZZZ')).body.error.code).toBe('INVITE_NOT_FOUND')
    expect((await api.get('/invites/short')).status).toBe(404)
    expect((await api.get('/invites/AX7K290M')).status).toBe(404)
  })
})

describe('time', () => {
  it('converts venue local time to an instant', () => {
    expect(localToUtc('2026-11-14T17:30', 'Africa/Lagos').toISOString()).toBe('2026-11-14T16:30:00.000Z')
    expect(localToUtc('2026-07-01T09:00', 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z')
    expect(localToUtc(futureLocal(1, '00:00'), 'UTC').getTime()).toBeGreaterThan(Date.now())
  })
})
