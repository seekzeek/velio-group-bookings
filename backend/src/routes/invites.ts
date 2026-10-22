import { Router } from 'express'
import { prisma } from '../db.js'
import { resolveInvite } from '../modules/invites/resolve.js'
import { optionalUserId } from './identity.js'

export const invitesRouter = Router()

invitesRouter.get('/:code', async (req, res) => {
  const invite = await resolveInvite(prisma, String(req.params.code), optionalUserId(req))
  res.json(invite)
})
