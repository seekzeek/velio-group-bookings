import type { Db } from '../../db.js'
import { AppError } from '../../errors.js'
import { decorateActivities } from '../activities/activities.js'
import { attendanceTotals } from '../activities/attendance.js'
import { joinedVia, planInclude, serializePlan } from './serialize.js'

const activityInclude = { host: { select: { id: true, displayName: true } }, photos: true } as const

export async function getPlan(db: Db, planId: string, viewerId: string) {
  const plan = await db.plan.findUnique({ where: { id: planId }, include: { ...planInclude, activity: { include: activityInclude } } })
  if (!plan) throw new AppError('NOT_FOUND')
  const isMember = plan.bookings.some((b) => b.userId === viewerId)
  if (!isMember && plan.activity.hostId !== viewerId) throw new AppError('FORBIDDEN')
  const [activity] = await decorateActivities(db, [plan.activity], viewerId)
  return { plan: serializePlan(plan), activity: activity! }
}

async function pendingVouchesByPlan(db: Db, userId: string, planIds: string[], now: Date): Promise<Map<string, number>> {
  if (planIds.length === 0) return new Map()
  const rows = await db.$queryRaw<{ plan_id: string; pending: bigint }[]>`
    SELECT i.plan_id, COUNT(*) AS pending
    FROM invites i
    WHERE i.inviter_id = ${userId}::uuid AND i.rail = 'vouch' AND i.plan_id = ANY(${planIds}::uuid[]) AND i.expires_at > ${now}
      AND NOT EXISTS (SELECT 1 FROM attributions a WHERE a.invite_id = i.id)
      AND NOT EXISTS (SELECT 1 FROM invite_revocations r WHERE r.invite_id = i.id)
    GROUP BY i.plan_id`
  return new Map(rows.map((r) => [r.plan_id, Number(r.pending)]))
}

export async function listMyPlans(db: Db, userId: string, options: { includePast?: boolean } = {}) {
  const now = new Date()
  const bookings = await db.booking.findMany({
    where: { userId, status: 'confirmed' },
    include: { plan: { include: planInclude }, activity: { include: activityInclude }, invite: { select: { rail: true } } },
    orderBy: { activity: { startsAt: 'asc' } },
  })
  const activities = await decorateActivities(db, bookings.map((b) => b.activity), userId)
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const pending = await pendingVouchesByPlan(db, userId, bookings.map((b) => b.planId), now)

  const entries = bookings.map((b) => ({
    plan: serializePlan(b.plan),
    activity: activityById.get(b.activityId)!,
    viewerRole: b.plan.ownerId === userId ? ('owner' as const) : ('member' as const),
    viewerJoinedVia: joinedVia(b),
    pendingVouches: pending.get(b.planId) ?? 0,
  }))
  const going = entries.filter((e) => new Date(e.activity.startsAt) > now)
  const past = options.includePast ? entries.filter((e) => new Date(e.activity.startsAt) <= now).reverse() : []

  const hostedRows = await db.activity.findMany({ where: { hostId: userId, startsAt: { gt: now } }, include: activityInclude, orderBy: { startsAt: 'asc' } })
  const hosted = await decorateActivities(db, hostedRows, userId)
  const hosting = await Promise.all(
    hosted.map(async (activity) => {
      const totals = await attendanceTotals(db, activity.id)
      return { activity, attendance: { plansCount: totals.plansCount, groupsOfTwoOrMore: totals.groupsOfTwoOrMore, viaInvites: totals.viaInvites } }
    }),
  )
  return { going, hosting, past }
}
