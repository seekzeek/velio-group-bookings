import type { Db } from '../../db.js'
import { AppError } from '../../errors.js'
import { recordEvent } from '../tracking/events.js'
import { normalizeCode } from './codes.js'
import { inviteForInviterInclude, openStatsFor, serializeInviteForInviter } from './serialize.js'

// A revocation is a new row. The invite itself is never touched, and revoking twice just returns the same state.
export async function revokeInvite(db: Db, input: { code: string; inviterId: string; reason?: string }) {
  const code = normalizeCode(input.code)
  if (!code) throw new AppError('INVITE_NOT_FOUND')
  const invite = await db.invite.findUnique({ where: { code }, include: inviteForInviterInclude })
  if (!invite) throw new AppError('INVITE_NOT_FOUND')
  if (invite.inviterId !== input.inviterId) throw new AppError('FORBIDDEN')

  if (invite.revocations.length === 0) {
    await db.$transaction(async (tx) => {
      await tx.inviteRevocation.create({ data: { inviteId: invite.id, reason: input.reason ?? 'turned_off' } })
      await recordEvent(tx, { name: 'invite_revoked', userId: input.inviterId, activityId: invite.activityId, inviteId: invite.id, rail: invite.rail, props: { reason: input.reason ?? 'turned_off' } })
    })
  }
  const fresh = await db.invite.findUniqueOrThrow({ where: { id: invite.id }, include: inviteForInviterInclude })
  const opens = await openStatsFor(db, [invite.id])
  return { invite: serializeInviteForInviter(fresh, opens.get(invite.id)) }
}
