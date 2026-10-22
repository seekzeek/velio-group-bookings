import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { listUsers, serializeUser, updatePreferences } from '../modules/users/users.js'
import { requireUser } from './identity.js'

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

meRouter.patch('/preferences', async (req, res) => {
  const user = await requireUser(prisma, req)
  const updated = await updatePreferences(prisma, user.id, preferencesBody.parse(req.body))
  res.json({ user: serializeUser(updated) })
})
