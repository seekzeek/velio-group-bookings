// Joins the k6 booking log with the listener log on the shared clock and prints the numbers against the SLOs.
// Usage: node report.mjs   (after book.js and listen.mjs have run)

import { readFileSync } from 'node:fs'

const fixture = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'))
const read = (name) => readFileSync(new URL(`./out/${name}`, import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l))

// Only this fixture's activities count, in case out/ still holds an earlier run.
const current = new Set(fixture.activities)
const booked = read('k6.log').filter((e) => e.kind === 'booked' && current.has(e.activityId))
const errored = read('k6.log').filter((e) => e.kind === 'error')
const seen = new Map()
for (const e of read('listener.ndjson')) {
  const key = `${e.activityId}:${e.version}`
  if (!seen.has(key) || seen.get(key) > e.t) seen.set(key, e.t)
}

const latencies = []
let missing = 0
for (const b of booked) {
  const t = seen.get(`${b.activityId}:${b.version}`)
  if (t === undefined) missing += 1
  else latencies.push(t - b.t0)
}
latencies.sort((a, b) => a - b)
const pct = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil((p / 100) * latencies.length) - 1)] : null)

const summary = JSON.parse(readFileSync(new URL('./out/summary.json', import.meta.url), 'utf8'))
const count = (name) => summary.metrics[name]?.values.count ?? 0
const okCount = count('bookings_ok')
const errCount = count('bookings_errors')
const successRate = okCount + errCount === 0 ? null : okCount / (okCount + errCount)

const health = await fetch(`${fixture.apiBase}/admin/health?minSample=0`).then((r) => r.json())
const goal = (key) => health.goals.find((g) => g.key === key)

// The server-side histogram from commit to SSE write. Buckets only give an upper bound for the percentile.
const metrics = await fetch(`${fixture.apiBase}/metrics`).then((r) => r.text())
const buckets = [...metrics.matchAll(/velio_availability_latency_seconds_bucket\{le="([^"]+)"\} (\d+)/g)].map((m) => ({ le: m[1], n: Number(m[2]) }))
const total = buckets.find((b) => b.le === '+Inf')?.n ?? 0
const serverP95 = buckets.find((b) => b.n >= total * 0.95)

const row = (label, value, target, ok) => `| ${label} | ${value} | ${target} | ${ok ? 'yes' : 'no'} |`
console.log(`Load run: ${booked.length} bookings matched against ${seen.size} stream events on ${fixture.activities.length} activities${missing ? `, ${missing} bookings never seen on the stream` : ''}.\n`)
console.log('| SLO | Measured | Target | Met |')
console.log('| --- | --- | --- | --- |')
console.log(row('Never oversell', `${goal('never_oversell').current} oversold`, '0', goal('never_oversell').current === 0))
console.log(row('Bookings succeed when spots exist', successRate === null ? 'n/a' : `${(successRate * 100).toFixed(2)}% (${okCount} ok, ${errCount} errors, ${count('bookings_sold_out')} correct sold-out rejections)`, '99.5%', successRate !== null && successRate >= 0.995))
console.log(row('Availability feels live, end to end', latencies.length ? `p50 ${pct(50)} ms · p95 ${pct(95)} ms · max ${latencies[latencies.length - 1]} ms` : 'n/a', 'p95 under 2 s', latencies.length > 0 && pct(95) < 2000))
console.log(row('Availability, commit to SSE write (server clock)', total ? `p95 under ${Number(serverP95.le) * 1000} ms (${total} writes)` : 'n/a', 'p95 under 2 s', total > 0 && Number(serverP95.le) < 2))
console.log(`\nBooking request latency p95: ${summary.metrics.booking_latency_ms?.values['p(95)'].toFixed(0)} ms at ${summary.metrics.iterations?.values.rate.toFixed(1)} attempts/s.`)
if (errored.length) console.log(`\nErrors:\n${errored.slice(0, 5).map((e) => `  ${e.status} ${e.body}`).join('\n')}`)
