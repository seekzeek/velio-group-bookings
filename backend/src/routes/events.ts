import { Router } from 'express'
import { prisma } from '../db.js'
import { clientEventSchema, recordClientEvent } from '../modules/tracking/client-events.js'
import { optionalUserId } from './identity.js'

export const eventsRouter = Router()

eventsRouter.post('/', async (req, res) => {
  const event = clientEventSchema.parse(req.body)
  await recordClientEvent(prisma, event, optionalUserId(req))
  res.status(202).json({})
})
