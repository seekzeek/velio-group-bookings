// Loads the sample world from the design canvas: Sunset Kayaking hosted by Kemi with Ada's, Femi's and Ife's groups,
// the other Explore activities, a full one, one in the holdout, and Ada's invites from the My invites screen.
// Dates are relative to today so the demo keeps working. Run with `npm run seed`. It wipes the target database first.

import { prisma } from '../src/db.js'
import { deterministicUuid, deterministicUuidWhere } from '../src/lib/ids.js'
import { localToUtc } from '../src/lib/time.js'
import { activityBucket, isHoldout } from '../src/modules/flags/flags.js'
import { displayCode } from '../src/modules/invites/codes.js'
import { hmacContact, normalizeContact } from '../src/modules/invites/contacts.js'
import type { Category, Illustration, Platform, Rail } from '../src/generated/prisma/client.js'

const TZ = 'Africa/Lagos'
const now = new Date()
const HOUR = 3_600_000
const DAY = 24 * HOUR

const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * HOUR)
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

function nextSaturdayAfter(days: number) {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + days)
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1)
  return d
}
function thursdayBefore(days: number) {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - days)
  while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() - 1)
  return d
}
function shift(date: Date, days: number) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}
const localAt = (date: Date, time: string) => localToUtc(`${date.toISOString().slice(0, 10)}T${time}`, TZ)

const anchor = nextSaturdayAfter(8)

type UserKey =
  | 'kemi' | 'ada' | 'tunde' | 'chioma' | 'femi' | 'zara' | 'bisi' | 'leo' | 'ife' | 'dayo'
  | 'bayo' | 'musa' | 'tobi' | 'ngozi' | 'mira' | 'diego'

const users: Record<UserKey, { name: string; generation: number; createdAt: Date }> = {
  kemi: { name: 'Kemi', generation: 0, createdAt: ago(60) },
  ada: { name: 'Ada', generation: 0, createdAt: ago(45) },
  femi: { name: 'Femi', generation: 0, createdAt: ago(40) },
  bayo: { name: 'Bayo', generation: 0, createdAt: ago(30) },
  musa: { name: 'Musa', generation: 0, createdAt: ago(28) },
  tobi: { name: 'Tobi', generation: 0, createdAt: ago(55) },
  ngozi: { name: 'Ngozi', generation: 0, createdAt: ago(50) },
  mira: { name: 'Mira', generation: 0, createdAt: ago(48) },
  diego: { name: 'Diego', generation: 0, createdAt: ago(35) },
  tunde: { name: 'Tunde', generation: 1, createdAt: ago(8) },
  chioma: { name: 'Chioma', generation: 1, createdAt: minutesAgo(3) },
  zara: { name: 'Zara', generation: 1, createdAt: ago(8) },
  bisi: { name: 'Bisi', generation: 1, createdAt: ago(7) },
  leo: { name: 'Leo', generation: 1, createdAt: ago(6) },
  ife: { name: 'Ife', generation: 1, createdAt: ago(10) },
  dayo: { name: 'Dayo', generation: 2, createdAt: ago(5) },
}
const uid = (key: UserKey) => deterministicUuid(`user:${key}`)
const contactFor = (key: UserKey) => `${key}@example.com`

type ActivityKey = 'kayakSat' | 'speakeasy' | 'hike' | 'kayakSun' | 'pottery' | 'salsa' | 'moonlight' | 'streetFood' | 'boardGame'

