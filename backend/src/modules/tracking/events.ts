import type { DbClient } from '../../db.js'
import type { Platform, Rail } from '../../generated/prisma/client.js'

export type EventInput = {
  name: string
  userId?: string | null
  anonId?: string | null
  platform?: Platform | null
  activityId?: string | null
  inviteId?: string | null
  rail?: Rail | null
  props?: Record<string, unknown>
  occurredAt?: Date
}

// Pass the transaction client for events that record a state change, so they roll back with it.
export async function recordEvent(db: DbClient, event: EventInput): Promise<void> {
  await db.event.create({
    data: {
      name: event.name,
      userId: event.userId ?? null,
      anonId: event.anonId ?? null,
      platform: event.platform ?? null,
      activityId: event.activityId ?? null,
      inviteId: event.inviteId ?? null,
      rail: event.rail ?? null,
      props: (event.props ?? {}) as object,
      ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),
    },
  })
}
