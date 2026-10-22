import type { Db } from '../../db.js'
import { AppError } from '../../errors.js'
import type { Platform, Rail } from '../../generated/prisma/client.js'
import { getInviteFlag, invitesEnabledFor } from '../flags/flags.js'
import { recordEvent } from '../tracking/events.js'
import { generateCode } from './codes.js'
import { contactHmacFromRaw } from './contacts.js'
import { inviteForInviterInclude, serializeInviteForInviter, type InviterInviteJson } from './serialize.js'

export const VOUCHES_PER_USER_PER_ACTIVITY = 10

export type CreateInviteInput = {
  rail: Rail
  activityId: string
  inviterId: string
  recipientContact?: string
  recipientLabel?: string
  platform?: Platform | null
}

export type CreateInviteResult = { invite: InviterInviteJson; created: boolean }

function isUniqueViolation(err: unknown) {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

// Works out which plan the invite belongs to: the sender's own plan if they hold a spot, none if they're the host.
export async function planForInviter(db: Db, activityId: string, inviterId: string, hostId: string): Promise<string | null> {
  const booking = await db.booking.findFirst({ where: { activityId, userId: inviterId, status: 'confirmed' }, select: { planId: true } })
  if (booking) return booking.planId
  if (hostId === inviterId) return null
  throw new AppError('NOT_GOING')
}

export async function createInvite(db: Db, input: CreateInviteInput, now = new Date()): Promise<CreateInviteResult> {
  const activity = await db.activity.findUnique({ where: { id: input.activityId }, select: { id: true, hostId: true, startsAt: true } })
  if (!activity) throw new AppError('NOT_FOUND')
  if (activity.startsAt <= now) throw new AppError('ACTIVITY_STARTED')
  if (!invitesEnabledFor(activity.id, await getInviteFlag(db))) throw new AppError('INVITES_OFF')

  const planId = await planForInviter(db, activity.id, input.inviterId, activity.hostId)

  if (input.rail === 'public') {
    const existing = await db.invite.findFirst({
      where: { rail: 'public', inviterId: input.inviterId, activityId: activity.id, expiresAt: { gt: now }, revocations: { none: {} } },
      include: inviteForInviterInclude,
      orderBy: { createdAt: 'desc' },
    })
    if (existing) return { invite: serializeInviteForInviter(existing, undefined, now), created: false }
  }

  let recipientHmac: string | null = null
  if (input.rail === 'vouch') {
    recipientHmac = input.recipientContact ? contactHmacFromRaw(input.recipientContact) : null
    if (!recipientHmac) throw new AppError('VALIDATION', { details: { fields: { recipientContact: 'Enter a phone number or email.' } } })
    const sent = await db.invite.count({ where: { rail: 'vouch', inviterId: input.inviterId, activityId: activity.id } })
    if (sent >= VOUCHES_PER_USER_PER_ACTIVITY) throw new AppError('VOUCH_LIMIT')
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode()
    try {
      const invite = await db.$transaction(async (tx) => {
        const row = await tx.invite.create({
          data: {
            code,
            rail: input.rail,
            inviterId: input.inviterId,
            activityId: activity.id,
            planId,
            recipientHmac,
            recipientLabel: input.recipientLabel?.trim() || null,
            expiresAt: activity.startsAt,
          },
          include: inviteForInviterInclude,
        })
        await recordEvent(tx, {
          name: 'invite_created',
          userId: input.inviterId,
          platform: input.platform,
          activityId: activity.id,
          inviteId: row.id,
          rail: input.rail,
          props: { planId, isHostInvite: planId === null },
        })
        return row
      })
      return { invite: serializeInviteForInviter(invite, undefined, now), created: true }
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
    }
  }
  throw new AppError('TRY_AGAIN', { message: 'Could not find a free invite code.' })
}
