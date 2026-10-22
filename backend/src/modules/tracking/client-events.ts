import { z } from 'zod'
import type { Db } from '../../db.js'
import { normalizeCode } from '../invites/codes.js'
import { recordEvent } from './events.js'

// Only names a client can legitimately know about. Server-side events are written by the modules that own the change.
export const clientEventNames = [
  'activity_viewed',
  'invite_opened',
  'claim_started',
  'claim_submitted',
  'invite_link_copied',
  'invite_link_shared',
  'invite_nudged',
  'invite_missed',
] as const

export const clientEventSchema = z.object({
  name: z.enum(clientEventNames),
  anonId: z.string().min(8).max(64),
  platform: z.enum(['web', 'mobile']),
  activityId: z.uuid().optional(),
  inviteCode: z.string().min(8).max(16).optional(),
  props: z
    .object({
      spotsLeftAtOpen: z.number().int().min(0).optional(),
      fromInvite: z.boolean().optional(),
      rail: z.enum(['vouch', 'public']).optional(),
    })
    .strict()
    .optional(),
})

export type ClientEvent = z.infer<typeof clientEventSchema>

export async function recordClientEvent(db: Db, event: ClientEvent, userId: string | null): Promise<void> {
  const code = event.inviteCode ? normalizeCode(event.inviteCode) : null
  const invite = code ? await db.invite.findUnique({ where: { code }, select: { id: true, rail: true, activityId: true } }) : null
  const knownUser = userId ? await db.user.findUnique({ where: { id: userId }, select: { id: true } }) : null
  await recordEvent(db, {
    name: event.name,
    userId: knownUser?.id ?? null,
    anonId: event.anonId,
    platform: event.platform,
    activityId: event.activityId ?? invite?.activityId ?? null,
    inviteId: invite?.id ?? null,
    rail: event.props?.rail ?? invite?.rail ?? null,
    props: { ...(event.props ?? {}), ...(event.inviteCode && !invite ? { unknownCode: true } : {}) },
  })
}
