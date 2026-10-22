import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { AppError } from '../errors.js'
import type { LiveHub } from '../modules/live/hub.js'

export function createStreamRouter(hub: LiveHub) {
  const router = Router({ mergeParams: true })

  router.get('/', async (req, res) => {
    const activityId = z.uuid().parse((req.params as { id?: string }).id)
    const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, spotsTaken: true, capacity: true, version: true } })
    if (!activity) throw new AppError('NOT_FOUND')
    await hub.open(res, activityId, {
      activityId,
      spotsTaken: activity.spotsTaken,
      capacity: activity.capacity,
      spotsLeft: Math.max(0, activity.capacity - activity.spotsTaken),
      version: activity.version,
      at: new Date().toISOString(),
    })
  })

  return router
}
