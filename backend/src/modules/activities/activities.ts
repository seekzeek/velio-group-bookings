import type { DbClient } from '../../db.js'
import { AppError } from '../../errors.js'
import type { Category, Prisma } from '../../generated/prisma/client.js'
import { getInviteFlag, invitesEnabledFor, recordExposure, variantFor } from '../flags/flags.js'
import { joinedVia } from '../plans/serialize.js'
import { serializeActivity, type ActivityJson, type ActivityRow, type Viewer } from './serialize.js'

export type ListParams = {
  category?: Category
  hostId?: string
  sort?: 'soonest' | 'filling' | 'price'
  minSpotsLeft?: number
  from?: Date
  until?: Date
  includePast?: boolean
  excludeId?: string
}

const activityInclude = {
  host: { select: { id: true, displayName: true } },
  photos: true,
} as const

async function plansCountByActivity(db: DbClient, activityIds: string[]): Promise<Map<string, number>> {
  if (activityIds.length === 0) return new Map()
  const rows = await db.$queryRaw<{ activity_id: string; plans: bigint }[]>`
    SELECT activity_id, COUNT(DISTINCT plan_id) AS plans
    FROM bookings
    WHERE status = 'confirmed' AND activity_id = ANY(${activityIds}::uuid[])
    GROUP BY activity_id`
  return new Map(rows.map((r) => [r.activity_id, Number(r.plans)]))
}

async function viewerByActivity(db: DbClient, activityIds: string[], userId: string | null): Promise<Map<string, Viewer>> {
  if (!userId || activityIds.length === 0) return new Map()
  const bookings = await db.booking.findMany({
    where: { userId, status: 'confirmed', activityId: { in: activityIds } },
    include: { plan: { select: { ownerId: true } }, invite: { select: { rail: true } } },
  })
  return new Map(
    bookings.map((b) => [
      b.activityId,
      { bookingId: b.id, planId: b.planId, planRole: b.plan.ownerId === userId ? 'owner' : 'member', joinedVia: joinedVia(b) },
    ]),
  )
}

export async function decorateActivities(db: DbClient, rows: ActivityRow[], viewerId: string | null): Promise<ActivityJson[]> {
  const ids = rows.map((a) => a.id)
  const [plans, viewers, flag] = await Promise.all([plansCountByActivity(db, ids), viewerByActivity(db, ids, viewerId), getInviteFlag(db)])
  return rows.map((a) =>
    serializeActivity(a, {
      plansCount: plans.get(a.id) ?? 0,
      invitesEnabled: invitesEnabledFor(a.id, flag),
      viewer: viewers.get(a.id) ?? null,
    }),
  )
}

export async function listActivities(db: DbClient, params: ListParams, viewerId: string | null): Promise<ActivityJson[]> {
  const now = new Date()
  const where: Prisma.ActivityWhereInput = {
    ...(params.category ? { category: params.category } : {}),
    ...(params.hostId ? { hostId: params.hostId } : {}),
    ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    startsAt: {
      ...(params.includePast ? {} : { gt: params.from && params.from > now ? params.from : now }),
      ...(params.from && params.includePast ? { gte: params.from } : {}),
      ...(params.until ? { lte: params.until } : {}),
    },
  }
  const rows = await db.activity.findMany({ where, include: activityInclude, orderBy: { startsAt: 'asc' } })
  const filtered = params.minSpotsLeft ? rows.filter((a) => a.capacity - a.spotsTaken >= params.minSpotsLeft!) : rows
  const sorted = [...filtered]
  if (params.sort === 'filling') {
    sorted.sort((x, y) => {
      const lx = x.capacity - x.spotsTaken, ly = y.capacity - y.spotsTaken
      if ((lx === 0) !== (ly === 0)) return lx === 0 ? 1 : -1
      return lx - ly || x.startsAt.getTime() - y.startsAt.getTime()
    })
  } else if (params.sort === 'price') {
    sorted.sort((x, y) => x.priceMinor - y.priceMinor || x.startsAt.getTime() - y.startsAt.getTime())
  }
  return decorateActivities(db, sorted, viewerId)
}

export async function getActivity(
  db: DbClient,
  id: string,
  viewer: { userId: string | null; anonId?: string | null },
): Promise<ActivityJson> {
  const row = await db.activity.findUnique({ where: { id }, include: activityInclude })
  if (!row) throw new AppError('NOT_FOUND')
  const [json] = await decorateActivities(db, [row], viewer.userId)
  const flag = await getInviteFlag(db)
  await recordExposure(db, { activityId: id, userId: viewer.userId, anonId: viewer.anonId, variant: variantFor(id, flag) })
  return json!
}
