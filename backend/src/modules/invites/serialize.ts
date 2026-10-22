import { config } from '../../config.js'
import type { DbClient } from '../../db.js'
import type { Attribution, Invite, InviteRevocation, User } from '../../generated/prisma/client.js'
import { displayCode } from './codes.js'

export type InviteRow = Invite & {
  revocations: Pick<InviteRevocation, 'createdAt'>[]
  attributions: (Pick<Attribution, 'inviteeId' | 'inviteeWasNew' | 'createdAt'> & { invitee: Pick<User, 'displayName'> })[]
}

export type OpenStats = { opensCount: number; firstOpenedAt: Date | null; lastOpenedAt: Date | null; lastOpenSpotsLeft: number | null }

export type InviterInviteStatus = 'not_opened' | 'opened' | 'opened_when_full' | 'joined' | 'expired' | 'revoked' | 'active'

export const inviteForInviterInclude = {
  revocations: { select: { createdAt: true } },
  attributions: { select: { inviteeId: true, inviteeWasNew: true, createdAt: true, invitee: { select: { displayName: true } } } },
} as const

export function inviteUrl(code: string) {
  return `${config.PUBLIC_WEB_URL}/i/${code}`
}

// Unique openers per invite from invite_opened events, keyed by anonymous id or user id.
export async function openStatsFor(db: DbClient, inviteIds: string[]): Promise<Map<string, OpenStats>> {
  if (inviteIds.length === 0) return new Map()
  const rows = await db.$queryRaw<{ invite_id: string; opens: bigint; first_at: Date; last_at: Date; last_spots_left: number | null }[]>`
    SELECT invite_id,
           COUNT(DISTINCT COALESCE(anon_id, user_id::text)) AS opens,
           MIN(occurred_at) AS first_at,
           MAX(occurred_at) AS last_at,
           (ARRAY_AGG((props->>'spotsLeftAtOpen')::int ORDER BY occurred_at DESC))[1] AS last_spots_left
      FROM events
     WHERE name = 'invite_opened' AND invite_id = ANY(${inviteIds}::uuid[])
     GROUP BY invite_id`
  return new Map(
    rows.map((r) => [r.invite_id, { opensCount: Number(r.opens), firstOpenedAt: r.first_at, lastOpenedAt: r.last_at, lastOpenSpotsLeft: r.last_spots_left }]),
  )
}

export function inviterStatus(invite: InviteRow, opens: OpenStats | undefined, now = new Date()): InviterInviteStatus {
  const joined = invite.attributions.length > 0
  if (invite.rail === 'vouch' && joined) return 'joined'
  if (invite.revocations.length > 0) return 'revoked'
  if (invite.expiresAt <= now) return 'expired'
  if (invite.rail === 'public') return 'active'
  if (!opens || opens.opensCount === 0) return 'not_opened'
  if (opens.lastOpenSpotsLeft === 0) return 'opened_when_full'
  return 'opened'
}

export function serializeInviteForInviter(invite: InviteRow, opens: OpenStats | undefined, now = new Date()) {
  const first = invite.attributions[0]
  const status = inviterStatus(invite, opens, now)
  return {
    id: invite.id,
    code: invite.code,
    codeDisplay: displayCode(invite.code),
    url: inviteUrl(invite.code),
    rail: invite.rail,
    activityId: invite.activityId,
    planId: invite.planId,
    isHostInvite: invite.planId === null,
    recipientLabel: invite.recipientLabel,
    status,
    opensCount: opens?.opensCount ?? 0,
    firstOpenedAt: opens?.firstOpenedAt?.toISOString() ?? null,
    lastOpenSpotsLeft: opens?.lastOpenSpotsLeft ?? null,
    joinedCount: invite.attributions.length,
    joinedAt: first?.createdAt.toISOString() ?? null,
    invitee: invite.rail === 'vouch' && first ? { displayName: first.invitee.displayName, wasNew: first.inviteeWasNew } : null,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    revokedAt: invite.revocations[0]?.createdAt.toISOString() ?? null,
  }
}

export type InviterInviteJson = ReturnType<typeof serializeInviteForInviter>
