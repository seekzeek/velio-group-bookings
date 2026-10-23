// Loads 30 days of synthetic data into a separate database (velio_scenario by default) that reproduces the Part 4 scenario:
// about 34% of bookers invite, about 11% of opened invites end in a claim, most opens on mobile, vouches converting better than
// public links, and a meaningful share of opens landing on activities that were already full or had started.
// Each activity is simulated as a timeline, so spots, "opened when full" and late opens come out of the mechanics.
// Run with `npm run seed:scenario`. It creates and migrates the database if needed, then wipes and reloads it.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { loadDotEnv } from '../src/lib/env-file.js'

loadDotEnv('.env')
process.env.NODE_ENV ??= 'development'

const { PrismaClient } = await import('../src/generated/prisma/client.js')
const { deterministicUuid, deterministicUuidWhere } = await import('../src/lib/ids.js')
const { activityBucket, isHoldout } = await import('../src/modules/flags/flags.js')
const { generateCode } = await import('../src/modules/invites/codes.js')

type Category = 'outdoors' | 'nights_out' | 'food_and_drink' | 'classes' | 'other'
type Illustration = 'kayak' | 'hike' | 'speakeasy' | 'salsa' | 'market' | 'pottery' | 'other'
type Rail = 'vouch' | 'public'
type Platform = 'web' | 'mobile'

function scenarioUrl(): string {
  if (process.env.SCENARIO_DATABASE_URL) return process.env.SCENARIO_DATABASE_URL
  const base = new URL(process.env.DATABASE_URL ?? 'postgresql://velio:velio@localhost:5432/velio')
  base.pathname = '/velio_scenario'
  return base.toString()
}

async function prepareDatabase(url: string) {
  const parsed = new URL(url)
  const dbName = parsed.pathname.slice(1)
  parsed.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: parsed.toString() })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`)
  } finally {
    await admin.end()
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } })
}

// Deterministic randomness, so the numbers in OWNERSHIP.md stay true on every reload.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20261022)
const chance = (p: number) => rand() < p
const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
const intBetween = (lo: number, hi: number) => Math.floor(between(lo, hi + 1))
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!
const skewedEarly = (lo: number, hi: number) => lo + (hi - lo) * rand() ** 2

const DAY = 86_400_000
const HOUR = 3_600_000
const now = Date.now()
const windowStart = now - 30 * DAY

const firstNames = ['Ada', 'Tunde', 'Chioma', 'Femi', 'Zara', 'Bisi', 'Leo', 'Ife', 'Dayo', 'Bayo', 'Musa', 'Tobi', 'Ngozi', 'Mira', 'Diego', 'Kemi', 'Sade', 'Emeka', 'Amara', 'Kunle', 'Nneka', 'Seyi', 'Dami', 'Bola', 'Kola', 'Yemi', 'Tola', 'Ebuka', 'Halima', 'Idris', 'Jide', 'Lola', 'Nonso', 'Obi', 'Pelumi', 'Rotimi', 'Simi', 'Uche', 'Wale', 'Zainab']
const categories: { category: Category; illustrations: Illustration[]; titles: string[]; price: [number, number]; capacity: [number, number]; demand: number }[] = [
  { category: 'outdoors', illustrations: ['kayak', 'hike'], titles: ['Sunset Kayaking', 'Sunrise Hike', 'Moonlight Paddle', 'Beach Volleyball', 'Lagoon Swim'], price: [2000, 6000], capacity: [8, 16], demand: 0.85 },
  { category: 'nights_out', illustrations: ['speakeasy', 'salsa'], titles: ['Secret Speakeasy Tour', 'Rooftop Salsa', 'Jazz Basement', 'Afrobeats Night'], price: [2500, 5000], capacity: [10, 20], demand: 1.0 },
  { category: 'food_and_drink', illustrations: ['market'], titles: ['Street Food Walk', 'Suya Crawl', 'Palm Wine Tasting', 'Brunch Club'], price: [3000, 5000], capacity: [8, 14], demand: 0.7 },
  { category: 'classes', illustrations: ['pottery'], titles: ['Pottery Night', 'Adire Workshop', 'Jollof Masterclass', 'Life Drawing'], price: [3500, 7000], capacity: [6, 10], demand: 0.65 },
  { category: 'other', illustrations: ['other'], titles: ['Board Game Night', 'Pub Quiz', 'Film Club'], price: [1000, 2500], capacity: [8, 12], demand: 0.55 },
]

// What-if knobs for changing the scenario's numbers on the spot. Unset means the defaults that produce the 34% and 11% world.
// Multipliers scale the default; shares replace it. The run stays seeded, so the same knobs always give the same numbers.
function knob(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number from ${min} to ${max}, got "${raw}"`)
  return value
}
const knobs = {
  inviteShare: knob('SCENARIO_INVITE_SHARE', 0.355, 0, 1),
  vouchClaim: knob('SCENARIO_VOUCH_CLAIM_X', 1, 0, 3),
  linkClaim: knob('SCENARIO_LINK_CLAIM_X', 1, 0, 6),
  openDelayDays: knob('SCENARIO_OPEN_DELAY_DAYS', 5, 0.1, 14),
  demand: knob('SCENARIO_DEMAND_X', 1, 0.1, 3),
  mobileShare: knob('SCENARIO_MOBILE_SHARE', 0.8, 0, 1),
}
const scale = (p: number, x: number) => Math.min(0.97, p * x)