const activities: Record<ActivityKey, {
  title: string; host: UserKey; category: Category; illustration: Illustration; description: string
  location: string; startsAt: Date; priceMinor: number; capacity: number; holdout?: boolean; createdAt: Date
}> = {
  kayakSat: {
    title: 'Sunset Kayaking', host: 'kemi', category: 'outdoors', illustration: 'kayak',
    description: 'Two hours on calm water as the sun goes down. Boats, paddles and a guide included. No experience needed, just bring something you don\'t mind getting splashed.',
    location: 'Harbour jetty, pier 3', startsAt: localAt(anchor, '17:30'), priceMinor: 4500, capacity: 12, createdAt: ago(14),
  },
  speakeasy: {
    title: 'Secret Speakeasy Tour', host: 'tobi', category: 'nights_out', illustration: 'speakeasy',
    description: 'Three hidden bars, one password each. First drink at every stop is on the house.',
    location: 'Under the clock, Marina', startsAt: localAt(shift(anchor, -1), '21:00'), priceMinor: 3500, capacity: 10, createdAt: ago(12),
  },
  hike: {
    title: 'Sunrise Hike', host: 'ngozi', category: 'outdoors', illustration: 'hike', holdout: true,
    description: 'An easy 6 km loop timed so we reach the ridge as the sun comes up. Tea at the top.',
    location: 'Trailhead car park, Lekki Conservation Centre', startsAt: localAt(shift(anchor, 1), '06:00'), priceMinor: 2000, capacity: 15, createdAt: ago(11),
  },
  kayakSun: {
    title: 'Sunset Kayaking', host: 'kemi', category: 'outdoors', illustration: 'kayak',
    description: 'Two hours on calm water as the sun goes down. Boats, paddles and a guide included. No experience needed.',
    location: 'Harbour jetty, pier 3', startsAt: localAt(shift(anchor, 1), '17:30'), priceMinor: 4500, capacity: 12, createdAt: ago(14),
  },
  pottery: {
    title: 'Pottery Night', host: 'mira', category: 'classes', illustration: 'pottery',
    description: 'Throw your first bowl on the wheel. Clay, aprons and firing included. Pick it up glazed two weeks later.',
    location: 'Studio 4, Yaba', startsAt: localAt(shift(anchor, 4), '19:00'), priceMinor: 4000, capacity: 8, createdAt: ago(13),
  },
  salsa: {
    title: 'Rooftop Salsa', host: 'diego', category: 'nights_out', illustration: 'salsa',
    description: 'A beginner class under the lights, then open dancing until late. Come alone or bring a partner.',
    location: 'The Roof, Victoria Island', startsAt: localAt(shift(anchor, 5), '19:30'), priceMinor: 2500, capacity: 10, createdAt: ago(10),
  },
  moonlight: {
    title: 'Moonlight Paddle', host: 'kemi', category: 'outdoors', illustration: 'kayak',
    description: 'The same calm water as the sunset trip, but after dark with headlamps and a full moon.',
    location: 'Harbour jetty, pier 3', startsAt: localAt(shift(anchor, 6), '20:00'), priceMinor: 5000, capacity: 12, createdAt: ago(9),
  },
  streetFood: {
    title: 'Street Food Walk', host: 'femi', category: 'food_and_drink', illustration: 'market',
    description: 'Six stops through the market, from suya to puff-puff. Come hungry, leave full.',
    location: 'Balogun market gate', startsAt: localAt(shift(anchor, 7), '11:00'), priceMinor: 3000, capacity: 12, createdAt: ago(9),
  },
  boardGame: {
    title: 'Board Game Night', host: 'tobi', category: 'other', illustration: 'other',
    description: 'A shelf of games and people who know the rules. Snacks included.',
    location: 'Café Neo, Ikoyi', startsAt: localAt(thursdayBefore(14), '19:00'), priceMinor: 1500, capacity: 8, createdAt: ago(25),
  },
}
const aid = (key: ActivityKey) =>
  deterministicUuidWhere(`activity:${key}`, (id) => isHoldout(id) === Boolean(activities[key].holdout))

type Member = { user: UserKey; via: 'direct' | { invite: string }; at: Date }
type PlanSeed = { key: string; activity: ActivityKey; owner: UserKey; members: Member[] }

type InviteSeed = {
  code: string; rail: Rail; inviter: UserKey; activity: ActivityKey; plan: string | null
  recipient?: string; label?: string; createdAt: Date
  opens?: { at: Date; spotsLeft: number; anonId?: string; platform?: Platform }[]
}

