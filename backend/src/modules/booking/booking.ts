import { config } from '../../config.js'
import type { Db } from '../../db.js'
import { AppError, isAppError } from '../../errors.js'
import type { Booking, Platform } from '../../generated/prisma/client.js'
import { decorateActivities } from '../activities/activities.js'
import type { ActivityJson } from '../activities/serialize.js'
import { planInclude, serializePlan } from '../plans/serialize.js'
import { recordEvent } from '../tracking/events.js'
import { bookingRejectionCodes, metrics } from '../tracking/metrics.js'
import { releaseSpot, reserveSpot, type Counts, type ReserveFn } from './reserve.js'

export type BookInput = { activityId: string; userId: string; idempotencyKey: string; platform?: Platform | null; anonId?: string | null }

export type BookResult = {
  booking: { id: string; status: Booking['status']; createdAt: string }
  plan: ReturnType<typeof serializePlan>
  activity: ActivityJson
  replayed: boolean
}

export type Committed = { activityId: string; counts: Counts; committedAt: Date }

export type BookingDeps = { reserve?: ReserveFn; onCommitted?: (change: Committed) => void }

const activityInclude = { host: { select: { id: true, displayName: true } }, photos: true } as const

async function loadResult(db: Db, booking: Booking, replayed: boolean): Promise<BookResult> {
  const [plan, activityRow] = await Promise.all([
    db.plan.findUniqueOrThrow({ where: { id: booking.planId }, include: planInclude }),
    db.activity.findUniqueOrThrow({ where: { id: booking.activityId }, include: activityInclude }),
  ])
  const [activity] = await decorateActivities(db, [activityRow], booking.userId)
  return {
    booking: { id: booking.id, status: booking.status, createdAt: booking.createdAt.toISOString() },
    plan: serializePlan(plan),
    activity: activity!,
    replayed,
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

export function createBookingService(deps: BookingDeps = {}) {
  const reserve = deps.reserve ?? reserveSpot

  async function bookSpot(db: Db, input: BookInput): Promise<BookResult> {
    const replay = await db.booking.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } } })
    if (replay) return loadResult(db, replay, true)

    const platform = input.platform ?? 'unknown'
    metrics.bookingAttempts.inc({ source: 'direct', platform })
    await recordEvent(db, { name: 'booking_attempted', userId: input.userId, anonId: input.anonId, platform: input.platform, activityId: input.activityId, props: { source: 'direct' } })

    try {
      const result = await db.$transaction(
        (tx) => reserve(tx, { ...input, planId: null, inviteId: null }),
        { timeout: config.BOOKING_TX_TIMEOUT_MS, maxWait: config.BOOKING_TX_TIMEOUT_MS },
      )
      metrics.bookingSuccesses.inc({ source: 'direct', platform })
      deps.onCommitted?.({ activityId: input.activityId, counts: result.counts, committedAt: new Date() })
      return loadResult(db, result.booking, false)
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Two requests with the same key raced; the first one's row is the answer for both.
        const raced = await db.booking.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } } })
        if (raced) return loadResult(db, raced, true)
        const confirmed = await db.booking.findFirst({ where: { activityId: input.activityId, userId: input.userId, status: 'confirmed' } })
        if (confirmed) throw await rejected(new AppError('ALREADY_BOOKED', { details: { bookingId: confirmed.id, planId: confirmed.planId } }))
      }
      throw await rejected(err)
    }

    async function rejected(err: unknown): Promise<unknown> {
      const code = isAppError(err) ? err.code : (err as { code?: string }).code === 'P2028' ? 'TRY_AGAIN' : 'INTERNAL'
      if (bookingRejectionCodes.has(code)) {
        metrics.bookingRejections.inc({ source: 'direct', code, platform })
        await recordEvent(db, { name: 'booking_rejected', userId: input.userId, anonId: input.anonId, platform: input.platform, activityId: input.activityId, props: { code } }).catch(() => undefined)
      } else {
        metrics.bookingErrors.inc({ source: 'direct', code, platform })
        await recordEvent(db, { name: 'booking_failed', userId: input.userId, anonId: input.anonId, platform: input.platform, activityId: input.activityId, props: { code } }).catch(() => undefined)
      }
      return err
    }
  }

  async function cancelBooking(db: Db, input: { bookingId: string; userId: string }) {
    const result = await db.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id: input.bookingId } })
        if (!booking) throw new AppError('NOT_FOUND')
        if (booking.userId !== input.userId) throw new AppError('FORBIDDEN')
        if (booking.status === 'cancelled') {
          const activity = await tx.activity.findUniqueOrThrow({ where: { id: booking.activityId } })
          return { booking, counts: { spotsTaken: activity.spotsTaken, capacity: activity.capacity, spotsLeft: activity.capacity - activity.spotsTaken, version: activity.version }, changed: false }
        }
        const released = await releaseSpot(tx, booking)
        return { ...released, changed: true }
      },
      { timeout: config.BOOKING_TX_TIMEOUT_MS, maxWait: config.BOOKING_TX_TIMEOUT_MS },
    )
    if (result.changed) deps.onCommitted?.({ activityId: result.booking.activityId, counts: result.counts, committedAt: new Date() })
    return {
      booking: { id: result.booking.id, status: result.booking.status, cancelledAt: result.booking.cancelledAt?.toISOString() ?? null },
      activity: result.counts,
    }
  }

  return { bookSpot, cancelBooking, reserve }
}

export type BookingService = ReturnType<typeof createBookingService>