// Tunables. The realised numbers are printed at the end; these are what gets the scenario to 34% and 11%.
const T = {
  hosts: 40,
  activities: 220,
  organicUsers: 2400,
  inviteShare: knobs.inviteShare,
  vouchesPerInviter: [1, 3] as const,
  publicLinkShare: 0.5,
  vouchOpenChance: 0.78,
  publicOpens: [0, 14] as const,
  mobileShare: knobs.mobileShare,
  openDelayDays: [0, knobs.openDelayDays] as const,
  claimGivenOpen: {
    vouch: { mobile: scale(0.5, knobs.vouchClaim), web: scale(0.36, knobs.vouchClaim) },
    public: { mobile: scale(0.17, knobs.linkClaim), web: scale(0.12, knobs.linkClaim) },
  },
  wrongContactShare: 0.14,
  wrongContactRetry: 0.5,
  startedShare: 0.86,
  submittedShare: 0.9,
  newGuestShare: 0.72,
  secondHopInviteShare: 0.25,
  bookingFailShare: 0.0012,
}

type User = { id: string; displayName: string; generation: number; contactHmac: string; createdAt: Date }
type Activity = { id: string; hostId: string; title: string; description: string; category: Category; illustration: Illustration; location: string; startsAt: Date; priceMinor: number; capacity: number; createdAt: Date; flagBucket: number; treatment: boolean }
type Plan = { id: string; activityId: string; ownerId: string; createdAt: Date }
type Booking = { id: string; activityId: string; planId: string; userId: string; inviteId: string | null; idempotencyKey: string; createdAt: Date }
type Invite = { id: string; code: string; rail: Rail; inviterId: string; activityId: string; planId: string | null; recipientHmac: string | null; recipientLabel: string | null; expiresAt: Date; createdAt: Date }
type Attribution = { inviteId: string; rail: Rail; code: string; inviterId: string; inviteeId: string; inviteeWasNew: boolean; hopGeneration: number; planId: string; bookingId: string; createdAt: Date }
type Event = { name: string; occurredAt: Date; userId?: string | null; anonId?: string | null; platform?: Platform | null; activityId?: string | null; inviteId?: string | null; rail?: Rail | null; props?: Record<string, unknown> }

const users: User[] = []
const activities: Activity[] = []
const plans: Plan[] = []
const bookings: Booking[] = []
const invites: Invite[] = []
const attributions: Attribution[] = []
const events: Event[] = []

let userSeq = 0
function makeUser(generation: number, createdAt: Date): User {
  const i = userSeq++
  const user = { id: deterministicUuid(`scenario:user:${i}`), displayName: `${pick(firstNames)} ${String.fromCharCode(65 + (i % 26))}.`, generation, contactHmac: createHash('sha256').update(`scenario:contact:${i}`).digest('hex'), createdAt }
  users.push(user)
  return user
}

const hosts = Array.from({ length: T.hosts }, () => makeUser(0, new Date(windowStart - between(10, 60) * DAY)))
const organic = Array.from({ length: T.organicUsers }, () => makeUser(0, new Date(windowStart - between(0, 90) * DAY)))

let codeSeq = 0
const usedCodes = new Set<string>()
function nextCode() {
  let code = generateCode()
  while (usedCodes.has(code)) code = generateCode()
  usedCodes.add(code)
  codeSeq++
  return code
}

