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

// Lazy clients start in 'wait'. The offline queue is off, so every caller waits here until the client is ready, and only one of them starts the connection.
export function ensureConnected(client: Redis): Promise<void> {
  if (client.status === 'ready') return Promise.resolve()
  let pending = connecting.get(client)
  if (!pending) {
    const needsConnect = client.status === 'wait' || client.status === 'close' || client.status === 'end'
    pending = (needsConnect
      ? client.connect()
      : new Promise<void>((resolve, reject) => {
          client.once('ready', resolve)
          client.once('end', () => reject(new Error('redis connection ended')))
        })
    ).finally(() => connecting.delete(client))
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
