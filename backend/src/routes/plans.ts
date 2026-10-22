import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { getPlan } from '../modules/plans/plans.js'
import { requireUser } from './identity.js'

export const plansRouter = Router()

plansRouter.get('/:id', async (req, res) => {
  const user = await requireUser(prisma, req)
  const id = z.uuid().parse(req.params.id)
  res.json(await getPlan(prisma, id, user.id))
})
