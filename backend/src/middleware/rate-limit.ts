import type { RequestHandler } from 'express'
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { AppError } from '../errors.js'
import { ensureConnected, redis } from '../lib/redis.js'
import { normalizeCode } from '../modules/invites/codes.js'

export type RateLimitOptions = {
  enabled?: boolean
  windowMs?: number
  claimPerIp?: number
  claimPerCode?: number
  lookupPerIp?: number
  bookingPerUser?: number
  generalPerIp?: number
}

const passThrough: RequestHandler = (_req, _res, next) => next()

export function createRateLimiters(options: RateLimitOptions = {}) {
  const enabled = options.enabled ?? true
  if (!enabled) return { claim: passThrough, lookup: passThrough, booking: passThrough, general: passThrough }

  const windowMs = options.windowMs ?? 60_000

  const limiter = (name: string, limit: number, keyGenerator: Options['keyGenerator'], window = windowMs) =>
    rateLimit({
      windowMs: window,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator,
      store: new RedisStore({
        prefix: `rl:${name}:`,
        sendCommand: async (...args: string[]) => {
          await ensureConnected(redis)
          return redis.call(args[0]!, ...args.slice(1)) as Promise<string | number | (string | number)[]>
        },
      }),
      handler: (_req, _res, next, info) => {
        const retryAfterSeconds = Math.max(1, Math.ceil(info.windowMs / 1000))
        next(new AppError('RATE_LIMITED', { details: { retryAfterSeconds } }))
      },
    })

  const byIp: Options['keyGenerator'] = (req) => ipKeyGenerator(req.ip ?? '')
  const byCode: Options['keyGenerator'] = (req) => normalizeCode(String(req.params.code ?? '')) ?? 'invalid'
  const byUser: Options['keyGenerator'] = (req) => req.header('x-user-id') ?? ipKeyGenerator(req.ip ?? '')

  const claimIp = limiter('claim-ip', options.claimPerIp ?? 20, byIp, 10 * windowMs)
  const claimCode = limiter('claim-code', options.claimPerCode ?? 10, byCode, 10 * windowMs)
  const claim: RequestHandler = (req, res, next) => claimIp(req, res, (err?: unknown) => (err ? next(err) : claimCode(req, res, next)))

  return {
    claim,
    lookup: limiter('lookup-ip', options.lookupPerIp ?? 60, byIp),
    booking: limiter('booking-user', options.bookingPerUser ?? 30, byUser),
    general: limiter('general-ip', options.generalPerIp ?? 300, byIp),
  }
}

export type RateLimiters = ReturnType<typeof createRateLimiters>
