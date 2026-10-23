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

export type PickerRole = 'host' | 'booker' | 'guest'

// Hosts first, then bookers, then guests who came in through an invite. Within a role the busiest person leads, hosting then inviting then going, so the picker's starting points are the people with the most to show.
export async function listUsers(db: DbClient) {
  const users = await db.user.findMany({
    include: { _count: { select: { hostedActivities: true, sentInvites: true, bookings: { where: { status: 'confirmed' } } } } },
    orderBy: [{ displayName: 'asc' }],
  })
  const rank: Record<PickerRole, number> = { host: 0, booker: 1, guest: 2 }
  return users
    .map((u) => {
      const hosting = u._count.hostedActivities
      const going = u._count.bookings
      const role: PickerRole = hosting > 0 ? 'host' : u.generation > 0 ? 'guest' : 'booker'
      return { id: u.id, displayName: u.displayName, generation: u.generation, isHost: hosting > 0, role, hosting, going, invited: u._count.sentInvites }
    })
    .sort((a, b) => rank[a.role] - rank[b.role] || b.hosting - a.hosting || b.invited - a.invited || b.going - a.going || a.displayName.localeCompare(b.displayName))
}

export async function getUser(db: DbClient, id: string): Promise<User> {
  const user = await db.user.findUnique({ where: { id } })
  if (!user) throw new AppError('UNAUTHENTICATED')
  return user
}

export async function updatePreferences(db: DbClient, id: string, patch: { remindDayBefore?: boolean; friendUpdates?: boolean }) {
  return db.user.update({ where: { id }, data: patch })
}
