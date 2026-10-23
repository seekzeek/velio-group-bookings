import { config } from '../../config.js'
import type { Db, Tx } from '../../db.js'
import { AppError, isAppError } from '../../errors.js'
import type { Booking, Platform, User } from '../../generated/prisma/client.js'
import { decorateActivities } from '../activities/activities.js'
import type { ActivityJson } from '../activities/serialize.js'
import type { BookingService, Committed } from '../booking/booking.js'
import type { Counts } from '../booking/reserve.js'
import { getInviteFlag } from '../flags/flags.js'
import { planInclude, serializePlan } from '../plans/serialize.js'
import { recordEvent } from '../tracking/events.js'
import { bookingRejectionCodes, metrics } from '../tracking/metrics.js'
import { contactHmacFromRaw } from './contacts.js'
import { findInviteByCode, inviteStatus, statusToError, type InviteRow } from './resolve.js'

export type ClaimInput = {
  code: string
  idempotencyKey: string
  displayName?: string
  contact?: string
  viewerId?: string | null
  platform?: Platform | null
  anonId?: string | null
}

export type ClaimResult = {
  userId: string
  isNewUser: boolean
  generation: number
  booking: { id: string; status: Booking['status']; createdAt: string }
  plan: ReturnType<typeof serializePlan>
  activity: ActivityJson
  replayed: boolean
}

type Claimed = { user: User; isNewUser: boolean; booking: Booking; planId: string; counts: Counts | null; replayed: boolean }

const activityInclude = { host: { select: { id: true, displayName: true } }, photos: true } as const

