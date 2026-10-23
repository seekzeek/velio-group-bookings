// Books against the load activities at a steady rate. Each iteration is a distinct (booker, activity) pair, so every
// attempt is a real first booking until an activity sells out. Run with:
//   k6 run --log-output=file=out/k6.log --log-format=raw book.js
// Each successful booking is logged as one JSON line with the time the request started and the version it produced,
// so report.mjs can join it with the listener's clock.

import http from 'k6/http'
import exec from 'k6/execution'
import { Counter, Trend } from 'k6/metrics'

const fixture = JSON.parse(open('./fixture.json'))

const ok = new Counter('bookings_ok')
const soldOut = new Counter('bookings_sold_out')
const alreadyBooked = new Counter('bookings_already_booked')
const errors = new Counter('bookings_errors')
const latency = new Trend('booking_latency_ms', true)

export const options = {
  scenarios: {
    book: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 40),
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 60,
      maxVUs: 200,
    },
  },
  thresholds: {
    bookings_errors: ['count==0'],
    booking_latency_ms: ['p(95)<2000'],
  },
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export default function () {
  const i = exec.scenario.iterationInTest
  const user = fixture.users[i % fixture.users.length]
  const activity = fixture.activities[i % fixture.activities.length]
  const t0 = Date.now()
  const res = http.post(`${fixture.apiBase}/activities/${activity}/bookings`, JSON.stringify({ idempotencyKey: uuid(), platform: 'web' }), {
    headers: { 'Content-Type': 'application/json', 'x-user-id': user },
    tags: { name: 'book' },
  })
  const t1 = Date.now()
  latency.add(t1 - t0)

  if (res.status === 201) {
    ok.add(1)
    console.log(JSON.stringify({ kind: 'booked', t0, t1, activityId: activity, version: res.json('activity.version') }))
    return
  }
  const code = res.status === 409 ? res.json('error.code') : null
  if (code === 'SOLD_OUT') soldOut.add(1)
  else if (code === 'ALREADY_BOOKED') alreadyBooked.add(1)
  else {
    errors.add(1)
    console.log(JSON.stringify({ kind: 'error', t0, status: res.status, body: String(res.body).slice(0, 200) }))
  }
}

export function handleSummary(data) {
  const m = data.metrics
  const count = (name) => (m[name] && m[name].values.count) || 0
  const okCount = count('bookings_ok')
  const errCount = count('bookings_errors')
  const lines = [
    `bookings: ${okCount} ok, ${count('bookings_sold_out')} sold out, ${count('bookings_already_booked')} already booked, ${errCount} errors`,
    `success rate excluding correct rejections: ${okCount + errCount === 0 ? 'n/a' : ((okCount / (okCount + errCount)) * 100).toFixed(2)}%`,
    `request latency p95: ${m.booking_latency_ms ? m.booking_latency_ms.values['p(95)'].toFixed(0) : '?'} ms`,
    '',
  ]
  return { 'out/summary.json': JSON.stringify(data, null, 2), stdout: lines.join('\n') }
}