type Arrival =
  | { at: number; kind: 'direct'; user: User }
  | { at: number; kind: 'open'; invite: Invite; opener: { anonId: string; user: User | null }; platform: Platform; inviterGeneration: number }

function latencyEvent(activityId: string, at: Date) {
  // Log-normal around 120 ms with a tail, so p95 lands near 0.4 s.
  const ms = Math.round(Math.exp(Math.log(120) + 0.75 * gaussian()))
  events.push({ name: 'availability_delivered', occurredAt: at, activityId, props: { latencyMs: Math.min(ms, 4000) } })
}
function gaussian() {
  const u = 1 - rand(), v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function simulateActivity(a: Activity, demand: number) {
  const bookedUsers = new Set<string>()
  const planOf = new Map<string, string>()
  let spotsTaken = 0
  const queue: Arrival[] = []
  const horizon = Math.min(a.startsAt.getTime(), now)

  const directCount = Math.round(a.capacity * demand * knobs.demand * between(0.5, 1.4))
  const pool = [...organic].sort(() => rand() - 0.5).slice(0, directCount)
  for (const user of pool) queue.push({ at: skewedEarly(a.createdAt.getTime(), horizon), kind: 'direct', user })

  const spotsLeftAt = () => a.capacity - spotsTaken

  function scheduleInvites(inviter: User, planId: string, bookedAt: number, share: number) {
    if (!a.treatment || !chance(share)) return
    const base = bookedAt + skewedEarly(0, 3) * DAY
    if (base >= now) return
    const createdAt = new Date(base)
    const makeInvite = (rail: Rail) => {
      const invite: Invite = { id: deterministicUuid(`scenario:invite:${codeSeq}`), code: nextCode(), rail, inviterId: inviter.id, activityId: a.id, planId, recipientHmac: rail === 'vouch' ? createHash('sha256').update(`scenario:recipient:${codeSeq}`).digest('hex') : null, recipientLabel: rail === 'vouch' ? pick(firstNames) : null, expiresAt: a.startsAt, createdAt }
      invites.push(invite)
      events.push({ name: 'invite_created', occurredAt: createdAt, userId: inviter.id, platform: chance(T.mobileShare) ? 'mobile' : 'web', activityId: a.id, inviteId: invite.id, rail, props: { planId } })
      return invite
    }
    const vouches = chance(0.7) ? intBetween(T.vouchesPerInviter[0], T.vouchesPerInviter[1]) : 0
    const link = vouches === 0 || chance(T.publicLinkShare)
    for (let i = 0; i < vouches; i++) {
      const invite = makeInvite('vouch')
      if (chance(T.vouchOpenChance)) {
        const at = base + skewedEarly(T.openDelayDays[0], T.openDelayDays[1]) * DAY
        if (at < now) queue.push({ at, kind: 'open', invite, opener: { anonId: `anon-${invite.code.toLowerCase()}`, user: chance(T.newGuestShare) ? null : pick(organic) }, platform: chance(T.mobileShare) ? 'mobile' : 'web', inviterGeneration: inviter.generation })
      }
    }
    if (link) {
      const invite = makeInvite('public')
      const opens = Math.round(skewedEarly(T.publicOpens[0], T.publicOpens[1]))
      for (let i = 0; i < opens; i++) {
        const at = base + skewedEarly(T.openDelayDays[0], T.openDelayDays[1]) * DAY
        if (at < now) queue.push({ at, kind: 'open', invite, opener: { anonId: `anon-${invite.code.toLowerCase()}-${i}`, user: chance(T.newGuestShare) ? null : pick(organic) }, platform: chance(T.mobileShare) ? 'mobile' : 'web', inviterGeneration: inviter.generation })
      }
    }
  }

  function book(user: User, at: number, invite: Invite | null, planId: string | null, platform: Platform, anonId: string | null): Booking | null {
    const when = new Date(at)
    const source = invite ? 'invite' : 'direct'
    events.push({ name: invite ? 'claim_attempted' : 'booking_attempted', occurredAt: when, userId: user.id, anonId, platform, activityId: a.id, inviteId: invite?.id ?? null, rail: invite?.rail ?? null, props: { source } })
    if (at >= a.startsAt.getTime()) {
      events.push({ name: invite ? 'claim_rejected' : 'booking_rejected', occurredAt: when, userId: user.id, anonId, platform, activityId: a.id, inviteId: invite?.id ?? null, rail: invite?.rail ?? null, props: { code: invite ? 'INVITE_EXPIRED' : 'ACTIVITY_STARTED' } })
      return null
    }
    if (bookedUsers.has(user.id)) {
      events.push({ name: invite ? 'claim_rejected' : 'booking_rejected', occurredAt: when, userId: user.id, anonId, platform, activityId: a.id, inviteId: invite?.id ?? null, rail: invite?.rail ?? null, props: { code: 'ALREADY_BOOKED' } })
      return null
    }
    if (spotsLeftAt() <= 0) {
      events.push({ name: invite ? 'claim_rejected' : 'booking_rejected', occurredAt: when, userId: user.id, anonId, platform, activityId: a.id, inviteId: invite?.id ?? null, rail: invite?.rail ?? null, props: { code: 'SOLD_OUT' } })
      return null
    }
    if (chance(T.bookingFailShare)) {
      events.push({ name: invite ? 'claim_failed' : 'booking_failed', occurredAt: when, userId: user.id, anonId, platform, activityId: a.id, inviteId: invite?.id ?? null, rail: invite?.rail ?? null, props: { code: 'TRY_AGAIN' } })
      return null
    }
    const resolvedPlanId = planId ?? (() => {
      const plan: Plan = { id: deterministicUuid(`scenario:plan:${plans.length}`), activityId: a.id, ownerId: user.id, createdAt: when }
      plans.push(plan)
      return plan.id
    })()
    spotsTaken++
    bookedUsers.add(user.id)
    planOf.set(user.id, resolvedPlanId)
    const booking: Booking = { id: deterministicUuid(`scenario:booking:${bookings.length}`), activityId: a.id, planId: resolvedPlanId, userId: user.id, inviteId: invite?.id ?? null, idempotencyKey: `scenario-${bookings.length}`, createdAt: when }
    bookings.push(booking)
    events.push({ name: 'booking_succeeded', occurredAt: when, userId: user.id, anonId, platform, activityId: a.id, inviteId: invite?.id ?? null, rail: invite?.rail ?? null, props: { planId: resolvedPlanId, source, spotsLeft: spotsLeftAt() } })
    latencyEvent(a.id, when)
    return booking
  }

  while (queue.length) {
    queue.sort((x, y) => x.at - y.at)
    const next = queue.shift()!
    if (next.kind === 'direct') {
      const platform: Platform = chance(0.55) ? 'web' : 'mobile'
      events.push({ name: 'activity_viewed', occurredAt: new Date(next.at - between(1, 20) * 60_000), userId: next.user.id, anonId: `anon-u-${next.user.id.slice(0, 8)}`, platform, activityId: a.id, props: { fromInvite: false } })
      const booking = book(next.user, next.at, null, null, platform, `anon-u-${next.user.id.slice(0, 8)}`)
      if (booking) scheduleInvites(next.user, booking.planId, next.at, T.inviteShare)
      continue
    }

    const { invite, opener, platform } = next
    const spotsLeft = Math.max(0, spotsLeftAt())
    const used = invite.rail === 'vouch' && attributions.some((at) => at.inviteId === invite.id)
    events.push({ name: 'invite_opened', occurredAt: new Date(next.at), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail, props: { spotsLeftAtOpen: next.at >= a.startsAt.getTime() ? 0 : spotsLeft } })
    events.push({ name: 'activity_viewed', occurredAt: new Date(next.at), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, props: { fromInvite: true } })
    if (used || next.at >= a.startsAt.getTime() || spotsLeft === 0) {
      if (chance(0.35)) {
        events.push({ name: 'claim_attempted', occurredAt: new Date(next.at + 2 * 60_000), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail })
        events.push({ name: 'claim_rejected', occurredAt: new Date(next.at + 2 * 60_000), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail, props: { code: used ? 'INVITE_USED' : next.at >= a.startsAt.getTime() ? 'INVITE_EXPIRED' : 'SOLD_OUT' } })
      }
      continue
    }

    const daysSinceSent = (next.at - invite.createdAt.getTime()) / DAY
    const decay = daysSinceSent > 3 ? 0.6 : 1
    const scarcity = spotsLeft <= 2 ? 0.8 : 1
    const p = T.claimGivenOpen[invite.rail][platform] * decay * scarcity
    if (!chance(T.startedShare)) continue
    events.push({ name: 'claim_started', occurredAt: new Date(next.at + 60_000), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail })
    if (!chance(T.submittedShare)) continue
    events.push({ name: 'claim_submitted', occurredAt: new Date(next.at + 3 * 60_000), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail })

    let wants = chance(p / (T.startedShare * T.submittedShare))
    if (invite.rail === 'vouch' && wants && chance(T.wrongContactShare)) {
      events.push({ name: 'claim_attempted', occurredAt: new Date(next.at + 4 * 60_000), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail })
      events.push({ name: 'claim_rejected', occurredAt: new Date(next.at + 4 * 60_000), userId: opener.user?.id ?? null, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail, props: { code: 'INVITE_NOT_FOR_YOU' } })
      wants = chance(T.wrongContactRetry)
    }
    if (!wants) continue

    const claimAt = next.at + 5 * 60_000
    const isNew = opener.user === null
    const guest = opener.user ?? makeUser(next.inviterGeneration + 1, new Date(claimAt))
    if (isNew) events.push({ name: 'user_created', occurredAt: new Date(claimAt), userId: guest.id, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail, props: { generation: guest.generation } })
    const booking = book(guest, claimAt, invite, invite.planId, platform, opener.anonId)
    if (!booking) {
      if (isNew) users.pop(), userSeq--
      continue
    }
    attributions.push({ inviteId: invite.id, rail: invite.rail, code: invite.code, inviterId: invite.inviterId, inviteeId: guest.id, inviteeWasNew: isNew, hopGeneration: next.inviterGeneration + 1, planId: booking.planId, bookingId: booking.id, createdAt: new Date(claimAt) })
    events.push({ name: 'spot_claimed', occurredAt: new Date(claimAt), userId: guest.id, anonId: opener.anonId, platform, activityId: a.id, inviteId: invite.id, rail: invite.rail, props: { wasNew: isNew, hopGeneration: next.inviterGeneration + 1, planId: booking.planId } })
    scheduleInvites(guest, booking.planId, claimAt, T.secondHopInviteShare)
  }
  return spotsTaken
}

const spotsByActivity = new Map<string, number>()
for (let i = 0; i < T.activities; i++) {
  const kind = pick(categories)
  const host = pick(hosts)
  const createdAt = new Date(windowStart + skewedEarly(0, 27) * DAY)
  const startsAt = new Date(createdAt.getTime() + between(2, 14) * DAY)
  const holdoutWanted = i % 10 === 0
  const id = deterministicUuidWhere(`scenario:activity:${i}`, (candidate) => isHoldout(candidate) === holdoutWanted)
  const activity: Activity = {
    id, hostId: host.id, title: pick(kind.titles), description: 'A good few hours with people who want to be there. Everything you need is included.',
    category: kind.category, illustration: pick(kind.illustrations), location: pick(['Harbour jetty, pier 3', 'Studio 4, Yaba', 'The Roof, Victoria Island', 'Balogun market gate', 'Café Neo, Ikoyi', 'Lekki Conservation Centre']),
    startsAt, priceMinor: Math.round(between(kind.price[0], kind.price[1]) / 100) * 100, capacity: intBetween(kind.capacity[0], kind.capacity[1]), createdAt, flagBucket: activityBucket(id), treatment: !holdoutWanted,
  }
  activities.push(activity)
  spotsByActivity.set(id, simulateActivity(activity, kind.demand))
}

const url = scenarioUrl()
await prepareDatabase(url)
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) })

