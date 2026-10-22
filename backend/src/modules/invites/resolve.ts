import type { DbClient } from '../../db.js'
import { AppError, type ErrorCode } from '../../errors.js'
import { decorateActivities } from '../activities/activities.js'
import { getInviteFlag, invitesEnabledFor } from '../flags/flags.js'
import { planInclude, serializePlan } from '../plans/serialize.js'
import { displayCode, normalizeCode } from './codes.js'

export type InviteStatus = 'open' | 'expired' | 'used' | 'revoked' | 'started' | 'off'

export const statusToError: Record<Exclude<InviteStatus, 'open'>, ErrorCode> = {
  expired: 'INVITE_EXPIRED',
  used: 'INVITE_USED',
  revoked: 'INVITE_REVOKED',
  started: 'ACTIVITY_STARTED',
  off: 'INVITES_OFF',
}

const inviteInclude = {
  inviter: { select: { id: true, displayName: true } },
  activity: { include: { host: { select: { id: true, displayName: true } }, photos: true } },
  plan: { include: planInclude },
  revocations: { select: { id: true } },
  attributions: { select: { id: true } },
} as const

export async function findInviteByCode(db: DbClient, rawCode: string) {
  const code = normalizeCode(rawCode)
  if (!code) throw new AppError('INVITE_NOT_FOUND')
  const invite = await db.invite.findUnique({ where: { code }, include: inviteInclude })
  if (!invite) throw new AppError('INVITE_NOT_FOUND')
  return invite
}

export type InviteRow = Awaited<ReturnType<typeof findInviteByCode>>

export function inviteStatus(invite: InviteRow, flag: { enabled: boolean; rolloutPercent: number }, now = new Date()): InviteStatus {
  if (invite.revocations.length > 0) return 'revoked'
  if (invite.expiresAt <= now) return 'expired'
  if (invite.activity.startsAt <= now) return 'started'
  if (!invitesEnabledFor(invite.activityId, flag)) return 'off'
  if (invite.rail === 'vouch' && invite.attributions.length > 0) return 'used'
  return 'open'
}

export async function resolveInvite(db: DbClient, rawCode: string, viewerId: string | null) {
  const invite = await findInviteByCode(db, rawCode)
  const flag = await getInviteFlag(db)
  const [activity] = await decorateActivities(db, [invite.activity], viewerId)
  const viewer = activity!.viewer ? { alreadyInPlan: true, bookingId: activity!.viewer.bookingId, planId: activity!.viewer.planId } : null
  const { viewer: _viewer, ...activityForGuest } = activity!
  return {
    code: invite.code,
    codeDisplay: displayCode(invite.code),
    rail: invite.rail,
    isHostInvite: invite.planId === null,
    status: inviteStatus(invite, flag),
    inviter: { id: invite.inviter.id, displayName: invite.inviter.displayName },
    activity: activityForGuest,
    plan: invite.plan ? serializePlan(invite.plan) : null,
    expiresAt: invite.expiresAt.toISOString(),
    viewer,
  }
}
