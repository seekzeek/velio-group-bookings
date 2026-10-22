import { PrismaPg } from '@prisma/adapter-pg'
import { config } from './config.js'
import { PrismaClient } from './generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: config.DATABASE_URL, max: config.PG_POOL_MAX })

export const prisma = new PrismaClient({ adapter })

export type Db = PrismaClient
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
export type DbClient = Db | Tx
