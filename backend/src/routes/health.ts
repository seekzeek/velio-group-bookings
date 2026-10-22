import { Router } from 'express'
import { prisma } from '../db.js'
import { checkHealth } from '../modules/tracking/health.js'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  const health = await checkHealth(prisma)
  res.status(health.ok ? 200 : 503).json(health)
})