const invites: InviteSeed[] = [
  // Ada's invites on Sunset Kayaking, as on the My invites screen.
  { code: 'BQ7N4XKD', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: contactFor('tunde'), label: 'Tunde', createdAt: ago(9), opens: [{ at: ago(8, 1), spotsLeft: 7, platform: 'mobile' }] },
  { code: 'CH3M9WRT', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: contactFor('chioma'), label: 'Chioma', createdAt: ago(3), opens: [{ at: minutesAgo(20), spotsLeft: 2, platform: 'mobile' }] },
  { code: 'AX7K29QM', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: 'dami@example.com', label: 'Dami', createdAt: ago(2), opens: [{ at: ago(1), spotsLeft: 2, platform: 'mobile' }] },
  { code: 'BG5K2YNP', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: '+1 415 555 0133', label: 'Bola', createdAt: ago(1) },
  { code: 'M2QW7HTA', rail: 'public', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', label: 'Group chat link', createdAt: ago(8),
    opens: [1, 2, 3, 4, 5, 6].map((n) => ({ at: ago(8 - n * 0.9), spotsLeft: 8 - n, anonId: `anon-groupchat-${n}`, platform: (n % 2 ? 'mobile' : 'web') as Platform })) },
  { code: 'SY8H4QMD', rail: 'vouch', inviter: 'ada', activity: 'pottery', plan: 'ada-pottery', recipient: 'seyi@example.com', label: 'Seyi', createdAt: ago(7), opens: [{ at: ago(4), spotsLeft: 0, platform: 'mobile' }] },
  { code: 'QR4T82NP', rail: 'vouch', inviter: 'ada', activity: 'boardGame', plan: 'ada-boardgame', recipient: 'kola@example.com', label: 'Kola', createdAt: ago(21) },
  // Everyone else on Sunset Kayaking.
  { code: 'ZR6P3KWX', rail: 'vouch', inviter: 'femi', activity: 'kayakSat', plan: 'femi-kayak', recipient: contactFor('zara'), label: 'Zara', createdAt: ago(9), opens: [{ at: ago(8, 2), spotsLeft: 9, platform: 'mobile' }] },
  { code: 'FM2K7HDQ', rail: 'public', inviter: 'femi', activity: 'kayakSat', plan: 'femi-kayak', createdAt: ago(9),
    opens: [{ at: ago(7, 1), spotsLeft: 8, anonId: 'anon-bisi', platform: 'mobile' }, { at: ago(6, 1), spotsLeft: 7, anonId: 'anon-leo', platform: 'web' }, { at: ago(5), spotsLeft: 5, anonId: 'anon-femi-link-3', platform: 'mobile' }] },
  { code: 'KM4V8TXE', rail: 'vouch', inviter: 'kemi', activity: 'kayakSat', plan: null, recipient: contactFor('ife'), label: 'Ife', createdAt: ago(11), opens: [{ at: ago(10, 1), spotsLeft: 12, platform: 'mobile' }] },
  { code: 'H7PD3KXA', rail: 'public', inviter: 'kemi', activity: 'kayakSat', plan: null, createdAt: ago(12),
    opens: [{ at: ago(11), spotsLeft: 12, anonId: 'anon-host-1', platform: 'web' }, { at: ago(3), spotsLeft: 3, anonId: 'anon-host-2', platform: 'mobile' }] },
  { code: 'DY9Q3NPX', rail: 'public', inviter: 'ife', activity: 'kayakSat', plan: 'ife-kayak', createdAt: ago(10), opens: [{ at: ago(5, 1), spotsLeft: 6, anonId: 'anon-dayo', platform: 'mobile' }] },
  // Other activities.
  { code: 'TB3N7QWK', rail: 'vouch', inviter: 'tobi', activity: 'kayakSun', plan: 'tobi-kayaksun', recipient: contactFor('ngozi'), label: 'Ngozi', createdAt: ago(5), opens: [{ at: ago(4, 1), spotsLeft: 11, platform: 'web' }] },
  { code: 'MR8K2DXP', rail: 'public', inviter: 'mira', activity: 'kayakSun', plan: 'mira-kayaksun', createdAt: ago(4), opens: [{ at: ago(3, 1), spotsLeft: 9, anonId: 'anon-bayo', platform: 'mobile' }, { at: ago(2, 1), spotsLeft: 8, anonId: 'anon-musa', platform: 'mobile' }] },
  { code: 'FZ4M9HTQ', rail: 'vouch', inviter: 'femi', activity: 'moonlight', plan: 'femi-moonlight', recipient: contactFor('zara'), label: 'Zara', createdAt: ago(6), opens: [{ at: ago(5, 1), spotsLeft: 11, platform: 'mobile' }] },
  { code: 'SP7Q3WKD', rail: 'public', inviter: 'mira', activity: 'speakeasy', plan: 'mira-speakeasy', createdAt: ago(6), opens: [{ at: ago(5, 1), spotsLeft: 6, anonId: 'anon-leo-2', platform: 'web' }] },
  { code: 'ZS3N8QHT', rail: 'vouch', inviter: 'femi', activity: 'streetFood', plan: 'femi-streetfood', recipient: contactFor('zara'), label: 'Zara', createdAt: ago(8), opens: [{ at: ago(7, 1), spotsLeft: 11, platform: 'mobile' }] },
  { code: 'SF7W2MDK', rail: 'public', inviter: 'femi', activity: 'streetFood', plan: 'femi-streetfood', createdAt: ago(8), opens: [{ at: ago(6, 1), spotsLeft: 10, anonId: 'anon-ada', platform: 'web' }] },
]

