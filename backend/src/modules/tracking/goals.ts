import type { Db } from '../../db.js'
import { HOLDOUT_PERCENT } from '../flags/flags.js'
import { metrics } from './metrics.js'

export type GoalStatus = 'on_target' | 'trigger_fired' | 'no_data'

export type Goal = {
  key: 'never_oversell' | 'bookings_succeed' | 'updates_live' | 'bookers_invite' | 'invites_convert'
  label: string
  current: number | null
  currentDisplay: string
  target: number
  targetDisplay: string
  trigger: string
  status: GoalStatus
  sampleSize: number
  minSample: number
}

export type HealthOptions = { source: 'live' | 'scenario'; windowDays: number; minSample: number | null }

// Cohort minimums from the tracking plan, so one quiet week never fires a trigger.
const MIN_ATTEMPTS = 500
const MIN_BOOKERS = 200
const MIN_OPENS = 200
const HOLDOUT_WEEKS_PLANNED = 4

const pct = (v: number | null) => (v === null ? 'no data yet' : `${Math.round(v * 1000) / 10}%`)

// prom-client 15 reads a histogram asynchronously. Linear interpolation inside the bucket that crosses p95.
async function histogramP95(): Promise<number | null> {
  const data = (await metrics.availabilityLatency.get()) as unknown as { values: { labels: { le?: string | number }; value: number; metricName?: string }[] }
  const buckets = data.values.filter((v) => v.metricName?.endsWith('_bucket') && v.labels.le !== undefined && v.labels.le !== '+Inf')
  const total = data.values.find((v) => v.metricName?.endsWith('_count'))?.value ?? 0
  if (total === 0) return null
  const target = total * 0.95
  let previousLe = 0
  let previousCount = 0
  for (const b of buckets.sort((x, y) => Number(x.labels.le) - Number(y.labels.le))) {
    const le = Number(b.labels.le)
    if (b.value >= target) {
      const span = b.value - previousCount
      return span === 0 ? le : previousLe + ((target - previousCount) / span) * (le - previousLe)
    }
    previousLe = le
    previousCount = b.value
  }
  return previousLe
}

