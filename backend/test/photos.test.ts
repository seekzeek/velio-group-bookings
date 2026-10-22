import { existsSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { config } from '../src/config.js'
import { prisma } from '../src/db.js'
import { api, createActivity, createUser, resetDb } from './helpers.js'

let kemi: Awaited<ReturnType<typeof createUser>>
let ada: Awaited<ReturnType<typeof createUser>>
let activity: Awaited<ReturnType<typeof createActivity>>

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const upload = (userId: string, buffer = png, type = 'image/png', name = 'cover.png') =>
  api.post(`/activities/${activity.id}/photos`).set('x-user-id', userId).attach('photo', buffer, { filename: name, contentType: type })

beforeAll(async () => {
  await resetDb()
  kemi = await createUser('Kemi')
  ada = await createUser('Ada')
  activity = await createActivity(kemi.id)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('activity photos', () => {
  it('uploads, serves, reorders and removes photos for the host only', async () => {
    expect((await upload(ada.id)).status).toBe(403)
    const first = await upload(kemi.id)
    expect(first.status).toBe(201)
    expect(first.body.photo).toMatchObject({ position: 0 })
    expect(first.body.photo.url).toMatch(/^http:\/\/localhost:4000\/uploads\/[0-9a-f-]+\.png$/)
    const second = await upload(kemi.id)
    expect(second.body.photo.position).toBe(1)
    const fileName = path.basename(first.body.photo.url)
    expect(existsSync(path.join(config.UPLOADS_DIR, fileName))).toBe(true)
    const served = await api.get(`/uploads/${fileName}`)
    expect(served.status).toBe(200)
    expect(served.headers['content-type']).toContain('image/png')

    const shown = await api.get(`/activities/${activity.id}`)
    expect(shown.body.activity.photos.map((p: { position: number }) => p.position)).toEqual([0, 1])

    const reordered = await api.put(`/activities/${activity.id}/photos/order`).set('x-user-id', kemi.id).send({ photoIds: [second.body.photo.id, first.body.photo.id] })
    expect(reordered.status).toBe(200)
    expect(reordered.body.photos.map((p: { id: string }) => p.id)).toEqual([second.body.photo.id, first.body.photo.id])
    expect((await api.put(`/activities/${activity.id}/photos/order`).set('x-user-id', kemi.id).send({ photoIds: [first.body.photo.id] })).status).toBe(400)

    expect((await api.delete(`/activities/${activity.id}/photos/${second.body.photo.id}`).set('x-user-id', kemi.id)).status).toBe(204)
    const after = await api.get(`/activities/${activity.id}`)
    expect(after.body.activity.photos).toEqual([expect.objectContaining({ id: first.body.photo.id, position: 0 })])
  })

  it('rejects wrong types, files over 10 MB, and more than 6', async () => {
    const wrongType = await upload(kemi.id, Buffer.from('not an image'), 'text/plain', 'notes.txt')
    expect(wrongType.status).toBe(415)
    expect(wrongType.body.error.code).toBe('PHOTO_TYPE')
    const huge = await upload(kemi.id, Buffer.alloc(10 * 1024 * 1024 + 1), 'image/jpeg', 'huge.jpg')
    expect(huge.status).toBe(413)
    expect(huge.body.error.code).toBe('PHOTO_TOO_LARGE')
    for (let i = 0; i < 5; i++) expect((await upload(kemi.id)).status).toBe(201)
    const seventh = await upload(kemi.id)
    expect(seventh.status).toBe(409)
    expect(seventh.body.error.code).toBe('PHOTO_LIMIT')
    expect((await api.post(`/activities/${activity.id}/photos`).set('x-user-id', kemi.id).send({})).status).toBe(400)
  })
})
