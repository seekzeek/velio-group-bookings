import type { Redis } from 'ioredis'
import { config } from '../../config.js'
import { ensureConnected } from '../../lib/redis.js'
import { logger } from '../../logger.js'
import type { Committed } from '../booking/booking.js'

export type AvailabilityMessage = {
  activityId: string
  spotsTaken: number
  capacity: number
  spotsLeft: number
  version: number
  at: string
}

export const channelPattern = `${config.REDIS_CHANNEL_PREFIX}:availability:*`

export function channelFor(activityId: string) {
  return `${config.REDIS_CHANNEL_PREFIX}:availability:${activityId}`
}

export function toMessage(change: Committed): AvailabilityMessage {
  return { activityId: change.activityId, ...change.counts, at: change.committedAt.toISOString() }
}

// Called only after the transaction committed. A failed publish is logged, not raised: the heartbeat will carry the version.
export function publishAvailability(redis: Redis, change: Committed): void {
  const message = toMessage(change)
  ensureConnected(redis)
    .then(() => redis.publish(channelFor(change.activityId), JSON.stringify(message)))
    .catch((err) => logger.warn({ err, activityId: change.activityId }, 'availability publish failed'))
}
