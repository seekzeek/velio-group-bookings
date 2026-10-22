import type { DbClient } from '../../db.js'
import { AppError } from '../../errors.js'
import type { User } from '../../generated/prisma/client.js'

export function serializeUser(u: User) {
  return {
    id: u.id,
    displayName: u.displayName,
    generation: u.generation,
    remindDayBefore: u.remindDayBefore,
    friendUpdates: u.friendUpdates,
    hasContact: u.contactHmac !== null,
    createdAt: u.createdAt.toISOString(),
  }
}

export async function listUsers(db: DbClient) {
  const users = await db.user.findMany({
    include: { _count: { select: { hostedActivities: true } } },
    orderBy: [{ displayName: 'asc' }],
  })
  return users
    .map((u) => ({ id: u.id, displayName: u.displayName, generation: u.generation, isHost: u._count.hostedActivities > 0 }))
    .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.displayName.localeCompare(b.displayName))
}

export async function getUser(db: DbClient, id: string): Promise<User> {
  const user = await db.user.findUnique({ where: { id } })
  if (!user) throw new AppError('UNAUTHENTICATED')
  return user
}

export async function updatePreferences(db: DbClient, id: string, patch: { remindDayBefore?: boolean; friendUpdates?: boolean }) {
  return db.user.update({ where: { id }, data: patch })
}
