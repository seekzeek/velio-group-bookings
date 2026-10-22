import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { api, createActivity, createUser, resetDb } from './helpers.js'

let kemi: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let femi: Awaited<ReturnType<typeof createUser>>
let kayak: Awaited<ReturnType<typeof createActivity>>

const event = (body: Record<string, unknown>, userId?: string) => {
  const req = api.post('/events').send({ platform: 'mobile', ...body })
  return userId ? req.set('x-user-id', userId) : req
}

beforeAll(async () => {
  await resetDb()
  kemi = await createUser('Kemi', { contact: 'kemi@example.com' })
  ada = await createUser('Ada', { contact: 'ada@example.com' })
  femi = await createUser('Femi', { contact: 'femi@example.com' })
  kayak = await createActivity(kemi.id, { capacity: 5 })
  await createActivity(kemi.id, { title: 'Holdout hike', holdout: true })

  await event({ name: 'activity_viewed', anonId: 'anon-ada-view', activityId: kayak.id }, ada.id)
  await api.post(`/activities/${kayak.id}/bookings`).set('x-user-id', ada.id).send({ idempotencyKey: randomUUID() })
  await api.post(`/activities/${kayak.id}/bookings`).set('x-user-id', femi.id).send({ idempotencyKey: randomUUID() })

  const vouch = (await api.post('/invites').set('x-user-id', ada.id).send({ rail: 'vouch', activityId: kayak.id, recipientContact: 'tunde@example.com', recipientLabel: 'Tunde' })).body.invite
  const link = (await api.post('/invites').set('x-user-id', ada.id).send({ rail: 'public', activityId: kayak.id })).body.invite

  await event({ name: 'invite_opened', anonId: 'anon-tunde-01', inviteCode: vouch.code, props: { spotsLeftAtOpen: 3 } })
  await event({ name: 'claim_started', anonId: 'anon-tunde-01', inviteCode: vouch.code })
  await event({ name: 'claim_submitted', anonId: 'anon-tunde-01', inviteCode: vouch.code })
  await api.post(`/invites/${vouch.code}/claim`).send({ idempotencyKey: randomUUID(), displayName: 'Tunde', contact: 'tunde@example.com', anonId: 'anon-tunde-01', platform: 'mobile' })

  await event({ name: 'invite_opened', anonId: 'anon-bisi-0001', inviteCode: link.code, props: { spotsLeftAtOpen: 2 } })
  await api.post(`/invites/${link.code}/claim`).send({ idempotencyKey: randomUUID(), displayName: 'Bisi', contact: 'bisi@example.com', anonId: 'anon-bisi-0001', platform: 'web' })
  await event({ name: 'invite_opened', anonId: 'anon-late-0001', inviteCode: link.code, props: { spotsLeftAtOpen: 0 }, platform: 'web' })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('tracking views', () => {
  it('bookers_invite_rate counts everyone on treatment activities and who invited within 7 days', async () => {
    const rows = await prisma.$queryRaw<{ bookers: bigint; inviters: bigint; invite_rate: string }[]>`SELECT bookers, inviters, invite_rate::text FROM bookers_invite_rate`
    expect(rows.reduce((n, r) => n + Number(r.bookers), 0)).toBe(4)
    expect(rows.reduce((n, r) => n + Number(r.inviters), 0)).toBe(1)
  })

  it('invite_claim_rate uses unique opens as the denominator, per rail', async () => {
    const rows = await prisma.$queryRaw<{ rail: string; opens: bigint; claims: bigint; opens_on_full: bigint }[]>`SELECT rail, SUM(opens) opens, SUM(claims) claims, SUM(opens_on_full) opens_on_full FROM invite_claim_rate GROUP BY rail ORDER BY rail::text`
    expect(rows.map((r) => [r.rail, Number(r.opens), Number(r.claims), Number(r.opens_on_full)])).toEqual([
      ['public', 2, 1, 1],
      ['vouch', 1, 1, 0],
    ])
  })

  it('invite_funnel shows started, submitted and claimed per open', async () => {
    const rows = await prisma.$queryRaw<{ rail: string; platform: string; guest_kind: string; opened: bigint; started: bigint; submitted: bigint; claimed: bigint }[]>`SELECT * FROM invite_funnel ORDER BY rail, platform, guest_kind`
    const vouch = rows.find((r) => r.rail === 'vouch')!
    expect([Number(vouch.opened), Number(vouch.started), Number(vouch.submitted), Number(vouch.claimed), vouch.guest_kind, vouch.platform]).toEqual([1, 1, 1, 1, 'new', 'mobile'])
  })

  it('k_factor_by_rail credits new users to the inviter cohort', async () => {
    const rows = await prisma.$queryRaw<{ rail: string; bookers: bigint; new_users: bigint }[]>`SELECT rail, SUM(bookers) bookers, SUM(new_users) new_users FROM k_factor_by_rail GROUP BY rail ORDER BY rail::text`
    expect(rows.map((r) => [r.rail, Number(r.new_users)])).toEqual([['public', 1], ['vouch', 1]])
  })

  it('plan_sizes and holdout_summary split groups and variants', async () => {
    const plans = await prisma.$queryRaw<{ members: bigint; is_group: boolean }[]>`SELECT members, is_group FROM plan_sizes WHERE activity_id = ${kayak.id}::uuid ORDER BY members DESC`
    expect(plans.map((p) => [Number(p.members), p.is_group])).toEqual([[3, true], [1, false]])
    const summary = await prisma.$queryRaw<{ variant: string; activities: bigint; avg_attendees: string }[]>`SELECT variant, activities, avg_attendees::text FROM holdout_summary ORDER BY variant`
    expect(summary.map((s) => [s.variant, Number(s.activities), Number(s.avg_attendees)])).toEqual([['holdout', 1, 0], ['treatment', 1, 4]])
  })

  it('oversell_check is empty until a counter drifts', async () => {
    expect(await prisma.$queryRaw`SELECT * FROM oversell_check`).toEqual([])
    await prisma.$executeRaw`UPDATE activities SET spots_taken = 3 WHERE id = ${kayak.id}::uuid`
    const drifted = await prisma.$queryRaw<{ confirmed: bigint; spots_taken: number }[]>`SELECT confirmed, spots_taken FROM oversell_check`
    expect(drifted.map((d) => [Number(d.confirmed), d.spots_taken])).toEqual([[4, 3]])
    await prisma.$executeRaw`UPDATE activities SET spots_taken = 4 WHERE id = ${kayak.id}::uuid`
  })

  it('booking_success_rate leaves correct rejections out of the denominator', async () => {
    const rows = await prisma.$queryRaw<{ attempts: bigint; succeeded: bigint; rejected: bigint; failed: bigint }[]>`SELECT SUM(attempts) attempts, SUM(succeeded) succeeded, SUM(rejected) rejected, SUM(failed) failed FROM booking_success_rate`
    expect(rows.map((r) => [Number(r.attempts), Number(r.succeeded), Number(r.rejected), Number(r.failed)])).toEqual([[4, 4, 0, 0]])
  })

  it('writes a flag_exposed event once per viewer', async () => {
    await api.get(`/activities/${kayak.id}`).set('x-user-id', ada.id)
    await api.get(`/activities/${kayak.id}`).set('x-user-id', ada.id)
    expect(await prisma.event.count({ where: { name: 'flag_exposed', userId: ada.id, activityId: kayak.id } })).toBe(1)
  })
})

describe('GET /admin/health', () => {
  it('reports every goal with status, and no_data below the cohort minimums', async () => {
    const res = await api.get('/admin/health')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('live')
    const byKey = Object.fromEntries(res.body.goals.map((g: { key: string }) => [g.key, g]))
    expect(Object.keys(byKey).sort()).toEqual(['bookers_invite', 'bookings_succeed', 'invites_convert', 'never_oversell', 'updates_live'])
    expect(byKey.never_oversell).toMatchObject({ current: 0, status: 'on_target', targetDisplay: '0, ever' })
    expect(byKey.bookings_succeed).toMatchObject({ current: 1, status: 'no_data', sampleSize: 4, minSample: 500 })
    expect(byKey.bookers_invite).toMatchObject({ current: 0.25, status: 'no_data', sampleSize: 4 })
    expect(byKey.invites_convert.status).toBe('no_data')
    expect(res.body.claimRateByRail).toMatchObject({ vouch: 1, public: 0.5 })
    expect(res.body.opensOnFullShare).toBeCloseTo(1 / 3)
    expect(res.body.holdout).toMatchObject({ holdoutPercent: 10, weeksPlanned: 4, weeksElapsed: 1 })
    expect(res.body.diagnosisQueries).toHaveLength(3)
  })

  it('evaluates triggers when the minimum sample is lowered', async () => {
    const res = await api.get('/admin/health?minSample=0')
    const byKey = Object.fromEntries(res.body.goals.map((g: { key: string }) => [g.key, g]))
    expect(byKey.bookings_succeed.status).toBe('on_target')
    expect(byKey.bookers_invite.status).toBe('trigger_fired')
    expect(byKey.invites_convert.status).toBe('on_target')
    expect(res.body.triggers.map((t: { goalKey: string }) => t.goalKey)).toEqual(['bookers_invite'])
    expect((await api.get('/admin/health?source=scenario')).body.source).toBe('live')
    expect((await api.get('/admin/health?windowDays=0')).status).toBe(400)
  })
})
