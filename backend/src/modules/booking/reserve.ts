import type { Tx } from '../../db.js'
import { AppError } from '../../errors.js'
import type { Booking, Platform } from '../../generated/prisma/client.js'
import { recordEvent } from '../tracking/events.js'

export type Counts = { spotsTaken: number; capacity: number; spotsLeft: number; version: number }

export type ReserveInput = {
  activityId: string
  userId: string
  idempotencyKey: string
  planId?: string | null
  inviteId?: string | null
  platform?: Platform | null
  anonId?: string | null
  now?: Date
}

export type ReserveResult = { booking: Booking; planId: string; counts: Counts }

export type ReserveFn = (tx: Tx, input: ReserveInput) => Promise<ReserveResult>

type CountRow = { spots_taken: number; capacity: number; version: number }

export function toCounts(row: CountRow): Counts {
  return { spotsTaken: row.spots_taken, capacity: row.capacity, spotsLeft: Math.max(0, row.capacity - row.spots_taken), version: row.version }
}

// The only place spots_taken goes up. Direct bookings and invite claims both come through here, inside the caller's transaction.
export const reserveSpot: ReserveFn = async (tx, input) => {
  const now = input.now ?? new Date()
  const activity = await tx.activity.findUnique({ where: { id: input.activityId }, select: { id: true, startsAt: true, hostId: true } })
  if (!activity) throw new AppError('NOT_FOUND')
  if (activity.startsAt <= now) throw new AppError('ACTIVITY_STARTED')

  const existing = await tx.booking.findFirst({ where: { activityId: input.activityId, userId: input.userId, status: 'confirmed' } })
  if (existing) throw new AppError('ALREADY_BOOKED', { details: { bookingId: existing.id, planId: existing.planId } })

  // A second update on the same row waits for the first to commit, then re-checks this WHERE against the committed row, so the loser gets zero rows.
  const rows = await tx.$queryRaw<CountRow[]>`
    UPDATE activities
       SET spots_taken = spots_taken + 1, version = version + 1, updated_at = now()
     WHERE id = ${input.activityId}::uuid AND spots_taken + 1 <= capacity
    RETURNING spots_taken, capacity, version`
  const row = rows[0]
  if (!row) throw new AppError('SOLD_OUT', { details: { spotsLeft: 0, hostId: activity.hostId } })

  const planId = input.planId ?? (await tx.plan.create({ data: { activityId: input.activityId, ownerId: input.userId } })).id
  const booking = await tx.booking.create({
    data: { activityId: input.activityId, planId, userId: input.userId, inviteId: input.inviteId ?? null, idempotencyKey: input.idempotencyKey },
  })
  await recordEvent(tx, {
    name: 'booking_succeeded',
    userId: input.userId,
    anonId: input.anonId,
    platform: input.platform,
    activityId: input.activityId,
    inviteId: input.inviteId,
    props: { planId, source: input.inviteId ? 'invite' : 'direct', spotsLeft: row.capacity - row.spots_taken },
  })
  return { booking, planId, counts: toCounts(row) }
}

// The only place spots_taken goes down.
export async function releaseSpot(tx: Tx, booking: Booking, now = new Date()): Promise<{ booking: Booking; counts: Counts }> {
  const rows = await tx.$queryRaw<CountRow[]>`
    UPDATE activities
       SET spots_taken = spots_taken - 1, version = version + 1, updated_at = now()
     WHERE id = ${booking.activityId}::uuid AND spots_taken > 0
    RETURNING spots_taken, capacity, version`
  const row = rows[0]
  if (!row) throw new AppError('TRY_AGAIN', { message: 'The activity count was already at zero.' })
  const cancelled = await tx.booking.update({ where: { id: booking.id }, data: { status: 'cancelled', cancelledAt: now } })
  await recordEvent(tx, { name: 'booking_cancelled', userId: booking.userId, activityId: booking.activityId, props: { planId: booking.planId } })
  return { booking: cancelled, counts: toCounts(row) }
}
