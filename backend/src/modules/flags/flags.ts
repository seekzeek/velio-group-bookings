import { createHash } from 'node:crypto'
import { config } from '../../config.js'
import type { DbClient } from '../../db.js'

export const INVITES_FLAG = 'invites'
export const HOLDOUT_PERCENT = 10

export type InviteFlag = { enabled: boolean; rolloutPercent: number }

export function activityBucket(activityId: string): number {
  const digest = createHash('sha256').update(activityId + config.FLAG_SALT).digest()
  return digest.readUInt32BE(0) % 100
}

export function isHoldout(activityId: string): boolean {
  return activityBucket(activityId) < HOLDOUT_PERCENT
}

// Buckets 0 to 9 are the holdout for good. The rollout only ever walks through 10 to 99.
export function invitesEnabledFor(activityId: string, flag: InviteFlag): boolean {
  if (!flag.enabled) return false
  const bucket = activityBucket(activityId)
  if (bucket < HOLDOUT_PERCENT) return false
  const rolloutBuckets = Math.round(((100 - HOLDOUT_PERCENT) * flag.rolloutPercent) / 100)
  return bucket < HOLDOUT_PERCENT + rolloutBuckets
}

export function variantFor(activityId: string, flag: InviteFlag): 'holdout' | 'on' | 'off' {
  if (isHoldout(activityId)) return 'holdout'
  return invitesEnabledFor(activityId, flag) ? 'on' : 'off'
}

export async function getInviteFlag(db: DbClient): Promise<InviteFlag> {
  const row = await db.featureFlag.findUnique({ where: { key: INVITES_FLAG } })
  return row ? { enabled: row.enabled, rolloutPercent: row.rolloutPercent } : { enabled: true, rolloutPercent: 100 }
}

export async function setInviteFlag(db: DbClient, patch: Partial<InviteFlag>): Promise<InviteFlag> {
  const next = { ...(await getInviteFlag(db)), ...patch }
  await db.featureFlag.upsert({
    where: { key: INVITES_FLAG },
    create: { key: INVITES_FLAG, ...next },
    update: next,
  })
  return next
}

export async function recordExposure(
  db: DbClient,
  input: { activityId: string; userId?: string | null; anonId?: string | null; variant: string },
): Promise<void> {
  if (input.userId) {
    await db.$executeRaw`
      INSERT INTO flag_exposures (id, user_id, activity_id, flag, variant)
      VALUES (gen_random_uuid(), ${input.userId}::uuid, ${input.activityId}::uuid, ${INVITES_FLAG}, ${input.variant})
      ON CONFLICT (user_id, activity_id, flag) WHERE user_id IS NOT NULL DO NOTHING`
  } else if (input.anonId) {
    await db.$executeRaw`
      INSERT INTO flag_exposures (id, anon_id, activity_id, flag, variant)
      VALUES (gen_random_uuid(), ${input.anonId}, ${input.activityId}::uuid, ${INVITES_FLAG}, ${input.variant})
      ON CONFLICT (anon_id, activity_id, flag) WHERE anon_id IS NOT NULL DO NOTHING`
  }
}
