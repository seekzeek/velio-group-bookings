import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'

export const registry = new Registry()
collectDefaultMetrics({ register: registry })

export const metrics = {
  bookingAttempts: new Counter({
    name: 'velio_booking_attempts_total',
    help: 'Booking attempts, direct or through an invite',
    labelNames: ['source', 'platform'] as const,
    registers: [registry],
  }),
  bookingSuccesses: new Counter({
    name: 'velio_booking_successes_total',
    help: 'Bookings that reserved a spot',
    labelNames: ['source', 'platform'] as const,
    registers: [registry],
  }),
  bookingRejections: new Counter({
    name: 'velio_booking_rejections_total',
    help: 'Bookings refused for a correct business reason, such as sold out',
    labelNames: ['source', 'code', 'platform'] as const,
    registers: [registry],
  }),
  bookingErrors: new Counter({
    name: 'velio_booking_errors_total',
    help: 'Bookings that failed for a reason that is not the system working as intended',
    labelNames: ['source', 'code', 'platform'] as const,
    registers: [registry],
  }),
  claims: new Counter({
    name: 'velio_invite_claims_total',
    help: 'Invite claim outcomes by rail',
    labelNames: ['rail', 'outcome', 'platform'] as const,
    registers: [registry],
  }),
  availabilityLatency: new Histogram({
    name: 'velio_availability_latency_seconds',
    help: 'From a booking committing to the update being written to each open SSE connection',
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  }),
  sseConnections: new Gauge({
    name: 'velio_sse_connections',
    help: 'Open availability streams',
    registers: [registry],
  }),
  requestErrors: new Counter({
    name: 'velio_request_errors_total',
    help: 'Requests that ended in a 5xx',
    labelNames: ['code'] as const,
    registers: [registry],
  }),
}

export const bookingRejectionCodes = new Set(['SOLD_OUT', 'ALREADY_BOOKED', 'ACTIVITY_STARTED', 'INVITE_EXPIRED', 'INVITE_USED', 'INVITE_REVOKED', 'INVITE_NOT_FOR_YOU', 'INVITES_OFF'])
