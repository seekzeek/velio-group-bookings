// Prints the diagnostic queries behind OWNERSHIP.md against the scenario database (or any database via DATABASE_URL).
// Run with `npm run diagnostics`. Add `--sql` to print the SQL instead of running it.

import { PrismaPg } from '@prisma/adapter-pg'
import { loadDotEnv } from '../src/lib/env-file.js'

loadDotEnv('.env')
process.env.NODE_ENV ??= 'development'
const { PrismaClient } = await import('../src/generated/prisma/client.js')

function targetUrl(): string {
  if (process.env.SCENARIO_DATABASE_URL) return process.env.SCENARIO_DATABASE_URL
  const base = new URL(process.env.DATABASE_URL ?? 'postgresql://velio:velio@localhost:5432/velio')
  base.pathname = '/velio_scenario'
  return base.toString()
}

export const diagnostics: { key: string; title: string; sql: string }[] = [
  {
    key: 'overview',
    title: 'The scope goals over the whole window',
    sql: `
SELECT 'bookers who invite' AS metric, ROUND(SUM(inviters)::numeric / NULLIF(SUM(bookers), 0), 3) AS value, SUM(bookers) AS sample FROM bookers_invite_rate
UNION ALL
SELECT 'opened invites claimed', ROUND(SUM(claims)::numeric / NULLIF(SUM(opens), 0), 3), SUM(opens) FROM invite_claim_rate
UNION ALL
SELECT 'opens on a full activity', ROUND(SUM(opens_on_full)::numeric / NULLIF(SUM(opens), 0), 3), SUM(opens) FROM invite_claim_rate
UNION ALL
SELECT 'booking success (excl. correct rejections)', ROUND(SUM(succeeded)::numeric / NULLIF(SUM(attempts) - SUM(rejected), 0), 4), SUM(attempts) - SUM(rejected) FROM booking_success_rate
UNION ALL
SELECT 'oversold or drifted activities', COUNT(*), COUNT(*) FROM oversell_check;`,
  },
  {
    key: 'by_spots_left',
    title: 'Claim rate by spots left when the invite was opened',
    sql: `
SELECT CASE WHEN saw_full THEN 'full' WHEN min_spots_left_at_open <= 2 THEN '1 to 2 left' WHEN min_spots_left_at_open <= 5 THEN '3 to 5 left' ELSE '6 or more left' END AS spots_at_open,
       COUNT(*) AS opens, COUNT(*) FILTER (WHERE claimed) AS claims,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*), 0), 3) AS claim_rate
FROM invite_opens GROUP BY 1 ORDER BY MIN(COALESCE(min_spots_left_at_open, 0));`,
  },
  {
    key: 'by_platform',
    title: 'Claim rate by platform',
    sql: `
SELECT platform, COUNT(*) AS opens, COUNT(*) FILTER (WHERE claimed) AS claims,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*), 0), 3) AS claim_rate,
       ROUND(COUNT(*) FILTER (WHERE saw_full)::numeric / NULLIF(COUNT(*), 0), 3) AS share_on_full
FROM invite_opens GROUP BY 1 ORDER BY 1;`,
  },
  {
    key: 'by_rail',
    title: 'Claim rate by rail, with and without the opens that landed on a full activity',
    sql: `
SELECT rail, COUNT(*) AS opens, COUNT(*) FILTER (WHERE claimed) AS claims,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*), 0), 3) AS claim_rate,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*) FILTER (WHERE NOT saw_full), 0), 3) AS claim_rate_when_open
FROM invite_opens GROUP BY 1 ORDER BY 1::text;`,
  },
  {
    key: 'by_guest_kind',
    title: 'Claim rate for new against existing guests (known only once they claim, so compare attempts)',
    sql: `
SELECT guest_kind, SUM(opened) AS opened, SUM(started) AS started, SUM(submitted) AS submitted, SUM(claimed) AS claimed,
       ROUND(SUM(claimed)::numeric / NULLIF(SUM(submitted), 0), 3) AS claimed_per_submitted
FROM invite_funnel GROUP BY 1 ORDER BY 1;`,
  },
  {
    key: 'by_delay',
    title: 'Claim rate by time from invite created to first open',
    sql: `
SELECT CASE WHEN first_open - invite_created_at < interval '1 day' THEN 'same day'
            WHEN first_open - invite_created_at < interval '3 days' THEN '1 to 2 days'
            ELSE '3 days or more' END AS opened_after,
       COUNT(*) AS opens, COUNT(*) FILTER (WHERE claimed) AS claims,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*), 0), 3) AS claim_rate,
       ROUND(COUNT(*) FILTER (WHERE saw_full)::numeric / NULLIF(COUNT(*), 0), 3) AS share_on_full
FROM invite_opens GROUP BY 1 ORDER BY MIN(first_open - invite_created_at);`,
  },
  {
    key: 'by_delay_and_rail',
    title: 'The same delay split per rail',
    sql: `
SELECT rail,
       CASE WHEN first_open - invite_created_at < interval '1 day' THEN 'same day'
            WHEN first_open - invite_created_at < interval '3 days' THEN '1 to 2 days'
            ELSE '3 days or more' END AS opened_after,
       COUNT(*) AS opens, COUNT(*) FILTER (WHERE claimed) AS claims,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*), 0), 3) AS claim_rate,
       ROUND(COUNT(*) FILTER (WHERE saw_full)::numeric / NULLIF(COUNT(*), 0), 3) AS share_on_full
FROM invite_opens GROUP BY 1, 2 ORDER BY 1::text, MIN(first_open - invite_created_at);`,
  },
  {
    key: 'funnel',
    title: 'Where in the claim flow people stop: opened, started details, submitted, claimed',
    sql: `
SELECT rail, SUM(opened) AS opened, SUM(started) AS started, SUM(submitted) AS submitted, SUM(wrong_contact) AS wrong_contact, SUM(claimed) AS claimed,
       ROUND(SUM(started)::numeric / NULLIF(SUM(opened), 0), 3) AS started_rate,
       ROUND(SUM(submitted)::numeric / NULLIF(SUM(started), 0), 3) AS submitted_rate,
       ROUND(SUM(claimed)::numeric / NULLIF(SUM(submitted), 0), 3) AS claimed_rate
FROM invite_funnel GROUP BY 1 ORDER BY 1::text;`,
  },
  {
    key: 'funnel_with_spot',
    title: 'The same funnel counting only opens that found a spot, since nobody can start a claim on a full activity',
    sql: `
SELECT rail, COUNT(*) AS opened_with_spot, COUNT(*) FILTER (WHERE started) AS started, COUNT(*) FILTER (WHERE submitted) AS submitted, COUNT(*) FILTER (WHERE claimed) AS claimed,
       ROUND(COUNT(*) FILTER (WHERE started)::numeric / NULLIF(COUNT(*), 0), 3) AS started_rate,
       ROUND(COUNT(*) FILTER (WHERE submitted)::numeric / NULLIF(COUNT(*) FILTER (WHERE started), 0), 3) AS submitted_rate,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*) FILTER (WHERE submitted), 0), 3) AS claimed_rate
FROM invite_opens WHERE NOT saw_full GROUP BY 1 ORDER BY 1::text;`,
  },
  {
    key: 'rejections',
    title: 'Why claims were rejected',
    sql: `
SELECT rail, props->>'code' AS code, COUNT(*) AS rejections
FROM events WHERE name = 'claim_rejected' GROUP BY 1, 2 ORDER BY 1::text, 3 DESC;`,
  },
  {
    key: 'k_factor',
    title: 'K-factor by rail',
    sql: `
SELECT rail, SUM(bookers) AS bookers, SUM(new_users) AS new_users, ROUND(SUM(new_users)::numeric / NULLIF(SUM(bookers), 0), 3) AS k_factor
FROM k_factor_by_rail GROUP BY 1 ORDER BY 1::text;`,
  },
  {
    key: 'holdout',
    title: 'Treatment against holdout activities',
    sql: `SELECT * FROM holdout_summary ORDER BY variant;`,
  },
  {
    key: 'holdout_within_category',
    title: 'Treatment against holdout within category, started activities only',
    sql: `
SELECT category, variant, COUNT(*) AS activities, ROUND(AVG(confirmed_attendees), 2) AS avg_attendees,
       ROUND(AVG(confirmed_attendees::numeric / NULLIF(capacity, 0)), 3) AS avg_fill_rate, ROUND(AVG(group_plans), 2) AS avg_group_plans
FROM holdout_comparison WHERE started GROUP BY 1, 2 ORDER BY 1, 2;`,
  },
  {
    key: 'groups',
    title: 'Plans that were still a group of two or more when the activity started',
    sql: `
SELECT COUNT(*) FILTER (WHERE started) AS plans_started, COUNT(*) FILTER (WHERE started AND is_group) AS groups_started,
       ROUND(COUNT(*) FILTER (WHERE started AND is_group)::numeric / NULLIF(COUNT(*) FILTER (WHERE started), 0), 3) AS group_share
FROM plan_sizes;`,
  },
  {
    key: 'latency',
    title: 'Availability update latency, p50 and p95, from the delivery events',
    sql: `
SELECT ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'latencyMs')::numeric)) AS p50_ms,
       ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY (props->>'latencyMs')::numeric)) AS p95_ms,
       COUNT(*) AS samples
FROM events WHERE name = 'availability_delivered';`,
  },
]

function printTable(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return console.log('  (no rows)')
  const columns = Object.keys(rows[0]!)
  const cell = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' && v instanceof Date ? v.toISOString() : String(v))
  const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => cell(r[c]).length)))
  console.log('  ' + columns.map((c, i) => c.padEnd(widths[i]!)).join('  '))
  for (const r of rows) console.log('  ' + columns.map((c, i) => cell(r[c]).padEnd(widths[i]!)).join('  '))
}

if (process.argv.includes('--sql')) {
  for (const d of diagnostics) console.log(`-- ${d.title}\n${d.sql.trim()}\n`)
} else {
  const url = targetUrl()
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) })
  try {
    console.log(`Diagnostics against ${url.replace(/\/\/.*@/, '//')}\n`)
    for (const d of diagnostics) {
      console.log(`${d.title}`)
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(d.sql)
      printTable(rows)
      console.log()
    }
  } finally {
    await prisma.$disconnect()
  }
}
