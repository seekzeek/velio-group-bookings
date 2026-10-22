import type { Db } from '../../db.js'
import { decorateActivities } from '../activities/activities.js'
import { inviteForInviterInclude, openStatsFor, serializeInviteForInviter, type InviterInviteJson } from './serialize.js'

const activityInclude = { host: { select: { id: true, displayName: true } }, photos: true } as const

export async function listMyInvites(db: Db, userId: string, options: { activityId?: string } = {}) {
  const now = new Date()
  const invites = await db.invite.findMany({
    where: { inviterId: userId, ...(options.activityId ? { activityId: options.activityId } : {}) },
    include: { ...inviteForInviterInclude, activity: { include: activityInclude } },
    orderBy: { createdAt: 'desc' },
  })
  const opens = await openStatsFor(db, invites.map((i) => i.id))
  const serialized = invites.map((i) => ({ activityId: i.activityId, planId: i.planId, json: serializeInviteForInviter(i, opens.get(i.id), now) }))

  const activityRows = [...new Map(invites.map((i) => [i.activityId, i.activity])).values()]
  const activities = await decorateActivities(db, activityRows, userId)
  const upcoming = activities.filter((a) => new Date(a.startsAt) > now).sort((x, y) => x.startsAt.localeCompare(y.startsAt) || x.title.localeCompare(y.title))
  const past = activities.filter((a) => new Date(a.startsAt) <= now).sort((x, y) => y.startsAt.localeCompare(x.startsAt) || x.title.localeCompare(y.title))

  const groupSizes = new Map<string, number>()
  const planIds = [...new Set(serialized.map((s) => s.planId).filter((p): p is string => p !== null))]
  if (planIds.length) {
    const rows = await db.booking.groupBy({ by: ['planId'], where: { planId: { in: planIds }, status: 'confirmed' }, _count: true })
    for (const r of rows) groupSizes.set(r.planId, r._count)
  }

  const groups = [...upcoming, ...past].map((activity) => {
    const mine = serialized.filter((s) => s.activityId === activity.id)
    const planId = mine.find((s) => s.planId)?.planId ?? null
    return { activity, planId, viewerGroupSize: planId ? (groupSizes.get(planId) ?? 0) : 0, invites: mine.map((s) => s.json) }
  })

  const all: InviterInviteJson[] = serialized.map((s) => s.json)
  const vouches = all.filter((i) => i.rail === 'vouch')
  const joinedCount = all.reduce((n, i) => n + i.joinedCount, 0)
  const joinedNew = invites.reduce((n, i) => n + i.attributions.filter((a) => a.inviteeWasNew).length, 0)
  return {
    summary: {
      sent: all.length,
      vouches: vouches.length,
      links: all.length - vouches.length,
      joined: joinedCount,
      joinedNew,
      waiting: vouches.filter((i) => i.status === 'not_opened' || i.status === 'opened').length,
      missed: vouches.filter((i) => i.status === 'opened_when_full' || i.status === 'expired').length,
    },
    activities: groups,
  }
}
