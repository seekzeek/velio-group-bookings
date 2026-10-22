import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError, isAppError } from '../errors.js'
import { logger } from '../logger.js'
import { metrics } from '../modules/tracking/metrics.js'

function fieldErrors(err: ZodError) {
  const fields: Record<string, string> = {}
  for (const issue of err.issues) fields[issue.path.join('.') || 'body'] = issue.message
  return fields
}

type PrismaLikeError = { code?: string; name?: string }

function translate(err: unknown): AppError {
  if (isAppError(err)) return err
  if (err instanceof ZodError) return new AppError('VALIDATION', { details: { fields: fieldErrors(err) } })
  if (err instanceof SyntaxError && 'body' in err) return new AppError('VALIDATION', { message: 'The request body is not valid JSON.' })
  const code = (err as PrismaLikeError).code
  if (code === 'P2028' || code === 'P2024') return new AppError('TRY_AGAIN')
  if (code === 'P2025') return new AppError('NOT_FOUND')
  return new AppError('INTERNAL')
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = translate(err)
  if (appError.status >= 500) {
    metrics.requestErrors.inc({ code: appError.code })
    logger.error({ err, path: req.path, method: req.method, code: appError.code }, 'request failed')
  }
  if (res.headersSent) return
  if (appError.details?.retryAfterSeconds) res.setHeader('Retry-After', String(appError.details.retryAfterSeconds))
  res.status(appError.status).json(appError.toJSON())
}
