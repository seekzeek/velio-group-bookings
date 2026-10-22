import type { Request } from 'express'
import { z } from 'zod'
import type { DbClient } from '../db.js'
import { AppError } from '../errors.js'
import { getUser } from '../modules/users/users.js'

const uuid = z.uuid()

export function optionalUserId(req: Request): string | null {
  const header = req.header('x-user-id')
  if (!header) return null
  const parsed = uuid.safeParse(header)
  if (!parsed.success) throw new AppError('UNAUTHENTICATED')
  return parsed.data
}

export async function requireUser(db: DbClient, req: Request) {
  const id = optionalUserId(req)
  if (!id) throw new AppError('UNAUTHENTICATED')
  return getUser(db, id)
}
