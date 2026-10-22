import cors from 'cors'
import express from 'express'
import { pinoHttp } from 'pino-http'
import { config } from './config.js'
import { AppError } from './errors.js'
import { logger } from './logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { createRateLimiters, type RateLimitOptions } from './middleware/rate-limit.js'
import { prisma } from './db.js'
import { redis } from './lib/redis.js'
import { createBookingService, type BookingDeps, type Committed } from './modules/booking/booking.js'
import { createClaimService } from './modules/invites/claim.js'
import { createLiveHub, type LiveHubOptions } from './modules/live/hub.js'
import { publishAvailability } from './modules/live/publish.js'
import { activitiesRouter } from './routes/activities.js'
import { adminRouter } from './routes/admin.js'
import { createBookingRoutes } from './routes/bookings.js'
import { eventsRouter } from './routes/events.js'
import { healthRouter } from './routes/health.js'
import { createInviteRoutes } from './routes/invites.js'
import { metricsRouter } from './routes/metrics.js'
import { photosRouter } from './routes/photos.js'
import { plansRouter } from './routes/plans.js'
import { createStreamRouter } from './routes/stream.js'
import { meRouter, usersRouter } from './routes/users.js'

export type AppOptions = { booking?: BookingDeps; live?: LiveHubOptions; rateLimits?: RateLimitOptions }

export function createApp(options: AppOptions = {}) {
  const app = express()
  app.disable('x-powered-by')
  const live = createLiveHub(prisma, options.live)
  const onCommitted = options.booking?.onCommitted ?? ((change: Committed) => publishAvailability(redis, change))
  const bookingService = createBookingService({ ...options.booking, onCommitted })
  const claimService = createClaimService(bookingService, { onCommitted })
  const bookingRoutes = createBookingRoutes(bookingService)
  const limits = createRateLimiters({ enabled: config.RATE_LIMIT_ENABLED, ...options.rateLimits })
  app.locals.live = live
  app.locals.booking = bookingService

  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests without an Origin header come from the mobile app and curl, not a browser.
        if (!origin || config.webOrigins.includes(origin)) return callback(null, true)
        callback(null, false)
      },
      allowedHeaders: ['Content-Type', 'x-user-id', 'x-anon-id'],
      exposedHeaders: ['Retry-After'],
    }),
  )
  app.use(express.json({ limit: '64kb' }))
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' } }))

  app.use('/health', healthRouter)
  app.use('/metrics', metricsRouter)
  app.use(limits.general)
  app.use('/users', usersRouter)
  app.use('/me', meRouter)
  app.use('/activities/:id/stream', createStreamRouter(live))
  app.use('/activities/:id/bookings', limits.booking, bookingRoutes.activityBookings)
  app.use('/activities/:id/photos', photosRouter)
  app.use('/uploads', express.static(config.UPLOADS_DIR, { maxAge: '1d', index: false }))
  app.use('/activities', activitiesRouter)
  app.use('/bookings', bookingRoutes.bookings)
  app.use('/plans', plansRouter)
  app.use('/invites', createInviteRoutes(claimService, limits))
  app.use('/events', eventsRouter)
  app.use('/admin', adminRouter)

  app.use((_req, _res, next) => next(new AppError('NOT_FOUND')))
  app.use(errorHandler)
  return app
}
