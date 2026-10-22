import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { getScenarioDb } from '../lib/scenario-db.js'
import { HOLDOUT_PERCENT, getInviteFlag, isHoldout, setInviteFlag, type InviteFlag } from '../modules/flags/flags.js'
import { computeHealth } from '../modules/tracking/goals.js'

export const adminRouter = Router()

const healthQuery = z.object({
  source: z.enum(['live', 'scenario']).default('live'),
  windowDays: z.coerce.number().int().min(1).max(365).default(30),
  minSample: z.coerce.number().int().min(0).optional(),
})

adminRouter.get('/health', async (req, res) => {
  const q = healthQuery.parse(req.query)
  const scenarioDb = q.source === 'scenario' ? getScenarioDb() : null
  const source = scenarioDb ? 'scenario' : 'live'
  const report = await computeHealth(scenarioDb ?? prisma, { source, windowDays: q.windowDays, minSample: q.minSample ?? null })
  res.json({ ...report, scenarioAvailable: getScenarioDb() !== null })
})

async function flagsView(flag: InviteFlag) {
  const activities = await prisma.activity.findMany({ select: { id: true } })
  return {
    invites: {
      enabled: flag.enabled,
      rolloutPercent: flag.rolloutPercent,
      holdoutPercent: HOLDOUT_PERCENT,
      holdoutActivityIds: activities.map((a) => a.id).filter(isHoldout),
    },
  }
}

adminRouter.get('/flags', async (_req, res) => {
  res.json(await flagsView(await getInviteFlag(prisma)))
})

const patchBody = z.object({ enabled: z.boolean().optional(), rolloutPercent: z.number().int().min(0).max(100).optional() }).refine((b) => b.enabled !== undefined || b.rolloutPercent !== undefined, { message: 'Send enabled or rolloutPercent.' })

adminRouter.patch('/flags/invites', async (req, res) => {
  const body = patchBody.parse(req.body)
  res.json(await flagsView(await setInviteFlag(prisma, body)))
})
