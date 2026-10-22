import { Redis } from 'ioredis'
import { config } from '../config.js'
import { logger } from '../logger.js'

export function createRedis(role: string) {
  const client = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
  client.on('error', (err) => logger.warn({ err, role }, 'redis error'))
  return client
}

export const redis = createRedis('commands')

const connecting = new WeakMap<Redis, Promise<void>>()

// Lazy clients start in 'wait'. Connecting once, and only once even when several callers race, keeps the offline queue off without dropping the first command.
export function ensureConnected(client: Redis): Promise<void> {
  if (client.status !== 'wait' && client.status !== 'close' && client.status !== 'end') return Promise.resolve()
  let pending = connecting.get(client)
  if (!pending) {
    pending = client.connect().finally(() => connecting.delete(client))
    connecting.set(client, pending)
  }
  return pending
}

export async function pingRedis(): Promise<boolean> {
  try {
    await ensureConnected(redis)
    return (await redis.ping()) === 'PONG'
  } catch {
    return false
  }
}