export async function computeHealth(db: Db, options: HealthOptions) {
  const now = new Date()
  const from = new Date(now.getTime() - options.windowDays * 86_400_000)
  const min = (fallback: number) => (options.minSample === null ? fallback : options.minSample)

  const [oversell, success, bookers, claims, holdoutRows, firstActivity, latencyEvents, platformRows] = await Promise.all([
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM oversell_check`,
    db.$queryRaw<{ attempts: number; succeeded: number; rejected: number; failed: number }[]>`
      SELECT COALESCE(SUM(attempts), 0)::int AS attempts, COALESCE(SUM(succeeded), 0)::int AS succeeded,
             COALESCE(SUM(rejected), 0)::int AS rejected, COALESCE(SUM(failed), 0)::int AS failed
      FROM booking_success_rate WHERE hour >= ${from}`,
    db.$queryRaw<{ bookers: number; inviters: number }[]>`
      SELECT COALESCE(SUM(bookers), 0)::int AS bookers, COALESCE(SUM(inviters), 0)::int AS inviters
      FROM bookers_invite_rate WHERE cohort_week >= date_trunc('week', ${from}::timestamptz)`,
    db.$queryRaw<{ rail: 'vouch' | 'public'; opens: number; claims: number; opens_on_full: number }[]>`
      SELECT rail, SUM(opens)::int AS opens, SUM(claims)::int AS claims, SUM(opens_on_full)::int AS opens_on_full
      FROM invite_claim_rate WHERE cohort_week >= date_trunc('week', ${from}::timestamptz) GROUP BY rail`,
    db.$queryRaw<{ variant: string; activities: number; avg_attendees: number; avg_fill_rate: number; avg_new_users: number; bookings_per_view: number | null; avg_group_plans: number }[]>`
      SELECT variant, activities::int, avg_attendees::float, avg_fill_rate::float, avg_new_users::float, bookings_per_view::float, avg_group_plans::float FROM holdout_summary`,
    db.$queryRaw<{ first: Date | null }[]>`SELECT MIN(created_at) AS first FROM activities`,
    db.$queryRaw<{ p95: number | null }[]>`
      SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY (props->>'latencyMs')::numeric) / 1000.0 AS p95
      FROM events WHERE name = 'availability_delivered' AND occurred_at >= ${from}`,
    // The same funnel per platform. Every event carries the platform the client sent, so this needs no extra tracking.
    db.$queryRaw<{ platform: string; views: number; booking_attempts: number; bookings: number; invite_opens: number; claims: number }[]>`
      SELECT COALESCE(platform::text, 'unknown') AS platform,
             COUNT(*) FILTER (WHERE name = 'activity_viewed')::int AS views,
             COUNT(*) FILTER (WHERE name IN ('booking_attempted', 'claim_attempted'))::int AS booking_attempts,
             COUNT(*) FILTER (WHERE name IN ('booking_succeeded', 'spot_claimed'))::int AS bookings,
             COUNT(*) FILTER (WHERE name = 'invite_opened')::int AS invite_opens,
             COUNT(*) FILTER (WHERE name = 'spot_claimed')::int AS claims
      FROM events WHERE occurred_at >= ${from} GROUP BY 1 ORDER BY 1`,
  ])

  const oversold = oversell[0]?.n ?? 0
  const s = success[0]!
  const successDenominator = s.attempts - s.rejected
  const successRate = successDenominator > 0 ? s.succeeded / successDenominator : null
  const b = bookers[0]!
  const inviteRate = b.bookers > 0 ? b.inviters / b.bookers : null
  const byRail = Object.fromEntries(claims.map((c) => [c.rail, c])) as Partial<Record<'vouch' | 'public', (typeof claims)[number]>>
  const rate = (rail: 'vouch' | 'public') => (byRail[rail] && byRail[rail]!.opens > 0 ? byRail[rail]!.claims / byRail[rail]!.opens : null)
  const totalOpens = claims.reduce((n, c) => n + c.opens, 0)
  const totalClaims = claims.reduce((n, c) => n + c.claims, 0)
  const opensOnFull = claims.reduce((n, c) => n + c.opens_on_full, 0)
  const latencyFromEvents = latencyEvents[0]?.p95 === null || latencyEvents[0]?.p95 === undefined ? null : Number(latencyEvents[0].p95)
  const p95 = latencyFromEvents ?? (options.source === 'live' ? await histogramP95() : null)

  const railsBelow = (['vouch', 'public'] as const).filter((r) => (byRail[r]?.opens ?? 0) >= min(MIN_OPENS) && (rate(r) ?? 1) < 0.25)
  const railsMeasured = (['vouch', 'public'] as const).filter((r) => (byRail[r]?.opens ?? 0) >= min(MIN_OPENS))

  const goals: Goal[] = [
    {
      key: 'never_oversell', label: 'Never oversell', current: oversold, currentDisplay: String(oversold), target: 0, targetDisplay: '0, ever',
      trigger: 'Any result', status: oversold > 0 ? 'trigger_fired' : 'on_target', sampleSize: oversold, minSample: 0,
    },
    {
      key: 'bookings_succeed', label: 'Bookings work when there\'s room', current: successRate, currentDisplay: pct(successRate), target: 0.995, targetDisplay: '99.5%',
      trigger: 'Under 99.5% in an hour with 500+ attempts', status: successDenominator < min(MIN_ATTEMPTS) || successRate === null ? 'no_data' : successRate < 0.995 ? 'trigger_fired' : 'on_target',
      sampleSize: successDenominator, minSample: min(MIN_ATTEMPTS),
    },
    {
      key: 'updates_live', label: 'Updates feel live (p95)', current: p95, currentDisplay: p95 === null ? 'no data yet' : p95 < 1 ? `${Math.round(p95 * 1000)} ms` : `${Math.round(p95 * 100) / 100} s`, target: 2, targetDisplay: '2 s',
      trigger: 'Over 2 s for 15 min', status: p95 === null ? 'no_data' : p95 > 2 ? 'trigger_fired' : 'on_target', sampleSize: p95 === null ? 0 : 1, minSample: 1,
    },
    {
      key: 'bookers_invite', label: 'Bookers invite', current: inviteRate, currentDisplay: pct(inviteRate), target: 0.3, targetDisplay: '30%',
      trigger: 'Under 30% two cohorts running', status: b.bookers < min(MIN_BOOKERS) || inviteRate === null ? 'no_data' : inviteRate < 0.3 ? 'trigger_fired' : 'on_target',
      sampleSize: b.bookers, minSample: min(MIN_BOOKERS),
    },
    {
      key: 'invites_convert', label: 'Invites turn into guests', current: totalOpens > 0 ? totalClaims / totalOpens : null, currentDisplay: pct(totalOpens > 0 ? totalClaims / totalOpens : null), target: 0.25, targetDisplay: '25% per rail',
      trigger: 'Under 25% two cohorts running', status: railsMeasured.length === 0 ? 'no_data' : railsBelow.length > 0 ? 'trigger_fired' : 'on_target',
      sampleSize: totalOpens, minSample: min(MIN_OPENS),
    },
  ]

  const triggers = goals
    .filter((g) => g.status === 'trigger_fired')
    .map((g) => ({
      goalKey: g.key,
      message:
        g.key === 'invites_convert'
          ? `Claim rate is under target on ${railsBelow.length === 2 ? 'both rails' : `the ${railsBelow[0]} rail`} for the window.`
          : g.key === 'never_oversell'
            ? `${oversold} activit${oversold === 1 ? 'y' : 'ies'} with more confirmed people than capacity or a drifted counter. That is an incident, not a plan.`
            : `${g.label} is at ${g.currentDisplay} against ${g.targetDisplay}.`,
    }))

  const first = firstActivity[0]?.first ?? null
  const weeksElapsed = first ? Math.min(HOLDOUT_WEEKS_PLANNED, Math.max(1, Math.ceil((now.getTime() - first.getTime()) / (7 * 86_400_000)))) : 0

  return {
    source: options.source,
    generatedAt: now.toISOString(),
    window: { from: from.toISOString(), to: now.toISOString(), days: options.windowDays },
    goals,
    triggers,
    claimRateByRail: { vouch: rate('vouch'), public: rate('public'), opens: { vouch: byRail.vouch?.opens ?? 0, public: byRail.public?.opens ?? 0 }, definition: 'Unique opens that end in a claim within 7 days' },
    opensOnFullShare: totalOpens > 0 ? opensOnFull / totalOpens : null,
    byPlatform: platformRows
      .filter((r) => r.views + r.booking_attempts + r.bookings + r.invite_opens + r.claims > 0)
      .map((r) => ({ platform: r.platform, views: r.views, bookingAttempts: r.booking_attempts, bookings: r.bookings, inviteOpens: r.invite_opens, claims: r.claims })),
    holdout: {
      holdoutPercent: HOLDOUT_PERCENT,
      weeksElapsed,
      weeksPlanned: HOLDOUT_WEEKS_PLANNED,
      note: `${HOLDOUT_PERCENT}% of activities have no invites. Attendees per activity are compared within host and category once the planned sample is reached.`,
      summary: holdoutRows.map((r) => ({ variant: r.variant, activities: r.activities, avgAttendees: r.avg_attendees, avgFillRate: r.avg_fill_rate, avgNewUsers: r.avg_new_users, bookingsPerView: r.bookings_per_view, avgGroupPlans: r.avg_group_plans })),
    },
    diagnosisQueries: [
      {
        title: 'Of invites opened, how many landed on a full activity, by rail and by days since the invite was sent',
        sql: "SELECT rail, saw_full, width_bucket(EXTRACT(EPOCH FROM first_open - invite_created_at) / 86400, 0, 7, 7) AS days_since_sent, COUNT(*) AS opens, COUNT(*) FILTER (WHERE claimed) AS claims FROM invite_opens GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;",
      },
      {
        title: 'Claims started against finished, split by wrong-contact errors on vouches, by platform and new or existing guest',
        sql: 'SELECT rail, platform, guest_kind, SUM(opened) AS opened, SUM(started) AS started, SUM(submitted) AS submitted, SUM(wrong_contact) AS wrong_contact, SUM(claimed) AS claimed FROM invite_funnel GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;',
      },
      {
        title: 'Public link opens per activity against spots left at open time',
        sql: "SELECT activity_id, COUNT(*) AS opens, COUNT(*) FILTER (WHERE claimed) AS claims, ROUND(AVG(min_spots_left_at_open), 1) AS avg_spots_left_at_open, COUNT(*) FILTER (WHERE saw_full) AS opens_on_full FROM invite_opens WHERE rail = 'public' GROUP BY 1 ORDER BY opens DESC;",
      },
    ],
  }
}

export type HealthReport = Awaited<ReturnType<typeof computeHealth>>
