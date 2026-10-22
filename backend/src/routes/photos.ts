import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../db.js'
import { AppError } from '../errors.js'
import { PHOTO_MAX_BYTES, addPhoto, removePhoto, reorderPhotos } from '../modules/activities/photos.js'
import { requireUser } from './identity.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PHOTO_MAX_BYTES, files: 1 } })

export const photosRouter = Router({ mergeParams: true })

const activityId = (params: unknown) => z.uuid().parse((params as { id?: string }).id)

photosRouter.post('/', (req, res, next) => {
  upload.single('photo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 'PHOTO_TOO_LARGE' : 'VALIDATION', { details: { fields: { photo: err.message } } }))
    }
    next(err)
  })
}, async (req, res) => {
  const host = await requireUser(prisma, req)
  if (!req.file) throw new AppError('VALIDATION', { details: { fields: { photo: 'Attach one photo in the "photo" field.' } } })
  const photo = await addPhoto(prisma, activityId(req.params), host.id, req.file)
  res.status(201).json({ photo })
})

photosRouter.delete('/:photoId', async (req, res) => {
  const host = await requireUser(prisma, req)
  await removePhoto(prisma, activityId(req.params), host.id, z.uuid().parse(req.params.photoId))
  res.status(204).end()
})

photosRouter.put('/order', async (req, res) => {
  const host = await requireUser(prisma, req)
  const body = z.object({ photoIds: z.array(z.uuid()).min(1) }).parse(req.body)
  res.json({ photos: await reorderPhotos(prisma, activityId(req.params), host.id, body.photoIds) })
})
