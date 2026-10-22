import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { localToUtc } from '../src/lib/time.js'
import { api, bookDirectly, createActivity, createInvite, createUser, futureLocal, resetDb } from './helpers.js'

let kemi: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let femi: Awaited<ReturnType<typeof createUser>>
let kayak: Awaited<ReturnType<typeof createActivity>>
let streetFood: Awaited<ReturnType<typeof createActivity>>
let pottery: Awaited<ReturnType<typeof createActivity>>
let boardGame: Awaited<ReturnType<typeof createActivity>>
let adaPlanId: string
let femiPlanId: string

const event = (body: Record<string, unknown>) => api.post('/events').send({ platform: 'mobile', ...body })

beforeAll(async () => {
  await resetDb()
  kemi = await createUser('Kemi', { contact: 'kemi@example.com' })
  ada = await createUser('Ada', { contact: 'ada@example.com' })
  femi = await createUser('Femi', { contact: 'femi@example.com' })
  kayak = await createActivity(kemi.id, { title: 'Sunset Kayaking', capacity: 12 })
  streetFood = await createActivity(femi.id, { title: 'Street Food Walk', capacity: 12 })
  pottery = await createActivity(kemi.id, { title: 'Pottery Night', capacity: 1, startsAt: localToUtc(futureLocal(11, '19:00'), 'Africa/Lagos') })
  boardGame = await createActivity(kemi.id, { title: 'Board Game Night', capacity: 8, startsAt: new Date(Date.now() - 14 * 86_400_000) })

  adaPlanId = (await bookDirectly(kayak.id, ada.id, new Date(Date.now() - 10 * 86_400_000))).plan.id
  femiPlanId = (await bookDirectly(streetFood.id, femi.id, new Date(Date.now() - 8 * 86_400_000))).plan.id
  await bookDirectly(pottery.id, ada.id)
  await bookDirectly(boardGame.id, ada.id, new Date(Date.now() - 20 * 86_400_000))

  await createInvite({ code: 'BQ7N4XKD', rail: 'vouch', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, recipientContact: 'tunde@example.com', recipientLabel: 'Tunde', expiresAt: kayak.startsAt })
  await event({ name: 'invite_opened', anonId: 'anon-tunde-0001', inviteCode: 'BQ7N4XKD', props: { spotsLeftAtOpen: 11 } })
  await api.post('/invites/BQ7N4XKD/claim').send({ idempotencyKey: randomUUID(), displayName: 'Tunde', contact: 'tunde@example.com', anonId: 'anon-tunde-0001' })
  await createInvite({ code: 'AX7K29QM', rail: 'vouch', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, recipientContact: 'dami@example.com', recipientLabel: 'Dami', expiresAt: kayak.startsAt })
  await event({ name: 'invite_opened', anonId: 'anon-dami-00001', inviteCode: 'AX7K29QM', props: { spotsLeftAtOpen: 10 } })
  await createInvite({ code: 'BG5K2YNP', rail: 'vouch', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, recipientContact: 'bola@example.com', recipientLabel: 'Bola', expiresAt: kayak.startsAt })
  await createInvite({ code: 'M2QW7HTA', rail: 'public', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, recipientLabel: 'Group chat link', expiresAt: kayak.startsAt })
  for (let i = 0; i < 3; i++) await event({ name: 'invite_opened', anonId: `anon-groupchat-${i}`, inviteCode: 'M2QW7HTA', props: { spotsLeftAtOpen: 9 } })
  await createInvite({ code: 'SY8H4QMD', rail: 'vouch', inviterId: ada.id, activityId: pottery.id, planId: null, recipientContact: 'seyi@example.com', recipientLabel: 'Seyi', expiresAt: pottery.startsAt })
  await event({ name: 'invite_opened', anonId: 'anon-seyi-00001', inviteCode: 'SY8H4QMD', props: { spotsLeftAtOpen: 0 } })
  await createInvite({ code: 'QR4T82NP', rail: 'vouch', inviterId: ada.id, activityId: boardGame.id, planId: null, recipientContact: 'kola@example.com', recipientLabel: 'Kola', expiresAt: boardGame.startsAt, createdAt: new Date(Date.now() - 21 * 86_400_000) })

  await createInvite({ code: 'SF7W2MDK', rail: 'public', inviterId: femi.id, activityId: streetFood.id, planId: femiPlanId, expiresAt: streetFood.startsAt })
  await api.post('/invites/SF7W2MDK/claim').set('x-user-id', ada.id).send({ idempotencyKey: randomUUID() })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /me/plans', () => {
  it('splits going from hosting and shows members, roles and unclaimed vouches', async () => {
    const res = await api.get('/me/plans').set('x-user-id', ada.id)
    expect(res.status).toBe(200)
    expect(res.body.going.map((g: { activity: { title: string }; viewerRole: string; viewerJoinedVia: string; pendingVouches: number }) => [g.activity.title, g.viewerRole, g.viewerJoinedVia, g.pendingVouches]).sort()).toEqual(
      [['Pottery Night', 'owner', 'direct', 0], ['Street Food Walk', 'member', 'public', 0], ['Sunset Kayaking', 'owner', 'direct', 2]].sort(),
    )
    const kayakEntry = res.body.going.find((g: { activity: { id: string } }) => g.activity.id === kayak.id)
    expect(kayakEntry.plan.members.map((m: { displayName: string; joinedVia: string }) => [m.displayName, m.joinedVia])).toEqual([['Ada', 'direct'], ['Tunde', 'vouch']])
    expect(kayakEntry.activity.spotsLeft).toBe(10)
    expect(res.body.hosting).toEqual([])
    expect(res.body.past).toEqual([])

    const withPast = await api.get('/me/plans?includePast=true').set('x-user-id', ada.id)
    expect(withPast.body.past.map((p: { activity: { title: string } }) => p.activity.title)).toEqual(['Board Game Night'])

    const host = await api.get('/me/plans').set('x-user-id', kemi.id)
    expect(host.body.hosting.map((h: { activity: { title: string }; attendance: { plansCount: number; viaInvites: { vouch: number } } }) => [h.activity.title, h.attendance.plansCount, h.attendance.viaInvites.vouch])).toEqual([['Sunset Kayaking', 1, 1], ['Pottery Night', 1, 0]])
    expect(host.body.hosting[0].attendance.groupsOfTwoOrMore).toBe(1)
  })
})

