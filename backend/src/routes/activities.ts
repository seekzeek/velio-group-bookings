import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { getActivity, listActivities } from '../modules/activities/activities.js'
import { optionalUserId } from './identity.js'

const bool = z.enum(['true', 'false']).transform((v) => v === 'true')

const listQuery = z.object({
  category: z.enum(['outdoors', 'nights_out', 'food_and_drink', 'classes', 'other']).optional(),
  hostId: z.union([z.literal('me'), z.uuid()]).optional(),
  sort: z.enum(['soonest', 'filling', 'price']).optional(),
  minSpotsLeft: z.coerce.number().int().min(0).optional(),
  from: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  includePast: bool.optional(),
  excludeId: z.uuid().optional(),
})

const getQuery = z.object({ anonId: z.string().min(8).max(64).optional() })

export const activitiesRouter = Router()

activitiesRouter.get('/', async (req, res) => {
  const viewerId = optionalUserId(req)
  const q = listQuery.parse(req.query)
  const hostId = q.hostId === 'me' ? (viewerId ?? undefined) : q.hostId
  const activities = await listActivities(prisma, { ...q, hostId }, viewerId)
  res.json({ activities })
})

activitiesRouter.get('/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const q = getQuery.parse(req.query)
  const activity = await getActivity(prisma, id, { userId: optionalUserId(req), anonId: q.anonId })
  res.json({ activity })
})
