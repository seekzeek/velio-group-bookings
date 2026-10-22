import type { Booking, Invite, Plan, User } from '../../generated/prisma/client.js'

type Person = Pick<User, 'id' | 'displayName'>

export type MemberBooking = Booking & { user: Person; invite: (Pick<Invite, 'rail'> & { inviter: Person }) | null }

export type PlanRow = Plan & { owner: Person; bookings: MemberBooking[] }

export function joinedVia(b: { invite: { rail: 'vouch' | 'public' } | null }) {
  return b.invite ? b.invite.rail : ('direct' as const)
}

export function serializeMember(b: MemberBooking, plan: Pick<Plan, 'ownerId'>) {
  return {
    userId: b.user.id,
    displayName: b.user.displayName,
    role: b.userId === plan.ownerId ? ('owner' as const) : ('member' as const),
    joinedVia: joinedVia(b),
    invitedBy: b.invite ? { id: b.invite.inviter.id, displayName: b.invite.inviter.displayName } : null,
    joinedAt: b.createdAt.toISOString(),
  }
}

export function serializePlan(plan: PlanRow) {
  const members = plan.bookings
    .filter((b) => b.status === 'confirmed')
    .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
    .map((b) => serializeMember(b, plan))
  return {
    id: plan.id,
    activityId: plan.activityId,
    owner: { id: plan.owner.id, displayName: plan.owner.displayName },
    members,
    membersCount: members.length,
    createdAt: plan.createdAt.toISOString(),
  }
}

export const planInclude = {
  owner: { select: { id: true, displayName: true } },
  bookings: {
    where: { status: 'confirmed' as const },
    include: {
      user: { select: { id: true, displayName: true } },
      invite: { select: { rail: true, inviter: { select: { id: true, displayName: true } } } },
    },
  },
} as const
