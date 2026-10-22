import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { api, bookDirectly, createActivity, createUser, resetDb } from './helpers.js'

let kemi: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let femi: Awaited<ReturnType<typeof createUser>>
let kayak: Awaited<ReturnType<typeof createActivity>>
let adaPlanId: string

const create = (userId: string, body: Record<string, unknown>) => api.post('/invites').set('x-user-id', userId).send(body)

beforeAll(async () => {
  await resetDb()
  kemi = await createUser('Kemi')
  ada = await createUser('Ada')
  femi = await createUser('Femi')
  kayak = await createActivity(kemi.id, { capacity: 12 })
  adaPlanId = (await bookDirectly(kayak.id, ada.id)).plan.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /invites', () => {
  it('creates a vouch on the booker\'s plan with a private label and a hashed recipient', async () => {
    const res = await create(ada.id, { rail: 'vouch', activityId: kayak.id, recipientContact: '(415) 555-0133', recipientLabel: 'Bola' })
    expect(res.status).toBe(201)
    expect(res.body.created).toBe(true)
    expect(res.body.invite).toMatchObject({ rail: 'vouch', planId: adaPlanId, isHostInvite: false, recipientLabel: 'Bola', status: 'not_opened', opensCount: 0, joinedCount: 0 })
    expect(res.body.invite.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
    expect(res.body.invite.url).toBe(`http://localhost:3000/i/${res.body.invite.code}`)
    expect(res.body.invite.expiresAt).toBe(kayak.startsAt.toISOString())
    const row = await prisma.invite.findUniqueOrThrow({ where: { code: res.body.invite.code } })
    expect(row.recipientHmac).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(res.body)).not.toContain('0133')
    const event = await prisma.event.findFirst({ where: { name: 'invite_created', inviteId: row.id } })
    expect(event?.rail).toBe('vouch')
  })

  it('returns the same public link on every call until it is turned off', async () => {
    const first = await create(ada.id, { rail: 'public', activityId: kayak.id })
    const second = await create(ada.id, { rail: 'public', activityId: kayak.id })
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.created).toBe(false)
    expect(second.body.invite.code).toBe(first.body.invite.code)
    expect(first.body.invite.status).toBe('active')

    const revoked = await api.post(`/invites/${first.body.invite.code}/revoke`).set('x-user-id', ada.id).send({})
    expect(revoked.status).toBe(200)
    expect(revoked.body.invite.status).toBe('revoked')
    expect(revoked.body.invite.revokedAt).toBeTruthy()
    const again = await api.post(`/invites/${first.body.invite.code}/revoke`).set('x-user-id', ada.id).send({})
    expect(again.body.invite.revokedAt).toBe(revoked.body.invite.revokedAt)
    expect(await prisma.inviteRevocation.count()).toBe(1)
    expect((await api.get(`/invites/${first.body.invite.code}`)).body.status).toBe('revoked')

    const fresh = await create(ada.id, { rail: 'public', activityId: kayak.id })
    expect(fresh.status).toBe(201)
    expect(fresh.body.invite.code).not.toBe(first.body.invite.code)
  })

  it('lets the host invite without a booking and starts no plan', async () => {
    const res = await create(kemi.id, { rail: 'vouch', activityId: kayak.id, recipientContact: 'ife@example.com' })
    expect(res.status).toBe(201)
    expect(res.body.invite).toMatchObject({ planId: null, isHostInvite: true })
    const lookup = await api.get(`/invites/${res.body.invite.code}`)
    expect(lookup.body).toMatchObject({ isHostInvite: true, plan: null })
  })

  it('refuses people who are not going, bad contacts, and anyone else revoking', async () => {
    expect((await create(femi.id, { rail: 'public', activityId: kayak.id })).body.error.code).toBe('NOT_GOING')
    const bad = await create(ada.id, { rail: 'vouch', activityId: kayak.id, recipientContact: 'nope' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.details.fields.recipientContact).toBeDefined()
    expect((await create(ada.id, { rail: 'vouch', activityId: kayak.id })).body.error.code).toBe('VALIDATION')
    const link = await create(ada.id, { rail: 'public', activityId: kayak.id })
    expect((await api.post(`/invites/${link.body.invite.code}/revoke`).set('x-user-id', femi.id).send({})).status).toBe(403)
    expect((await api.post('/invites').send({ rail: 'public', activityId: kayak.id })).status).toBe(401)
  })

  it('caps vouches per person per activity', async () => {
    const activity = await createActivity(kemi.id, { title: 'Cap' })
    await bookDirectly(activity.id, ada.id)
    for (let i = 0; i < 10; i++) {
      expect((await create(ada.id, { rail: 'vouch', activityId: activity.id, recipientContact: `friend${i}@example.com` })).status).toBe(201)
    }
    const eleventh = await create(ada.id, { rail: 'vouch', activityId: activity.id, recipientContact: 'friend11@example.com' })
    expect(eleventh.status).toBe(409)
    expect(eleventh.body.error.code).toBe('VOUCH_LIMIT')
  })

  it('refuses invites on a holdout activity and on a started one', async () => {
    const holdout = await createActivity(kemi.id, { title: 'Holdout', holdout: true })
    await bookDirectly(holdout.id, ada.id)
    const res = await create(ada.id, { rail: 'public', activityId: holdout.id })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('INVITES_OFF')
    const started = await createActivity(kemi.id, { title: 'Started', startsAt: new Date(Date.now() - 1000) })
    expect((await create(kemi.id, { rail: 'public', activityId: started.id })).body.error.code).toBe('ACTIVITY_STARTED')
  })
})

