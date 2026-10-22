import type { Db } from '../../db.js'
import { AppError } from '../../errors.js'
import { planInclude, serializePlan } from '../plans/serialize.js'
import { getActivity } from './activities.js'

export type AttendanceTotals = {
  booked: number
  capacity: number
  spotsLeft: number
  version: number
  plansCount: number
  groupsOfTwoOrMore: number
  viaInvites: { total: number; vouch: number; public: number }
}

export async function attendanceTotals(db: Db, activityId: string): Promise<AttendanceTotals> {
  const [activity, plans] = await Promise.all([
    db.activity.findUniqueOrThrow({ where: { id: activityId }, select: { capacity: true, spotsTaken: true, version: true } }),
    db.plan.findMany({ where: { activityId }, include: planInclude }),
  ])
  const live = plans.filter((p) => p.bookings.length > 0)
  const members = live.flatMap((p) => p.bookings)
  const vouch = members.filter((b) => b.invite?.rail === 'vouch').length
  const pub = members.filter((b) => b.invite?.rail === 'public').length
  return {
    booked: activity.spotsTaken,
    capacity: activity.capacity,
    spotsLeft: Math.max(0, activity.capacity - activity.spotsTaken),
    version: activity.version,
    plansCount: live.length,
    groupsOfTwoOrMore: live.filter((p) => p.bookings.length >= 2).length,
    viaInvites: { total: vouch + pub, vouch, public: pub },
  }
}

export async function getAttendance(db: Db, activityId: string, viewerId: string) {
  const row = await db.activity.findUnique({ where: { id: activityId }, select: { hostId: true } })
  if (!row) throw new AppError('NOT_FOUND')
  if (row.hostId !== viewerId) throw new AppError('FORBIDDEN')

  const [activity, totals, plans] = await Promise.all([
    getActivity(db, activityId, { userId: viewerId }),
    attendanceTotals(db, activityId),
    db.plan.findMany({ where: { activityId }, include: planInclude }),
  ])
  const serialized = plans
    .filter((p) => p.bookings.length > 0)
    .map((p) => {
      const plan = serializePlan(p)
      const latestJoinAt = plan.members.reduce((max, m) => (m.joinedAt > max ? m.joinedAt : max), plan.members[0]!.joinedAt)
      return { ...plan, latestJoinAt }
    })
    .sort((a, b) => b.membersCount - a.membersCount || a.createdAt.localeCompare(b.createdAt))
  return { activity, totals, plans: serialized }
}
