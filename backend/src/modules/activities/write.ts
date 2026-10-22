import { createHash } from 'node:crypto'
import type { Db } from '../../db.js'
import { AppError } from '../../errors.js'
import type { Category, Illustration } from '../../generated/prisma/client.js'
import { isValidTimezone, localToUtc } from '../../lib/time.js'
import { activityBucket } from '../flags/flags.js'
import { recordEvent } from '../tracking/events.js'
import { getActivity } from './activities.js'

export type ActivityInput = {
  title: string
  description: string
  category: Category
  location: string
  startsAt?: string
  startsAtLocal?: string
  timezone: string
  price: { amountMinor: number; currency: string }
  capacity: number
}

const illustrationsByCategory: Record<Category, Illustration[]> = {
  outdoors: ['kayak', 'hike'],
  nights_out: ['speakeasy', 'salsa'],
  food_and_drink: ['market'],
  classes: ['pottery'],
  other: ['other'],
}

// The illustrated cover is picked once from the id, so web and mobile draw the same picture for an activity without photos.
export function pickIllustration(activityId: string, category: Category): Illustration {
  const options = illustrationsByCategory[category]
  const n = createHash('sha256').update(`illustration:${activityId}`).digest().readUInt8(0)
  return options[n % options.length]!
}

function resolveStart(input: Pick<ActivityInput, 'startsAt' | 'startsAtLocal' | 'timezone'>, now: Date): Date {
  if (!isValidTimezone(input.timezone)) throw new AppError('VALIDATION', { details: { fields: { timezone: 'Pick a valid time zone.' } } })
  let startsAt: Date
  if (input.startsAtLocal) {
    try {
      startsAt = localToUtc(input.startsAtLocal, input.timezone)
    } catch {
      throw new AppError('VALIDATION', { details: { fields: { startsAtLocal: 'Use YYYY-MM-DDTHH:mm.' } } })
    }
  } else if (input.startsAt) {
    startsAt = new Date(input.startsAt)
    if (Number.isNaN(startsAt.getTime())) throw new AppError('VALIDATION', { details: { fields: { startsAt: 'Use an ISO timestamp.' } } })
  } else {
    throw new AppError('VALIDATION', { details: { fields: { startsAtLocal: 'Tell us when it starts.' } } })
  }
  if (startsAt <= now) throw new AppError('VALIDATION', { details: { fields: { startsAtLocal: 'Pick a time in the future.' } } })
  return startsAt
}

export async function createActivity(db: Db, hostId: string, input: ActivityInput, now = new Date()) {
  const startsAt = resolveStart(input, now)
  const created = await db.$transaction(async (tx) => {
    const draft = await tx.activity.create({
      data: {
        hostId,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        illustration: 'other',
        location: input.location.trim(),
        startsAt,
        timezone: input.timezone,
        priceMinor: input.price.amountMinor,
        currency: input.price.currency.toUpperCase(),
        capacity: input.capacity,
      },
    })
    const activity = await tx.activity.update({
      where: { id: draft.id },
      data: { illustration: pickIllustration(draft.id, input.category), flagBucket: activityBucket(draft.id) },
    })
    await recordEvent(tx, { name: 'activity_created', userId: hostId, activityId: activity.id, props: { category: input.category, capacity: input.capacity, flagBucket: activity.flagBucket } })
    return activity
  })
  return getActivity(db, created.id, { userId: hostId })
}

export async function updateActivity(db: Db, activityId: string, hostId: string, patch: Partial<ActivityInput>, now = new Date()) {
  const existing = await db.activity.findUnique({ where: { id: activityId } })
  if (!existing) throw new AppError('NOT_FOUND')
  if (existing.hostId !== hostId) throw new AppError('FORBIDDEN')

  const timezone = patch.timezone ?? existing.timezone
  const startsAt = patch.startsAt || patch.startsAtLocal ? resolveStart({ ...patch, timezone }, now) : undefined
  if (!startsAt && patch.timezone && !isValidTimezone(patch.timezone)) throw new AppError('VALIDATION', { details: { fields: { timezone: 'Pick a valid time zone.' } } })

  await db.$transaction(async (tx) => {
    if (patch.capacity !== undefined && patch.capacity !== existing.capacity) {
      // The row re-checks the count under lock, so a booking landing at the same moment can't leave spots_taken above the new capacity.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE activities SET capacity = ${patch.capacity}, version = version + 1, updated_at = now()
        WHERE id = ${activityId}::uuid AND spots_taken <= ${patch.capacity} RETURNING id`
      if (rows.length === 0) throw new AppError('VALIDATION', { details: { fields: { capacity: `Capacity can't go below the ${existing.spotsTaken} people already booked.` } } })
    }
    await tx.activity.update({
      where: { id: activityId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
        ...(patch.category !== undefined ? { category: patch.category, illustration: pickIllustration(activityId, patch.category) } : {}),
        ...(patch.location !== undefined ? { location: patch.location.trim() } : {}),
        ...(startsAt ? { startsAt } : {}),
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(patch.price !== undefined ? { priceMinor: patch.price.amountMinor, currency: patch.price.currency.toUpperCase() } : {}),
      },
    })
    if (startsAt) {
      // Invites expire when the activity starts. Rows are append-only, so the new start is what the lookup reads; expires_at stays the original ceiling.
      await recordEvent(tx, { name: 'activity_rescheduled', userId: hostId, activityId, props: { from: existing.startsAt.toISOString(), to: startsAt.toISOString() } })
    }
  })
  return getActivity(db, activityId, { userId: hostId })
}
