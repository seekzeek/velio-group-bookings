import supertest from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { deterministicUuidWhere } from '../src/lib/ids.js'
import { localToUtc } from '../src/lib/time.js'
import { activityBucket, isHoldout } from '../src/modules/flags/flags.js'
import { hmacContact, normalizeContact } from '../src/modules/invites/contacts.js'

export const api = supertest(createApp())

export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE users, activities, activity_photos, plans, bookings, invites, invite_revocations,
      attributions, events, flag_exposures, spot_watches, feature_flags RESTART IDENTITY CASCADE`)
  await prisma.featureFlag.create({ data: { key: 'invites', enabled: true, rolloutPercent: 100 } })
}

export async function createUser(displayName: string, options: { contact?: string; generation?: number } = {}) {
  const normalized = options.contact ? normalizeContact(options.contact) : null
  return prisma.user.create({
    data: { displayName, generation: options.generation ?? 0, contactHmac: normalized ? hmacContact(normalized) : null },
  })
}

export function futureLocal(daysAhead: number, time = '17:30') {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysAhead)
  return `${d.toISOString().slice(0, 10)}T${time}`
}

export async function createActivity(
  hostId: string,
  options: { title?: string; capacity?: number; spotsTaken?: number; startsAt?: Date; holdout?: boolean } = {},
) {
  const title = options.title ?? 'Test Activity'
  const id = deterministicUuidWhere(`test:${title}:${Math.random()}`, (candidate) => isHoldout(candidate) === (options.holdout ?? false))
  return prisma.activity.create({
    data: {
      id,
      hostId,
      title,
      description: 'A test activity.',
      category: 'outdoors',
      illustration: 'kayak',
      location: 'Somewhere',
      startsAt: options.startsAt ?? localToUtc(futureLocal(7), 'Africa/Lagos'),
      timezone: 'Africa/Lagos',
      priceMinor: 4500,
      currency: 'USD',
      capacity: options.capacity ?? 12,
      spotsTaken: options.spotsTaken ?? 0,
      flagBucket: activityBucket(id),
    },
  })
}

export async function bookDirectly(activityId: string, userId: string, createdAt = new Date()) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({ data: { activityId, ownerId: userId, createdAt } })
    const booking = await tx.booking.create({
      data: { activityId, planId: plan.id, userId, idempotencyKey: `fixture-${plan.id}`, createdAt },
    })
    await tx.activity.update({ where: { id: activityId }, data: { spotsTaken: { increment: 1 }, version: { increment: 1 } } })
    return { plan, booking }
  })
}

export async function createInvite(input: {
  code: string
  rail: 'vouch' | 'public'
  inviterId: string
  activityId: string
  planId: string | null
  recipientContact?: string
  recipientLabel?: string
  expiresAt: Date
  createdAt?: Date
}) {
  const normalized = input.recipientContact ? normalizeContact(input.recipientContact) : null
  return prisma.invite.create({
    data: {
      code: input.code,
      rail: input.rail,
      inviterId: input.inviterId,
      activityId: input.activityId,
      planId: input.planId,
      recipientHmac: normalized ? hmacContact(normalized) : null,
      recipientLabel: input.recipientLabel ?? null,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt ?? new Date(),
    },
  })
}
