import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import type { RateLimiters } from '../middleware/rate-limit.js'
import type { ClaimService } from '../modules/invites/claim.js'
import { createInvite } from '../modules/invites/create.js'
import { resolveInvite } from '../modules/invites/resolve.js'
import { revokeInvite } from '../modules/invites/revoke.js'
import { optionalUserId, requireUser } from './identity.js'

const createBody = z.discriminatedUnion('rail', [
  z.object({
    rail: z.literal('vouch'),
    activityId: z.uuid(),
    recipientContact: z.string().min(3).max(120),
    recipientLabel: z.string().max(40).optional(),
    platform: z.enum(['web', 'mobile']).optional(),
  }),
  z.object({
    rail: z.literal('public'),
    activityId: z.uuid(),
    platform: z.enum(['web', 'mobile']).optional(),
  }),
])

const claimBody = z.object({
  idempotencyKey: z.string().min(8).max(128),
  displayName: z.string().min(1).max(60).optional(),
  contact: z.string().min(3).max(120).optional(),
  platform: z.enum(['web', 'mobile']).optional(),
  anonId: z.string().min(8).max(64).optional(),
})

const revokeBody = z.object({ reason: z.string().max(60).optional() }).optional()

export function createInviteRoutes(claims: ClaimService, limits: RateLimiters) {
  const router = Router()

  router.post('/', async (req, res) => {
    const user = await requireUser(prisma, req)
    const body = createBody.parse(req.body)
    const result = await createInvite(prisma, { ...body, inviterId: user.id })
    res.status(result.created ? 201 : 200).json(result)
  })

  router.get('/:code', limits.lookup, async (req, res) => {
    res.json(await resolveInvite(prisma, String(req.params.code), optionalUserId(req)))
  })

  router.post('/:code/claim', limits.claim, async (req, res) => {
    const body = claimBody.parse(req.body)
    const result = await claims.claimInvite(prisma, { ...body, code: String(req.params.code), viewerId: optionalUserId(req) })
    res.status(result.replayed ? 200 : 201).json(result)
  })

  router.post('/:code/revoke', async (req, res) => {
    const user = await requireUser(prisma, req)
    const body = revokeBody.parse(req.body ?? {})
    res.json(await revokeInvite(prisma, { code: String(req.params.code), inviterId: user.id, reason: body?.reason }))
  })

  return router
}
