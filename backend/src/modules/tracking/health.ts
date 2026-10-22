import type { DbClient } from '../../db.js'
import { pingRedis } from '../../lib/redis.js'

export async function checkHealth(db: DbClient) {
  const [postgres, redis] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(() => true, () => false),
    pingRedis(),
  ])
  return { ok: postgres && redis, postgres: postgres ? 'up' : 'down', redis: redis ? 'up' : 'down' } as const
}