const plans: PlanSeed[] = [
  { key: 'ada-kayak', activity: 'kayakSat', owner: 'ada', members: [
    { user: 'ada', via: 'direct', at: ago(10) },
    { user: 'tunde', via: { invite: 'BQ7N4XKD' }, at: ago(8) },
    { user: 'chioma', via: { invite: 'CH3M9WRT' }, at: minutesAgo(3) },
  ] },
  { key: 'femi-kayak', activity: 'kayakSat', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(9, 2) },
    { user: 'zara', via: { invite: 'ZR6P3KWX' }, at: ago(8, 1) },
    { user: 'bisi', via: { invite: 'FM2K7HDQ' }, at: ago(7) },
    { user: 'leo', via: { invite: 'FM2K7HDQ' }, at: ago(6) },
  ] },
  { key: 'ife-kayak', activity: 'kayakSat', owner: 'ife', members: [
    { user: 'ife', via: { invite: 'KM4V8TXE' }, at: ago(10) },
    { user: 'dayo', via: { invite: 'DY9Q3NPX' }, at: ago(5) },
  ] },
  { key: 'bayo-kayak', activity: 'kayakSat', owner: 'bayo', members: [{ user: 'bayo', via: 'direct', at: ago(6, 3) }] },
  { key: 'musa-kayak', activity: 'kayakSat', owner: 'musa', members: [{ user: 'musa', via: 'direct', at: ago(4, 2) }] },

  { key: 'tobi-kayaksun', activity: 'kayakSun', owner: 'tobi', members: [
    { user: 'tobi', via: 'direct', at: ago(5, 1) },
    { user: 'ngozi', via: { invite: 'TB3N7QWK' }, at: ago(4) },
  ] },
  { key: 'mira-kayaksun', activity: 'kayakSun', owner: 'mira', members: [
    { user: 'mira', via: 'direct', at: ago(4, 1) },
    { user: 'bayo', via: { invite: 'MR8K2DXP' }, at: ago(3) },
    { user: 'musa', via: { invite: 'MR8K2DXP' }, at: ago(2) },
  ] },
  { key: 'diego-kayaksun', activity: 'kayakSun', owner: 'diego', members: [{ user: 'diego', via: 'direct', at: ago(3, 2) }] },

  { key: 'femi-moonlight', activity: 'moonlight', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(6, 1) },
    { user: 'zara', via: { invite: 'FZ4M9HTQ' }, at: ago(5) },
  ] },

  { key: 'ngozi-speakeasy', activity: 'speakeasy', owner: 'ngozi', members: [{ user: 'ngozi', via: 'direct', at: ago(7) }] },
  { key: 'mira-speakeasy', activity: 'speakeasy', owner: 'mira', members: [
    { user: 'mira', via: 'direct', at: ago(6, 1) },
    { user: 'leo', via: { invite: 'SP7Q3WKD' }, at: ago(5) },
  ] },
  { key: 'bayo-speakeasy', activity: 'speakeasy', owner: 'bayo', members: [{ user: 'bayo', via: 'direct', at: ago(5, 2) }] },
  { key: 'musa-speakeasy', activity: 'speakeasy', owner: 'musa', members: [{ user: 'musa', via: 'direct', at: ago(4, 1) }] },
  { key: 'dayo-speakeasy', activity: 'speakeasy', owner: 'dayo', members: [{ user: 'dayo', via: 'direct', at: ago(3, 1) }] },

  ...(['tobi', 'mira', 'diego', 'bayo', 'musa', 'femi'] as UserKey[]).map((user, i) => ({
    key: `${user}-hike`, activity: 'hike' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(9 - i, i) }],
  })),

  { key: 'ada-pottery', activity: 'pottery', owner: 'ada', members: [{ user: 'ada', via: 'direct', at: ago(7, 2) }] },
  ...(['tunde', 'femi', 'zara', 'bisi', 'leo', 'ife', 'dayo'] as UserKey[]).map((user, i) => ({
    key: `${user}-pottery`, activity: 'pottery' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(7 - i * 0.4, 1) }],
  })),

  ...(['kemi', 'tobi', 'ngozi', 'mira', 'tunde', 'chioma', 'femi', 'zara', 'bisi', 'leo'] as UserKey[]).map((user, i) => ({
    key: `${user}-salsa`, activity: 'salsa' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(8 - i * 0.5, 2) }],
  })),

  { key: 'femi-streetfood', activity: 'streetFood', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(8, 1) },
    { user: 'zara', via: { invite: 'ZS3N8QHT' }, at: ago(7) },
    { user: 'ada', via: { invite: 'SF7W2MDK' }, at: ago(6) },
  ] },
  { key: 'bayo-streetfood', activity: 'streetFood', owner: 'bayo', members: [{ user: 'bayo', via: 'direct', at: ago(5, 1) }] },
  { key: 'musa-streetfood', activity: 'streetFood', owner: 'musa', members: [{ user: 'musa', via: 'direct', at: ago(3, 2) }] },

  { key: 'ada-boardgame', activity: 'boardGame', owner: 'ada', members: [{ user: 'ada', via: 'direct', at: ago(22) }] },
  ...(['femi', 'bayo', 'musa'] as UserKey[]).map((user, i) => ({
    key: `${user}-boardgame`, activity: 'boardGame' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(20 - i) }],
  })),
]