describe('kill switch and rollout', () => {
  it('turns invites off everywhere without a deploy, and back on', async () => {
    const before = await api.get('/admin/flags')
    expect(before.body.invites).toMatchObject({ enabled: true, rolloutPercent: 100, holdoutPercent: 10 })
    expect(before.body.invites.holdoutActivityIds.length).toBeGreaterThan(0)

    const off = await api.patch('/admin/flags/invites').send({ enabled: false })
    expect(off.body.invites.enabled).toBe(false)
    expect((await create(ada.id, { rail: 'public', activityId: kayak.id })).body.error.code).toBe('INVITES_OFF')
    const activity = (await api.get(`/activities/${kayak.id}`)).body.activity
    expect(activity.invitesEnabled).toBe(false)

    await api.patch('/admin/flags/invites').send({ enabled: true, rolloutPercent: 0 })
    expect((await api.get(`/activities/${kayak.id}`)).body.activity.invitesEnabled).toBe(false)

    await api.patch('/admin/flags/invites').send({ rolloutPercent: 100 })
    expect((await api.get(`/activities/${kayak.id}`)).body.activity.invitesEnabled).toBe(true)
    expect((await api.patch('/admin/flags/invites').send({})).status).toBe(400)
  })
})

describe('POST /events', () => {
  it('accepts allowed client events, resolves the invite code, and drops unknown props', async () => {
    const link = await create(ada.id, { rail: 'public', activityId: kayak.id })
    const res = await api.post('/events').send({ name: 'invite_opened', anonId: 'anon-12345678', platform: 'mobile', inviteCode: link.body.invite.codeDisplay.toLowerCase(), props: { spotsLeftAtOpen: 3 } })
    expect(res.status).toBe(202)
    const row = await prisma.event.findFirstOrThrow({ where: { name: 'invite_opened', anonId: 'anon-12345678' } })
    expect(row).toMatchObject({ platform: 'mobile', rail: 'public', activityId: kayak.id, props: { spotsLeftAtOpen: 3 } })
    expect(row.inviteId).toBe(link.body.invite.id)

    const bad = await api.post('/events').send({ name: 'booking_succeeded', anonId: 'anon-12345678', platform: 'web' })
    expect(bad.status).toBe(400)
    const leaky = await api.post('/events').send({ name: 'activity_viewed', anonId: 'anon-12345678', platform: 'web', activityId: kayak.id, props: { email: 'x@y.z' } })
    expect(leaky.status).toBe(400)
    const unknown = await api.post('/events').send({ name: 'invite_opened', anonId: 'anon-12345678', platform: 'web', inviteCode: 'ZZZZZZZZ' })
    expect(unknown.status).toBe(202)
  })

  it('stamps a known user and ignores an unknown one', async () => {
    await api.post('/events').set('x-user-id', ada.id).send({ name: 'activity_viewed', anonId: 'anon-known-1', platform: 'web', activityId: kayak.id, props: { fromInvite: false } })
    await api.post('/events').set('x-user-id', randomUUID()).send({ name: 'activity_viewed', anonId: 'anon-unknown-1', platform: 'web', activityId: kayak.id })
    const known = await prisma.event.findFirstOrThrow({ where: { anonId: 'anon-known-1' } })
    const unknown = await prisma.event.findFirstOrThrow({ where: { anonId: 'anon-unknown-1' } })
    expect(known.userId).toBe(ada.id)
    expect(unknown.userId).toBeNull()
  })
})
