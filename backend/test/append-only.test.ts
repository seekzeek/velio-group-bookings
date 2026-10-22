import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { bookDirectly, createActivity, createInvite, createUser, resetDb } from './helpers.js'

let attributionId: string
let inviteId: string

beforeAll(async () => {
  await resetDb()
  const ada = await createUser('Ada')
  const tunde = await createUser('Tunde', { generation: 1 })
  const activity = await createActivity(ada.id)
  const { plan } = await bookDirectly(activity.id, ada.id)
  const invite = await createInvite({ code: 'BQ7N4XKD', rail: 'vouch', inviterId: ada.id, activityId: activity.id, planId: plan.id, recipientContact: 'tunde@example.com', expiresAt: activity.startsAt })
  inviteId = invite.id
  const booking = await prisma.booking.create({ data: { activityId: activity.id, planId: plan.id, userId: tunde.id, inviteId: invite.id, idempotencyKey: 'k' } })
  await prisma.activity.update({ where: { id: activity.id }, data: { spotsTaken: { increment: 1 } } })
  const attribution = await prisma.attribution.create({ data: { inviteId: invite.id, rail: 'vouch', code: invite.code, inviterId: ada.id, inviteeId: tunde.id, inviteeWasNew: true, hopGeneration: 1, planId: plan.id, bookingId: booking.id } })
  attributionId = attribution.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('append-only tables', () => {
  it('rejects UPDATE on attributions', async () => {
    await expect(prisma.$executeRaw`UPDATE attributions SET hop_generation = 9 WHERE id = ${attributionId}::uuid`).rejects.toThrow(/append-only/)
    const row = await prisma.attribution.findUniqueOrThrow({ where: { id: attributionId } })
    expect(row.hopGeneration).toBe(1)
  })

  it('rejects DELETE on attributions', async () => {
    await expect(prisma.$executeRaw`DELETE FROM attributions WHERE id = ${attributionId}::uuid`).rejects.toThrow(/append-only/)
    expect(await prisma.attribution.count()).toBe(1)
  })

  it('rejects UPDATE and DELETE on invites and revocations', async () => {
    await expect(prisma.invite.update({ where: { id: inviteId }, data: { recipientLabel: 'x' } })).rejects.toThrow()
    await expect(prisma.invite.delete({ where: { id: inviteId } })).rejects.toThrow()
    const revocation = await prisma.inviteRevocation.create({ data: { inviteId, reason: 'test' } })
    await expect(prisma.inviteRevocation.delete({ where: { id: revocation.id } })).rejects.toThrow(/append-only/)
  })

  it('refuses a second attribution for the same vouch', async () => {
    const other = await prisma.booking.findFirstOrThrow({ where: { inviteId: null } })
    await expect(
      prisma.attribution.create({ data: { inviteId, rail: 'vouch', code: 'BQ7N4XKD', inviterId: other.userId, inviteeId: other.userId, inviteeWasNew: false, hopGeneration: 1, planId: other.planId, bookingId: other.id } }),
    ).rejects.toThrow()
  })

  it('refuses an oversold activity row', async () => {
    const activity = await prisma.activity.findFirstOrThrow()
    await expect(prisma.activity.update({ where: { id: activity.id }, data: { spotsTaken: activity.capacity + 1 } })).rejects.toThrow()
    await expect(prisma.activity.update({ where: { id: activity.id }, data: { spotsTaken: -1 } })).rejects.toThrow()
  })

  it('refuses two confirmed bookings for one person on one activity', async () => {
    const existing = await prisma.booking.findFirstOrThrow()
    await expect(
      prisma.booking.create({ data: { activityId: existing.activityId, planId: existing.planId, userId: existing.userId, idempotencyKey: 'another' } }),
    ).rejects.toThrow()
  })
})
