import { config } from '../../config.js'
import type { Activity, ActivityPhoto, Rail, User } from '../../generated/prisma/client.js'

export type ActivityRow = Activity & { host: Pick<User, 'id' | 'displayName'>; photos: ActivityPhoto[] }

export type Viewer = { bookingId: string; planId: string; planRole: 'owner' | 'member'; joinedVia: 'direct' | Rail }

export type ActivityJson = ReturnType<typeof serializeActivity>

export function activityStatus(a: Pick<Activity, 'startsAt' | 'capacity' | 'spotsTaken'>, now = new Date()) {
  if (a.startsAt <= now) return 'started' as const
  return a.spotsTaken >= a.capacity ? ('full' as const) : ('open' as const)
}

export function serializePhoto(p: ActivityPhoto) {
  return { id: p.id, url: p.url.startsWith('http') ? p.url : `${config.PUBLIC_API_URL}${p.url}`, position: p.position }
}

export function serializeActivity(
  a: ActivityRow,
  extra: { plansCount: number; invitesEnabled: boolean; viewer: Viewer | null },
) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    illustration: a.illustration,
    location: a.location,
    startsAt: a.startsAt.toISOString(),
    timezone: a.timezone,
    price: { amountMinor: a.priceMinor, currency: a.currency },
    capacity: a.capacity,
    spotsTaken: a.spotsTaken,
    spotsLeft: Math.max(0, a.capacity - a.spotsTaken),
    version: a.version,
    status: activityStatus(a),
    host: { id: a.host.id, displayName: a.host.displayName },
    photos: [...a.photos].sort((x, y) => x.position - y.position).map(serializePhoto),
    plansCount: extra.plansCount,
    invitesEnabled: extra.invitesEnabled,
    viewer: extra.viewer,
    createdAt: a.createdAt.toISOString(),
  }
}