try {
  await prisma.$executeRawUnsafe(`TRUNCATE users, activities, activity_photos, plans, bookings, invites, invite_revocations, attributions, events, flag_exposures, spot_watches, feature_flags RESTART IDENTITY CASCADE`)
  await prisma.featureFlag.create({ data: { key: 'invites', enabled: true, rolloutPercent: 100 } })

  const chunk = async <T,>(rows: T[], size: number, write: (part: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size))
  }
  await chunk(users, 1000, (part) => prisma.user.createMany({ data: part }))
  await prisma.activity.createMany({
    data: activities.map((a) => ({ id: a.id, hostId: a.hostId, title: a.title, description: a.description, category: a.category, illustration: a.illustration, location: a.location, startsAt: a.startsAt, timezone: 'Africa/Lagos', priceMinor: a.priceMinor, currency: 'USD', capacity: a.capacity, spotsTaken: spotsByActivity.get(a.id) ?? 0, version: 1 + (spotsByActivity.get(a.id) ?? 0), flagBucket: a.flagBucket, createdAt: a.createdAt })),
  })
  await chunk(plans, 1000, (part) => prisma.plan.createMany({ data: part }))
  await chunk(invites, 1000, (part) => prisma.invite.createMany({ data: part }))
  await chunk(bookings, 1000, (part) => prisma.booking.createMany({ data: part }))
  await chunk(attributions, 1000, (part) => prisma.attribution.createMany({ data: part }))
  await chunk(events, 2000, (part) => prisma.event.createMany({ data: part.map((e) => ({ ...e, props: (e.props ?? {}) as object })) }))

  const drift = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM oversell_check`
  if (Number(drift[0]!.n) > 0) throw new Error('Scenario seed produced an oversold or drifted activity')

  const [inviteRate] = await prisma.$queryRaw<{ bookers: bigint; inviters: bigint }[]>`SELECT SUM(bookers) bookers, SUM(inviters) inviters FROM bookers_invite_rate`
  const rails = await prisma.$queryRaw<{ rail: string; opens: bigint; claims: bigint; opens_on_full: bigint }[]>`SELECT rail, SUM(opens) opens, SUM(claims) claims, SUM(opens_on_full) opens_on_full FROM invite_claim_rate GROUP BY rail ORDER BY rail::text`
  const platforms = await prisma.$queryRaw<{ platform: string; opens: bigint; claims: bigint }[]>`SELECT platform, COUNT(*) opens, COUNT(*) FILTER (WHERE claimed) claims FROM invite_opens GROUP BY platform ORDER BY platform`
  const success = await prisma.$queryRaw<{ attempts: bigint; succeeded: bigint; rejected: bigint; failed: bigint }[]>`SELECT SUM(attempts) attempts, SUM(succeeded) succeeded, SUM(rejected) rejected, SUM(failed) failed FROM booking_success_rate`
  const holdout = await prisma.$queryRaw<{ variant: string; activities: bigint; avg_attendees: string; avg_fill_rate: string; avg_new_users: string }[]>`SELECT variant, activities, avg_attendees::text, avg_fill_rate::text, avg_new_users::text FROM holdout_summary ORDER BY variant`

  const totalOpens = rails.reduce((n, r) => n + Number(r.opens), 0)
  const totalClaims = rails.reduce((n, r) => n + Number(r.claims), 0)
  const onFull = rails.reduce((n, r) => n + Number(r.opens_on_full), 0)
  const s = success[0]!
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a')
  console.log(`Scenario loaded into ${url.replace(/\/\/.*@/, '//')}\n`)
  const changed = Object.entries(knobs).filter(([k, v]) => v !== { inviteShare: 0.355, vouchClaim: 1, linkClaim: 1, openDelayDays: 5, demand: 1, mobileShare: 0.8 }[k])
  console.log(changed.length ? `What-if knobs: ${changed.map(([k, v]) => `${k}=${v}`).join(', ')}\n` : 'Default scenario, no what-if knobs set\n')
  console.log(`users ${users.length}, activities ${activities.length}, bookings ${bookings.length}, invites ${invites.length}, attributions ${attributions.length}, events ${events.length}\n`)
  console.log(`bookers who invite       ${pct(Number(inviteRate!.inviters), Number(inviteRate!.bookers))}  (${inviteRate!.inviters} of ${inviteRate!.bookers})`)
  console.log(`opened invites claimed   ${pct(totalClaims, totalOpens)}  (${totalClaims} of ${totalOpens})`)
  for (const r of rails) console.log(`  ${r.rail.padEnd(8)} ${pct(Number(r.claims), Number(r.opens))}  (${r.claims} of ${r.opens}), ${pct(Number(r.opens_on_full), Number(r.opens))} opened when full`)
  for (const p of platforms) console.log(`  ${p.platform.padEnd(8)} ${pct(Number(p.claims), Number(p.opens))}  (${p.claims} of ${p.opens} opens)`)
  console.log(`opens on a full activity ${pct(onFull, totalOpens)}`)
  console.log(`booking success          ${pct(Number(s.succeeded), Number(s.attempts) - Number(s.rejected))}  (${s.failed} failures)`)
  for (const h of holdout) console.log(`${h.variant.padEnd(10)} ${h.activities} activities, avg attendees ${h.avg_attendees}, fill ${h.avg_fill_rate}, avg new users ${h.avg_new_users}`)
} finally {
  await prisma.$disconnect()
}
