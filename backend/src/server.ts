import { createApp } from './app.js'
import { config } from './config.js'
import { prisma } from './db.js'
import { redis } from './lib/redis.js'
import { logger } from './logger.js'

const app = createApp()
const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'backend listening')
})

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  server.close()
  await Promise.allSettled([app.locals.live.close(), prisma.$disconnect(), redis.quit()])
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
