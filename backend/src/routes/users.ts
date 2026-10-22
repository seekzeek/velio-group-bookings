import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { listMyInvites } from '../modules/invites/list.js'
import { listMyPlans } from '../modules/plans/plans.js'
import { listUsers, serializeUser, updatePreferences } from '../modules/users/users.js'
import { requireUser } from './identity.js'

const bool = z.enum(['true', 'false']).transform((v) => v === 'true')

export const usersRouter = Router()
export const meRouter = Router()

usersRouter.get('/', async (_req, res) => {
  res.json({ users: await listUsers(prisma) })
})

meRouter.get('/', async (req, res) => {
  const user = await requireUser(prisma, req)
  res.json({ user: serializeUser(user) })
})

const preferencesBody = z.object({ remindDayBefore: z.boolean().optional(), friendUpdates: z.boolean().optional() })

meRouter.get('/plans', async (req, res) => {
  const user = await requireUser(prisma, req)
  const q = z.object({ includePast: bool.optional() }).parse(req.query)
  res.json(await listMyPlans(prisma, user.id, { includePast: q.includePast }))
})

meRouter.get('/invites', async (req, res) => {
  const user = await requireUser(prisma, req)
  const q = z.object({ activityId: z.uuid().optional() }).parse(req.query)
  res.json(await listMyInvites(prisma, user.id, { activityId: q.activityId }))
})

meRouter.patch('/preferences', async (req, res) => {
  const user = await requireUser(prisma, req)
  const updated = await updatePreferences(prisma, user.id, preferencesBody.parse(req.body))
  res.json({ user: serializeUser(updated) })
})
