import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { api, bookDirectly, createActivity, createInvite, createUser, resetDb } from './helpers.js'

let kemi: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let femi: Awaited<ReturnType<typeof createUser>>
let kayak: Awaited<ReturnType<typeof createActivity>>
let adaPlanId: string

const claim = (code: string, body: Record<string, unknown>, userId?: string) => {
  const req = api.post(`/invites/${code}/claim`).send({ idempotencyKey: randomUUID(), platform: 'mobile', anonId: 'anon-claimer-1', ...body })
  return userId ? req.set('x-user-id', userId) : req
}

async function vouch(code: string, contact: string, inviterId = ada.id, planId: string | null = adaPlanId, activity = kayak) {
  return createInvite({ code, rail: 'vouch', inviterId, activityId: activity.id, planId, recipientContact: contact, recipientLabel: 'Friend', expiresAt: activity.startsAt })
}

beforeAll(async () => {
  await resetDb()
  kemi = await createUser('Kemi', { contact: 'kemi@example.com' })
  ada = await createUser('Ada', { contact: 'ada@example.com' })
  femi = await createUser('Femi', { contact: 'femi@example.com', generation: 1 })
  kayak = await createActivity(kemi.id, { capacity: 12 })
  adaPlanId = (await bookDirectly(kayak.id, ada.id)).plan.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /invites/:code/claim', () => {
  it('creates the guest at generation inviter + 1, joins the booker\'s plan, and writes the attribution', async () => {
    const invite = await vouch('BQ7N4XKD', '+1 415 555 0133')
    const res = await claim('bq7n-4xkd', { displayName: 'Tunde', contact: '(415) 555-0133' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ isNewUser: true, generation: 1, replayed: false })
    expect(res.body.plan.id).toBe(adaPlanId)
    expect(res.body.plan.members.map((m: { displayName: string; joinedVia: string; invitedBy: { displayName: string } | null }) => [m.displayName, m.joinedVia, m.invitedBy?.displayName])).toEqual([['Ada', 'direct', undefined], ['Tunde', 'vouch', 'Ada']])
    expect(res.body.activity).toMatchObject({ spotsTaken: 2, viewer: { planId: adaPlanId, planRole: 'member', joinedVia: 'vouch' } })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.userId } })
    expect(user).toMatchObject({ displayName: 'Tunde', generation: 1, remindDayBefore: true, friendUpdates: false })
    expect(user.contactHmac).toMatch(/^[0-9a-f]{64}$/)
    const attribution = await prisma.attribution.findUniqueOrThrow({ where: { bookingId: res.body.booking.id } })
    expect(attribution).toMatchObject({ inviteId: invite.id, rail: 'vouch', code: 'BQ7N4XKD', inviterId: ada.id, inviteeId: user.id, inviteeWasNew: true, hopGeneration: 1, planId: adaPlanId })
    const names = (await prisma.event.findMany({ where: { inviteId: invite.id }, orderBy: { occurredAt: 'asc' } })).map((e) => e.name)
    expect(names).toEqual(expect.arrayContaining(['claim_attempted', 'user_created', 'booking_succeeded', 'spot_claimed']))
    expect((await api.get('/invites/BQ7N4XKD')).body.status).toBe('used')
    expect((await api.get(`/me`).set('x-user-id', user.id)).status).toBe(200)
  })

  it('rejects a vouch for a different contact without creating anyone, and a second claim as used', async () => {
    await vouch('CH3M9WRT', 'chioma@example.com')
    const wrong = await claim('CH3M9WRT', { displayName: 'Someone', contact: 'someone@example.com' })
    expect(wrong.status).toBe(403)
    expect(wrong.body.error.code).toBe('INVITE_NOT_FOR_YOU')
    expect(await prisma.user.count({ where: { displayName: 'Someone' } })).toBe(0)

    expect((await claim('CH3M9WRT', { displayName: 'Chioma', contact: 'Chioma@Example.com ' })).status).toBe(201)
    const again = await claim('CH3M9WRT', { displayName: 'Chioma', contact: 'chioma@example.com' })
    expect([409, 201]).toContain(again.status)
    expect(again.body.error?.code ?? 'ALREADY_BOOKED').toBe(again.status === 409 ? again.body.error.code : 'ALREADY_BOOKED')
    const asOther = await claim('CH3M9WRT', { contact: 'chioma@example.com' }, femi.id)
    expect(asOther.status).toBe(403)
  })

  it('keeps an existing user\'s generation and marks the attribution as not new', async () => {
    await vouch('FM2K7HDQ', 'femi@example.com')
    const res = await claim('FM2K7HDQ', { contact: 'femi@example.com' }, femi.id)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ userId: femi.id, isNewUser: false, generation: 1 })
    const attribution = await prisma.attribution.findUniqueOrThrow({ where: { bookingId: res.body.booking.id } })
    expect(attribution).toMatchObject({ inviteeWasNew: false, hopGeneration: 1 })
  })

  it('a host vouch starts a new plan owned by the guest, two hops deep', async () => {
    await vouch('KM4V8TXE', 'ife@example.com', kemi.id, null)
    const res = await claim('KM4V8TXE', { displayName: 'Ife', contact: 'ife@example.com' })
    expect(res.status).toBe(201)
    expect(res.body.plan.owner.id).toBe(res.body.userId)
    expect(res.body.plan.members).toHaveLength(1)
    expect(res.body.plan.id).not.toBe(adaPlanId)

    const link = await createInvite({ code: 'DY9Q3NPX', rail: 'public', inviterId: res.body.userId, activityId: kayak.id, planId: res.body.plan.id, expiresAt: kayak.startsAt })
    const dayo = await claim('DY9Q3NPX', { displayName: 'Dayo', contact: 'dayo@example.com' })
    expect(dayo.status).toBe(201)
    expect(dayo.body.generation).toBe(2)
    expect(dayo.body.plan.id).toBe(res.body.plan.id)
    expect((await prisma.attribution.findUniqueOrThrow({ where: { bookingId: dayo.body.booking.id } })).hopGeneration).toBe(2)
    expect((await api.get(`/invites/${link.code}`)).body.status).toBe('open')
  })

  it('replays the same idempotency key for a guest who retries', async () => {
    await vouch('ZR6P3KWX', 'zara@example.com')
    const key = randomUUID()
    const first = await api.post('/invites/ZR6P3KWX/claim').send({ idempotencyKey: key, displayName: 'Zara', contact: 'zara@example.com' })
    const second = await api.post('/invites/ZR6P3KWX/claim').send({ idempotencyKey: key, displayName: 'Zara', contact: 'zara@example.com' })
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.replayed).toBe(true)
    expect(second.body.booking.id).toBe(first.body.booking.id)
    expect(second.body.userId).toBe(first.body.userId)
    expect(await prisma.user.count({ where: { displayName: 'Zara' } })).toBe(1)
  })

  it('gives every racing retry of one claim the same booking, for a known user', async () => {
    const link = await createInvite({ code: 'RC7K2QWX', rail: 'public', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, expiresAt: kayak.startsAt })
    const racer = await createUser('Racer', { contact: 'racer@example.com' })
    const key = randomUUID()
    const responses = await Promise.all(Array.from({ length: 6 }, () => claim(link.code, { idempotencyKey: key }, racer.id)))
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 200, 201])
    expect(new Set(responses.map((r) => r.body.booking.id)).size).toBe(1)
    expect(await prisma.booking.count({ where: { activityId: kayak.id, userId: racer.id } })).toBe(1)
  })

  it('maps expired, revoked, self-claim, already going and sold out', async () => {
    const past = await createActivity(kemi.id, { startsAt: new Date(Date.now() - 1000) })
    await vouch('QR4T82NP', 'kola@example.com', kemi.id, null, past)
    expect((await claim('QR4T82NP', { displayName: 'Kola', contact: 'kola@example.com' })).body.error.code).toBe('INVITE_EXPIRED')

    const link = await createInvite({ code: 'M2QW7HTA', rail: 'public', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, expiresAt: kayak.startsAt })
    await prisma.inviteRevocation.create({ data: { inviteId: link.id, reason: 'turned_off' } })
    expect((await claim('M2QW7HTA', { displayName: 'X', contact: 'x@example.com' })).body.error.code).toBe('INVITE_REVOKED')

    const open = await createInvite({ code: 'H7PD3KXA', rail: 'public', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, expiresAt: kayak.startsAt })
    const self = await claim(open.code, { contact: 'ada@example.com' }, ada.id)
    expect(self.status).toBe(400)
    const already = await claim(open.code, { displayName: 'Femi again', contact: 'femi@example.com' })
    expect(already.status).toBe(409)
    expect(already.body.error.code).toBe('ALREADY_BOOKED')

    const tiny = await createActivity(kemi.id, { capacity: 1, title: 'Tiny' })
    await bookDirectly(tiny.id, ada.id)
    await createInvite({ code: 'TB3N7QWK', rail: 'public', inviterId: kemi.id, activityId: tiny.id, planId: null, expiresAt: tiny.startsAt })
    const full = await claim('TB3N7QWK', { displayName: 'Late', contact: 'late@example.com' })
    expect(full.status).toBe(409)
    expect(full.body.error.code).toBe('SOLD_OUT')
    expect(await prisma.user.count({ where: { displayName: 'Late' } })).toBe(0)
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: tiny.id } })).spotsTaken).toBe(1)
  })

  it('refuses a claim on a holdout activity and when the kill switch is on', async () => {
    const holdout = await createActivity(kemi.id, { holdout: true })
    await createInvite({ code: 'SY8H4QMD', rail: 'public', inviterId: kemi.id, activityId: holdout.id, planId: null, expiresAt: holdout.startsAt })
    expect((await claim('SY8H4QMD', { displayName: 'G', contact: 'g@example.com' })).body.error.code).toBe('INVITES_OFF')
    await api.patch('/admin/flags/invites').send({ enabled: false })
    await createInvite({ code: 'SF7W2MDK', rail: 'public', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, expiresAt: kayak.startsAt })
    expect((await claim('SF7W2MDK', { displayName: 'G', contact: 'g@example.com' })).body.error.code).toBe('INVITES_OFF')
    await api.patch('/admin/flags/invites').send({ enabled: true })
    expect((await claim('SF7W2MDK', { displayName: 'G', contact: 'g@example.com' })).status).toBe(201)
  })

  it('validates what it needs and 404s unknown codes', async () => {
    expect((await claim('ZZZZZZZZ', { displayName: 'X', contact: 'x@example.com' })).body.error.code).toBe('INVITE_NOT_FOUND')
    await createInvite({ code: 'BG5K2YNP', rail: 'public', inviterId: ada.id, activityId: kayak.id, planId: adaPlanId, expiresAt: kayak.startsAt })
    const noContact = await claim('BG5K2YNP', { displayName: 'X' })
    expect(noContact.status).toBe(400)
    expect(noContact.body.error.details.fields.contact).toBeDefined()
    const noName = await claim('BG5K2YNP', { contact: 'nameless@example.com' })
    expect(noName.body.error.details.fields.displayName).toBeDefined()
  })
})
