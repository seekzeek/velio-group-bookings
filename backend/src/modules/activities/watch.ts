import type { Db } from '../../db.js'
import { AppError } from '../../errors.js'
import { contactHmacFromRaw } from '../invites/contacts.js'
import { recordEvent } from '../tracking/events.js'

// "Tell me if a spot opens." Records the intent and nothing else yet; a waitlist would read these rows.
export async function watchActivity(db: Db, input: { activityId: string; userId: string | null; anonId?: string; contact?: string; platform?: 'web' | 'mobile' }) {
  if (!input.userId && !input.anonId) throw new AppError('VALIDATION', { details: { fields: { anonId: 'Send an anonymous id or sign in.' } } })
  const activity = await db.activity.findUnique({ where: { id: input.activityId }, select: { id: true } })
  if (!activity) throw new AppError('NOT_FOUND')
  const contactHmac = input.contact ? contactHmacFromRaw(input.contact) : null
  if (input.contact && !contactHmac) throw new AppError('VALIDATION', { details: { fields: { contact: 'Enter a phone number or email.' } } })

  const inserted = input.userId
    ? await db.$executeRaw`
        INSERT INTO spot_watches (id, activity_id, user_id, contact_hmac)
        VALUES (gen_random_uuid(), ${input.activityId}::uuid, ${input.userId}::uuid, ${contactHmac})
        ON CONFLICT (user_id, activity_id) WHERE user_id IS NOT NULL DO NOTHING`
    : await db.$executeRaw`
        INSERT INTO spot_watches (id, activity_id, anon_id, contact_hmac)
        VALUES (gen_random_uuid(), ${input.activityId}::uuid, ${input.anonId}, ${contactHmac})
        ON CONFLICT (anon_id, activity_id) WHERE anon_id IS NOT NULL DO NOTHING`
  if (inserted > 0) {
    await recordEvent(db, { name: 'spot_watch_requested', userId: input.userId, anonId: input.anonId, platform: input.platform, activityId: input.activityId })
  }
  return { watching: true, created: inserted > 0 }
}
