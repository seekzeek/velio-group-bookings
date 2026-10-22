import { PrismaPg } from '@prisma/adapter-pg'
import { config } from '../config.js'
import type { Db } from '../db.js'
import { PrismaClient } from '../generated/prisma/client.js'

let scenario: Db | null = null

// The Part 4 scenario lives in its own database so the demo data and the synthetic 30 days never mix.
export function getScenarioDb(): Db | null {
  if (!config.SCENARIO_DATABASE_URL) return null
  if (!scenario) scenario = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.SCENARIO_DATABASE_URL, max: 4 }) })
  return scenario
}
