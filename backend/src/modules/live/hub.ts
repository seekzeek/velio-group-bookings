import type { Response } from 'express'
import type { Redis } from 'ioredis'
import type { Db } from '../../db.js'
import { createRedis, ensureConnected } from '../../lib/redis.js'
import { logger } from '../../logger.js'
import { metrics } from '../tracking/metrics.js'
import { channelPattern, type AvailabilityMessage } from './publish.js'

export type LiveHubOptions = { heartbeatMs?: number; subscriber?: Redis }

type Client = { res: Response; lastVersion: number }

export type LiveHub = ReturnType<typeof createLiveHub>

function writeEvent(res: Response, event: string, id: number, data: unknown) {
  res.write(`event: ${event}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`)
}

// One Redis subscriber per process. Messages fan out in memory to the open responses for that activity.
export function createLiveHub(db: Db, options: LiveHubOptions = {}) {
  const heartbeatMs = options.heartbeatMs ?? 15_000
  const subscriber = options.subscriber ?? createRedis('subscriber')
  const clients = new Map<string, Set<Client>>()
  let ready: Promise<void> | null = null
  let heartbeat: NodeJS.Timeout | null = null

  function ensureSubscribed(): Promise<void> {
    if (!ready) {
      ready = (async () => {
        await ensureConnected(subscriber)
        await subscriber.psubscribe(channelPattern)
        subscriber.on('pmessage', (_pattern, _channel, raw) => deliver(raw))
        heartbeat = setInterval(() => void sendHeartbeats(), heartbeatMs)
        heartbeat.unref()
      })().catch((err) => {
        ready = null
        throw err
      })
    }
    return ready
  }

  function deliver(raw: string) {
    let message: AvailabilityMessage
    try {
      message = JSON.parse(raw) as AvailabilityMessage
    } catch {
      return
    }
    const set = clients.get(message.activityId)
    if (!set) return
    const sentAt = Date.parse(message.at)
    for (const client of set) {
      if (message.version <= client.lastVersion) continue
      client.lastVersion = message.version
      writeEvent(client.res, 'availability', message.version, message)
      if (!Number.isNaN(sentAt)) metrics.availabilityLatency.observe((Date.now() - sentAt) / 1000)
    }
  }

  // The heartbeat carries the version straight from the database, so a client that missed a publish notices the gap and refetches.
  async function sendHeartbeats() {
    const ids = [...clients.keys()]
    if (ids.length === 0) return
    try {
      const rows = await db.activity.findMany({ where: { id: { in: ids } }, select: { id: true, version: true } })
      const at = new Date().toISOString()
      for (const row of rows) {
        for (const client of clients.get(row.id) ?? []) {
          writeEvent(client.res, 'heartbeat', row.version, { version: row.version, at })
        }
      }
    } catch (err) {
      logger.warn({ err }, 'heartbeat query failed')
    }
  }

  async function open(res: Response, activityId: string, snapshot: AvailabilityMessage) {
    await ensureSubscribed()
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()
    res.write(`retry: 3000\n\n`)

    const client: Client = { res, lastVersion: snapshot.version }
    writeEvent(res, 'availability', snapshot.version, snapshot)

    let set = clients.get(activityId)
    if (!set) clients.set(activityId, (set = new Set()))
    set.add(client)
    metrics.sseConnections.inc()

    res.on('close', () => {
      set!.delete(client)
      if (set!.size === 0) clients.delete(activityId)
      metrics.sseConnections.dec()
    })
  }

  function connectionCount(activityId?: string) {
    if (activityId) return clients.get(activityId)?.size ?? 0
    let n = 0
    for (const set of clients.values()) n += set.size
    return n
  }

  async function close() {
    if (heartbeat) clearInterval(heartbeat)
    for (const set of clients.values()) for (const c of set) c.res.end()
    clients.clear()
    await subscriber.quit().catch(() => undefined)
  }

  return { open, close, connectionCount, sendHeartbeats, ensureSubscribed }
}
