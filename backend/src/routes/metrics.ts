import { Router } from 'express'
import { registry } from '../modules/tracking/metrics.js'

export const metricsRouter = Router()

metricsRouter.get('/', async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType)
  res.send(await registry.metrics())
})
