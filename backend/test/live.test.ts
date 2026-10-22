import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { createActivity, createUser, resetDb } from './helpers.js'
import { openSse } from './sse-client.js'

let server: Server
let base: string
let host: Awaited<ReturnType<typeof createUser>>
let bookers: Awaited<ReturnType<typeof createUser>>[]
let app: ReturnType<typeof createApp>

const book = (activityId: string, userId: string) =>
  supertest(server).post(`/activities/${activityId}/bookings`).set('x-user-id', userId).send({ idempotencyKey: randomUUID() })

beforeAll(async () => {
  await resetDb()
  host = await createUser('Kemi')
  bookers = await Promise.all(['A', 'B', 'C', 'D', 'E'].map((n) => createUser(`Booker ${n}`)))
  app = createApp({ live: { heartbeatMs: 300 } })
  server = app.listen(0)
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})

afterAll(async () => {
  await app.locals.live.close()
  server.close()
  await prisma.$disconnect()
})

describe('GET /activities/:id/stream', () => {
  it('sends a snapshot on connect with the right headers, then every booking as it commits', async () => {
    const activity = await createActivity(host.id, { capacity: 5 })
    const client = openSse(`${base}/activities/${activity.id}/stream`)
    await client.opened
    const snapshot = await client.next((e) => e.event === 'availability')
    expect(client.headers['content-type']).toContain('text/event-stream')
    expect(client.headers['cache-control']).toContain('no-cache')
    expect(client.headers['x-accel-buffering']).toBe('no')
    expect(client.headers['content-encoding']).toBeUndefined()
    expect(snapshot).toMatchObject({ id: 1, data: { activityId: activity.id, spotsTaken: 0, spotsLeft: 5, capacity: 5, version: 1 } })

    await book(activity.id, bookers[0]!.id)
    const first = await client.next((e) => e.event === 'availability' && e.id === 2)
    expect(first.data).toMatchObject({ spotsTaken: 1, spotsLeft: 4, version: 2 })
    expect(typeof first.data.at).toBe('string')

    await Promise.all([book(activity.id, bookers[1]!.id), book(activity.id, bookers[2]!.id)])
    await client.next((e) => e.event === 'availability' && e.id === 4)
    const versions = client.events.filter((e) => e.event === 'availability').map((e) => e.id)
    expect(versions).toEqual([1, 2, 3, 4])
    expect(app.locals.live.connectionCount(activity.id)).toBe(1)
    client.close()
    await sleep(50)
    expect(app.locals.live.connectionCount(activity.id)).toBe(0)
  })

  it('a client that disconnects, misses updates and reconnects converges on the right count', async () => {
    const activity = await createActivity(host.id, { capacity: 5 })
    const first = openSse(`${base}/activities/${activity.id}/stream`)
    await first.opened
    await first.next((e) => e.event === 'availability' && e.id === 1)
    await book(activity.id, bookers[0]!.id)
    await first.next((e) => e.event === 'availability' && e.id === 2)
    first.close()
    await sleep(50)

    await book(activity.id, bookers[1]!.id)
    await book(activity.id, bookers[2]!.id)

    const second = openSse(`${base}/activities/${activity.id}/stream`)
    await second.opened
    const snapshot = await second.next((e) => e.event === 'availability')
    expect(snapshot).toMatchObject({ id: 4, data: { spotsTaken: 3, spotsLeft: 2, version: 4 } })
    second.close()
  })

  it('heartbeats carry the database version, so a lost publish shows up as a gap', async () => {
    const activity = await createActivity(host.id, { capacity: 5 })
    const client = openSse(`${base}/activities/${activity.id}/stream`)
    await client.opened
    await client.next((e) => e.event === 'availability' && e.id === 1)
    // A write that never publishes, standing in for a crash between commit and publish.
    await prisma.activity.update({ where: { id: activity.id }, data: { spotsTaken: 2, version: 7 } })
    const heartbeat = await client.next((e) => e.event === 'heartbeat' && e.id === 7)
    expect(heartbeat.data).toMatchObject({ version: 7 })
    expect(client.events.some((e) => e.event === 'availability' && e.id === 7)).toBe(false)
    client.close()
  })

  it('fans one message out to every open client and ignores stale versions', async () => {
    const activity = await createActivity(host.id, { capacity: 5 })
    const clients = [1, 2, 3].map(() => openSse(`${base}/activities/${activity.id}/stream`))
    await Promise.all(clients.map((c) => c.opened))
    await Promise.all(clients.map((c) => c.next((e) => e.event === 'availability' && e.id === 1)))
    await book(activity.id, bookers[3]!.id)
    await Promise.all(clients.map((c) => c.next((e) => e.event === 'availability' && e.id === 2)))
    expect(app.locals.live.connectionCount(activity.id)).toBe(3)
    for (const c of clients) c.close()
    const metrics = await supertest(server).get('/metrics')
    expect(metrics.text).toMatch(/velio_availability_latency_seconds_count \d+/)
  })

  it('404s for an unknown activity before opening a stream', async () => {
    const res = await supertest(server).get(`/activities/${randomUUID()}/stream`)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
