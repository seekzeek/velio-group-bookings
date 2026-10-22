import { Redis } from 'ioredis'
import { config } from '../config.js'
import { logger } from '../logger.js'

export function createRedis(role: string) {
  const client = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
  client.on('error', (err) => logger.warn({ err, role }, 'redis error'))
  return client
}

export const redis = createRedis('commands')

export async function pingRedis(): Promise<boolean> {
  try {
    if (redis.status === 'wait') await redis.connect()
    return (await redis.ping()) === 'PONG'
  } catch {
    return false
  }
}