const planId = (key: string) => deterministicUuid(`plan:${key}`)
const inviteId = (code: string) => deterministicUuid(`invite:${code}`)
const bookingId = (plan: string, user: UserKey) => deterministicUuid(`booking:${plan}:${user}`)
const inviteByCode = new Map(invites.map((i) => [i.code, i]))

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE users, activities, activity_photos, plans, bookings, invites, invite_revocations,
      attributions, events, flag_exposures, spot_watches, feature_flags RESTART IDENTITY CASCADE`)
  await prisma.featureFlag.create({ data: { key: 'invites', enabled: true, rolloutPercent: 100 } })

  await prisma.user.createMany({
    data: (Object.keys(users) as UserKey[]).map((key) => ({
      id: uid(key),
      displayName: users[key].name,
      generation: users[key].generation,
      contactHmac: hmacContact(normalizeContact(contactFor(key))!),
      createdAt: users[key].createdAt,
    })),
  })

  const spotsTaken: Record<ActivityKey, number> = Object.fromEntries((Object.keys(activities) as ActivityKey[]).map((k) => [k, 0])) as Record<ActivityKey, number>
  for (const plan of plans) spotsTaken[plan.activity] += plan.members.length

  await prisma.activity.createMany({
    data: (Object.keys(activities) as ActivityKey[]).map((key) => {
      const a = activities[key]
      return {
        id: aid(key), hostId: uid(a.host), title: a.title, description: a.description, category: a.category,
        illustration: a.illustration, location: a.location, startsAt: a.startsAt, timezone: TZ, priceMinor: a.priceMinor,
        currency: 'USD', capacity: a.capacity, spotsTaken: spotsTaken[key], version: 1 + spotsTaken[key], flagBucket: activityBucket(aid(key)), createdAt: a.createdAt,
      }
    }),
  })

  await prisma.plan.createMany({
    data: plans.map((p) => ({
      id: planId(p.key), activityId: aid(p.activity), ownerId: uid(p.owner),
      createdAt: p.members.reduce((min, m) => (m.at < min ? m.at : min), p.members[0]!.at),
    })),
  })

  await prisma.invite.createMany({
    data: invites.map((i) => ({
      id: inviteId(i.code), code: i.code, rail: i.rail, inviterId: uid(i.inviter), activityId: aid(i.activity),
      planId: i.plan ? planId(i.plan) : null,
      recipientHmac: i.recipient ? hmacContact(normalizeContact(i.recipient)!) : null,
      recipientLabel: i.label ?? null, expiresAt: activities[i.activity].startsAt, createdAt: i.createdAt,
    })),
  })

  const bookings = plans.flatMap((p) =>
    p.members.map((m) => ({
      id: bookingId(p.key, m.user), activityId: aid(p.activity), planId: planId(p.key), userId: uid(m.user),
      inviteId: m.via === 'direct' ? null : inviteId(m.via.invite),
      idempotencyKey: `seed-${p.key}-${m.user}`, createdAt: m.at,
    })),
  )
  await prisma.booking.createMany({ data: bookings })

  const attributions = plans.flatMap((p) =>
    p.members.flatMap((m) => {
      if (m.via === 'direct') return []
      const invite = inviteByCode.get(m.via.invite)!
      const inviteeNew = users[m.user].generation === users[invite.inviter].generation + 1 && users[m.user].createdAt.getTime() <= m.at.getTime() + HOUR && users[m.user].generation > 0
      return [{
        inviteId: inviteId(invite.code), rail: invite.rail, code: invite.code, inviterId: uid(invite.inviter), inviteeId: uid(m.user),
        inviteeWasNew: inviteeNew, hopGeneration: users[invite.inviter].generation + 1, planId: planId(p.key),
        bookingId: bookingId(p.key, m.user), createdAt: m.at,
      }]
    }),
  )
  await prisma.attribution.createMany({ data: attributions })

  const events = [
    ...invites.map((i) => ({
      name: 'invite_created', occurredAt: i.createdAt, userId: uid(i.inviter), platform: 'web' as Platform,
      activityId: aid(i.activity), inviteId: inviteId(i.code), rail: i.rail, props: { planId: i.plan ? planId(i.plan) : null },
    })),
    ...invites.flatMap((i) =>
      (i.opens ?? []).map((o, n) => ({
        name: 'invite_opened', occurredAt: o.at, anonId: o.anonId ?? `anon-${i.code.toLowerCase()}-${n}`, platform: o.platform ?? ('mobile' as Platform),
        activityId: aid(i.activity), inviteId: inviteId(i.code), rail: i.rail, props: { spotsLeftAtOpen: o.spotsLeft },
      })),
    ),
    ...bookings.map((b) => ({
      name: 'booking_succeeded', occurredAt: b.createdAt, userId: b.userId, platform: 'web' as Platform, activityId: b.activityId,
      inviteId: b.inviteId, rail: b.inviteId ? inviteByCode.get(invites.find((i) => inviteId(i.code) === b.inviteId)!.code)!.rail : null,
      props: { planId: b.planId, source: b.inviteId ? 'invite' : 'direct' },
    })),
    ...attributions.map((a) => ({
      name: 'spot_claimed', occurredAt: a.createdAt, userId: a.inviteeId, platform: 'mobile' as Platform, activityId: aid(invites.find((i) => i.code === a.code)!.activity),
      inviteId: a.inviteId, rail: a.rail, props: { wasNew: a.inviteeWasNew, hopGeneration: a.hopGeneration },
    })),
    ...(Object.keys(users) as UserKey[]).filter((k) => users[k].generation > 0).map((k) => ({
      name: 'user_created', occurredAt: users[k].createdAt, userId: uid(k), platform: 'mobile' as Platform,
      props: { generation: users[k].generation },
    })),
  ]
  await prisma.event.createMany({ data: events })

  const check = await prisma.$queryRaw<{ title: string; spots_taken: number; confirmed: bigint; capacity: number }[]>`
    SELECT a.title, a.spots_taken, a.capacity, COUNT(b.id) AS confirmed
    FROM activities a LEFT JOIN bookings b ON b.activity_id = a.id AND b.status = 'confirmed'
    GROUP BY a.id ORDER BY a.starts_at`
  const drift = check.filter((r) => Number(r.confirmed) !== r.spots_taken || r.spots_taken > r.capacity)
  if (drift.length) throw new Error(`Seed drift: ${JSON.stringify(drift)}`)

  const line = (label: string, value: string) => console.log(`${label.padEnd(26)} ${value}`)
  console.log('Seeded.\n')
  line('Ada (booker)', uid('ada'))
  line('Kemi (host)', uid('kemi'))
  line('Sunset Kayaking (Sat)', `${aid('kayakSat')}  ${spotsTaken.kayakSat} of 12 booked`)
  line('Holdout activity', `${aid('hike')}  Sunrise Hike`)
  line('Full activities', 'Pottery Night, Rooftop Salsa')
  console.log()
  line('Vouch to claim', `${displayCode('AX7K29QM')}  Ada -> Dami, claim with dami@example.com`)
  line('Vouch not opened', `${displayCode('BG5K2YNP')}  Ada -> Bola, claim with +1 415 555 0133`)
  line('Public link (Ada)', displayCode('M2QW7HTA'))
  line('Host link (Kemi)', displayCode('H7PD3KXA'))
  line('Vouch opened when full', `${displayCode('SY8H4QMD')}  Pottery Night`)
  line('Expired vouch', `${displayCode('QR4T82NP')}  Board Game Night`)
  console.log()
  for (const r of check) line(r.title, `${r.spots_taken}/${r.capacity}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