describe('GET /plans/:id', () => {
  it('is readable by members and the host, nobody else', async () => {
    const asMember = await api.get(`/plans/${adaPlanId}`).set('x-user-id', ada.id)
    expect(asMember.status).toBe(200)
    expect(asMember.body.plan.membersCount).toBe(2)
    expect(asMember.body.activity.id).toBe(kayak.id)
    expect((await api.get(`/plans/${adaPlanId}`).set('x-user-id', kemi.id)).status).toBe(200)
    expect((await api.get(`/plans/${adaPlanId}`).set('x-user-id', femi.id)).status).toBe(403)
    expect((await api.get(`/plans/${randomUUID()}`).set('x-user-id', femi.id)).status).toBe(404)
  })
})

describe('GET /me/invites', () => {
  it('returns every invite with its status, grouped by activity, with the summary counts', async () => {
    const res = await api.get('/me/invites').set('x-user-id', ada.id)
    expect(res.status).toBe(200)
    expect(res.body.summary).toEqual({ sent: 6, vouches: 5, links: 1, joined: 1, joinedNew: 1, waiting: 2, missed: 2 })
    expect(res.body.activities.map((g: { activity: { title: string } }) => g.activity.title)).toEqual(['Sunset Kayaking', 'Pottery Night', 'Board Game Night'])

    const kayakGroup = res.body.activities[0]
    expect(kayakGroup.planId).toBe(adaPlanId)
    expect(kayakGroup.viewerGroupSize).toBe(2)
    const byLabel = Object.fromEntries(kayakGroup.invites.map((i: { recipientLabel: string }) => [i.recipientLabel, i]))
    expect(byLabel.Tunde).toMatchObject({ rail: 'vouch', status: 'joined', joinedCount: 1, invitee: { displayName: 'Tunde', wasNew: true } })
    expect(byLabel.Dami).toMatchObject({ status: 'opened', opensCount: 1, lastOpenSpotsLeft: 10 })
    expect(byLabel.Bola).toMatchObject({ status: 'not_opened', opensCount: 0 })
    expect(byLabel['Group chat link']).toMatchObject({ rail: 'public', status: 'active', opensCount: 3, joinedCount: 0 })
    expect(res.body.activities[1].invites[0]).toMatchObject({ recipientLabel: 'Seyi', status: 'opened_when_full' })
    expect(res.body.activities[2].invites[0]).toMatchObject({ recipientLabel: 'Kola', status: 'expired', opensCount: 0 })
    expect(JSON.stringify(res.body)).not.toContain('example.com')
  })

  it('narrows to one activity and shows a joiner on a public link', async () => {
    const res = await api.get(`/me/invites?activityId=${streetFood.id}`).set('x-user-id', femi.id)
    expect(res.body.summary).toMatchObject({ sent: 1, links: 1, joined: 1, joinedNew: 0 })
    expect(res.body.activities[0].invites[0]).toMatchObject({ rail: 'public', joinedCount: 1, status: 'active' })
    expect((await api.get('/me/invites')).status).toBe(401)
  })
})
