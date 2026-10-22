import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../../config.js'
import type { Db } from '../../db.js'
import { AppError } from '../../errors.js'
import { serializePhoto } from './serialize.js'

export const PHOTO_LIMIT = 6
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export type UploadedFile = { buffer: Buffer; mimetype: string; size: number }

async function requireHost(db: Db, activityId: string, hostId: string) {
  const activity = await db.activity.findUnique({ where: { id: activityId }, select: { hostId: true } })
  if (!activity) throw new AppError('NOT_FOUND')
  if (activity.hostId !== hostId) throw new AppError('FORBIDDEN')
}

// TODO: production would upload straight to object storage with a presigned URL; local disk is fine for the prototype.
export async function addPhoto(db: Db, activityId: string, hostId: string, file: UploadedFile) {
  await requireHost(db, activityId, hostId)
  const extension = extensions[file.mimetype]
  if (!extension) throw new AppError('PHOTO_TYPE')
  if (file.size > PHOTO_MAX_BYTES) throw new AppError('PHOTO_TOO_LARGE')
  const count = await db.activityPhoto.count({ where: { activityId } })
  if (count >= PHOTO_LIMIT) throw new AppError('PHOTO_LIMIT')

  const fileName = `${randomUUID()}.${extension}`
  await mkdir(config.UPLOADS_DIR, { recursive: true })
  await writeFile(path.join(config.UPLOADS_DIR, fileName), file.buffer)
  const photo = await db.activityPhoto.create({ data: { activityId, url: `/uploads/${fileName}`, position: count } })
  return serializePhoto(photo)
}

export async function removePhoto(db: Db, activityId: string, hostId: string, photoId: string) {
  await requireHost(db, activityId, hostId)
  const photo = await db.activityPhoto.findFirst({ where: { id: photoId, activityId } })
  if (!photo) throw new AppError('NOT_FOUND')
  await db.$transaction(async (tx) => {
    await tx.activityPhoto.delete({ where: { id: photo.id } })
    await tx.activityPhoto.updateMany({ where: { activityId, position: { gt: photo.position } }, data: { position: { decrement: 1 } } })
  })
  await unlink(path.join(config.UPLOADS_DIR, path.basename(photo.url))).catch(() => undefined)
}

export async function reorderPhotos(db: Db, activityId: string, hostId: string, photoIds: string[]) {
  await requireHost(db, activityId, hostId)
  const photos = await db.activityPhoto.findMany({ where: { activityId } })
  const existing = new Set(photos.map((p) => p.id))
  const wanted = new Set(photoIds)
  if (wanted.size !== photoIds.length || wanted.size !== existing.size || photoIds.some((id) => !existing.has(id))) {
    throw new AppError('VALIDATION', { details: { fields: { photoIds: 'List every photo exactly once.' } } })
  }
  await db.$transaction(photoIds.map((id, position) => db.activityPhoto.update({ where: { id }, data: { position } })))
  const ordered = await db.activityPhoto.findMany({ where: { activityId }, orderBy: { position: 'asc' } })
  return ordered.map(serializePhoto)
}
