import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { getActivity, listActivities } from '../modules/activities/activities.js'
import { getAttendance } from '../modules/activities/attendance.js'
import { watchActivity } from '../modules/activities/watch.js'
import { createActivity, updateActivity } from '../modules/activities/write.js'
import { optionalUserId, requireUser } from './identity.js'

const bool = z.enum(['true', 'false']).transform((v) => v === 'true')
const category = z.enum(['outdoors', 'nights_out', 'food_and_drink', 'classes', 'other'])

const listQuery = z.object({
  category: category.optional(),
  hostId: z.union([z.literal('me'), z.uuid()]).optional(),
  sort: z.enum(['soonest', 'filling', 'price']).optional(),
  minSpotsLeft: z.coerce.number().int().min(0).optional(),
  from: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  includePast: bool.optional(),
  excludeId: z.uuid().optional(),
})

const getQuery = z.object({ anonId: z.string().min(8).max(64).optional() })

const activityBody = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(2000).default(''),
  category,
  location: z.string().trim().min(1).max(200),
  startsAt: z.string().optional(),
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/).optional(),
  timezone: z.string().min(1).max(64),
  price: z.object({ amountMinor: z.number().int().min(0).max(100_000_000), currency: z.string().length(3) }),
  capacity: z.number().int().min(1).max(500),
})

const watchBody = z.object({
  anonId: z.string().min(8).max(64).optional(),
  contact: z.string().min(3).max(120).optional(),
  platform: z.enum(['web', 'mobile']).optional(),
})

export const activitiesRouter = Router()

activitiesRouter.get('/', async (req, res) => {
  const viewerId = optionalUserId(req)
  const q = listQuery.parse(req.query)
  const hostId = q.hostId === 'me' ? (viewerId ?? undefined) : q.hostId
  const activities = await listActivities(prisma, { ...q, hostId }, viewerId)
  res.json({ activities })
})

activitiesRouter.post('/', async (req, res) => {
  const host = await requireUser(prisma, req)
  const body = activityBody.parse(req.body)
  res.status(201).json({ activity: await createActivity(prisma, host.id, body) })
})

activitiesRouter.get('/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const q = getQuery.parse(req.query)
  const activity = await getActivity(prisma, id, { userId: optionalUserId(req), anonId: q.anonId })
  res.json({ activity })
})

activitiesRouter.patch('/:id', async (req, res) => {
  const host = await requireUser(prisma, req)
  const id = z.uuid().parse(req.params.id)
  const body = activityBody.partial().parse(req.body)
  res.json({ activity: await updateActivity(prisma, id, host.id, body) })
})

activitiesRouter.get('/:id/attendance', async (req, res) => {
  const host = await requireUser(prisma, req)
  const id = z.uuid().parse(req.params.id)
  res.json(await getAttendance(prisma, id, host.id))
})

activitiesRouter.post('/:id/watch', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const body = watchBody.parse(req.body ?? {})
  const result = await watchActivity(prisma, { activityId: id, userId: optionalUserId(req), ...body })
  res.status(result.created ? 201 : 200).json({ watching: result.watching })
})
