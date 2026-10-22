import cors from 'cors'
import express from 'express'
import { pinoHttp } from 'pino-http'
import { config } from './config.js'
import { AppError } from './errors.js'
import { logger } from './logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { activitiesRouter } from './routes/activities.js'
import { healthRouter } from './routes/health.js'
import { invitesRouter } from './routes/invites.js'
import { meRouter, usersRouter } from './routes/users.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

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
  app.use('/users', usersRouter)
  app.use('/me', meRouter)
  app.use('/activities', activitiesRouter)
  app.use('/invites', invitesRouter)

  app.use((_req, _res, next) => next(new AppError('NOT_FOUND')))
  app.use(errorHandler)
  return app
}