function isUniqueViolation(err: unknown) {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

type Guest = { user: User | null; contactHmac: string | null }

// Works out who is claiming without creating anyone. A signed-in user's own contact is what a vouch is matched against; a stranger's typed contact is.
async function identifyGuest(tx: Tx, invite: InviteRow, input: ClaimInput): Promise<Guest> {
  const providedHmac = input.contact ? contactHmacFromRaw(input.contact) : null
  if (input.contact && !providedHmac) throw new AppError('VALIDATION', { details: { fields: { contact: 'Enter a phone number or email.' } } })

  if (input.viewerId) {
    const user = await tx.user.findUnique({ where: { id: input.viewerId } })
    if (!user) throw new AppError('UNAUTHENTICATED')
    const hmac = user.contactHmac ?? providedHmac
    if (invite.rail === 'vouch') {
      if (!hmac) throw new AppError('VALIDATION', { details: { fields: { contact: 'Enter the number or email the vouch was sent to.' } } })
      if (hmac !== invite.recipientHmac) throw new AppError('INVITE_NOT_FOR_YOU')
    }
    return { user, contactHmac: hmac }
  }

  if (!providedHmac) throw new AppError('VALIDATION', { details: { fields: { contact: 'Enter a phone number or email.' } } })
  if (invite.rail === 'vouch' && providedHmac !== invite.recipientHmac) throw new AppError('INVITE_NOT_FOR_YOU')
  return { user: await tx.user.findUnique({ where: { contactHmac: providedHmac } }), contactHmac: providedHmac }
}

// A new guest inherits the inviter's generation plus one, and that never changes.
async function createGuest(tx: Tx, invite: InviteRow, input: ClaimInput, contactHmac: string): Promise<User> {
  const displayName = input.displayName?.trim()
  if (!displayName) throw new AppError('VALIDATION', { details: { fields: { displayName: 'Tell us your name.' } } })
  const user = await tx.user.create({
    data: { displayName, contactHmac, generation: invite.inviter.generation + 1, remindDayBefore: true, friendUpdates: false },
  })
  await recordEvent(tx, {
    name: 'user_created',
    userId: user.id,
    anonId: input.anonId,
    platform: input.platform,
    activityId: invite.activityId,
    inviteId: invite.id,
    rail: invite.rail,
    props: { generation: user.generation },
  })
  return user
}

export function createClaimService(booking: BookingService, deps: { onCommitted?: (change: Committed) => void } = {}) {
  async function claimInTransaction(tx: Tx, input: ClaimInput, now: Date): Promise<Claimed> {
    const invite = await findInviteByCode(tx, input.code)
    const guest = await identifyGuest(tx, invite, input)

    // A retry with the same key gets its original answer even if the vouch now reads as used, because this guest is the one who used it.
    if (guest.user) {
      const replay = await tx.booking.findUnique({ where: { userId_idempotencyKey: { userId: guest.user.id, idempotencyKey: input.idempotencyKey } } })
      if (replay) return { user: guest.user, isNewUser: false, booking: replay, planId: replay.planId, counts: null, replayed: true }
    }

    const status = inviteStatus(invite, await getInviteFlag(tx), now)
    if (status !== 'open') throw new AppError(statusToError[status])
    if (guest.user?.id === invite.inviterId) throw new AppError('VALIDATION', { message: 'You can\'t claim your own invite.' })

    const isNewUser = guest.user === null
    const user = guest.user ?? (await createGuest(tx, invite, input, guest.contactHmac!))

    const reserved = await booking.reserve(tx, {
      activityId: invite.activityId,
      userId: user.id,
      idempotencyKey: input.idempotencyKey,
      planId: invite.planId,
      inviteId: invite.id,
      platform: input.platform,
      anonId: input.anonId,
      now,
    })
    await tx.attribution.create({
      data: {
        inviteId: invite.id,
        rail: invite.rail,
        code: invite.code,
        inviterId: invite.inviterId,
        inviteeId: user.id,
        inviteeWasNew: isNewUser,
        hopGeneration: invite.inviter.generation + 1,
        planId: reserved.planId,
        bookingId: reserved.booking.id,
      },
    })
    await recordEvent(tx, {
      name: 'spot_claimed',
      userId: user.id,
      anonId: input.anonId,
      platform: input.platform,
      activityId: invite.activityId,
      inviteId: invite.id,
      rail: invite.rail,
      props: { wasNew: isNewUser, hopGeneration: invite.inviter.generation + 1, planId: reserved.planId, isHostInvite: invite.planId === null },
    })
    return { user, isNewUser, booking: reserved.booking, planId: reserved.planId, counts: reserved.counts, replayed: false }
  }

  async function loadResult(db: Db, claimed: Claimed): Promise<ClaimResult> {
    const [plan, activityRow] = await Promise.all([
      db.plan.findUniqueOrThrow({ where: { id: claimed.planId }, include: planInclude }),
      db.activity.findUniqueOrThrow({ where: { id: claimed.booking.activityId }, include: activityInclude }),
    ])
    const [activity] = await decorateActivities(db, [activityRow], claimed.user.id)
    return {
      userId: claimed.user.id,
      isNewUser: claimed.isNewUser,
      generation: claimed.user.generation,
      booking: { id: claimed.booking.id, status: claimed.booking.status, createdAt: claimed.booking.createdAt.toISOString() },
      plan: serializePlan(plan),
      activity: activity!,
      replayed: claimed.replayed,
    }
  }

  async function claimInvite(db: Db, input: ClaimInput): Promise<ClaimResult> {
    const now = new Date()
    const preview = await findInviteByCode(db, input.code)
    const rail = preview.rail
    const platform = input.platform ?? 'unknown'
    metrics.bookingAttempts.inc({ source: 'invite', platform })
    await recordEvent(db, { name: 'claim_attempted', userId: input.viewerId, anonId: input.anonId, platform: input.platform, activityId: preview.activityId, inviteId: preview.id, rail })

    try {
      const claimed = await db.$transaction((tx) => claimInTransaction(tx, input, now), {
        timeout: config.BOOKING_TX_TIMEOUT_MS,
        maxWait: config.BOOKING_TX_TIMEOUT_MS,
      })
      if (!claimed.replayed) {
        metrics.bookingSuccesses.inc({ source: 'invite', platform })
        metrics.claims.inc({ rail, outcome: 'claimed', platform })
        if (claimed.counts) deps.onCommitted?.({ activityId: claimed.booking.activityId, counts: claimed.counts, committedAt: new Date() })
      }
      return loadResult(db, claimed)
    } catch (err) {
      throw await settle(err)
    }

    async function settle(err: unknown): Promise<unknown> {
      let final = err
      if (isUniqueViolation(err)) {
        // The row that won the race decides which answer this request gets.
        if (rail === 'vouch' && (await db.attribution.count({ where: { inviteId: preview.id } })) > 0) final = new AppError('INVITE_USED')
        else final = new AppError('TRY_AGAIN')
      }
      const code = isAppError(final) ? final.code : (final as { code?: string }).code === 'P2028' ? 'TRY_AGAIN' : 'INTERNAL'
      metrics.claims.inc({ rail, outcome: code, platform })
      if (bookingRejectionCodes.has(code)) {
        metrics.bookingRejections.inc({ source: 'invite', code, platform })
        await recordEvent(db, { name: 'claim_rejected', userId: input.viewerId, anonId: input.anonId, platform: input.platform, activityId: preview.activityId, inviteId: preview.id, rail, props: { code } }).catch(() => undefined)
      } else if (code !== 'VALIDATION') {
        metrics.bookingErrors.inc({ source: 'invite', code, platform })
        await recordEvent(db, { name: 'claim_failed', userId: input.viewerId, anonId: input.anonId, platform: input.platform, activityId: preview.activityId, inviteId: preview.id, rail, props: { code } }).catch(() => undefined)
      }
      return final
    }
  }

  return { claimInvite }
}

export type ClaimService = ReturnType<typeof createClaimService>
