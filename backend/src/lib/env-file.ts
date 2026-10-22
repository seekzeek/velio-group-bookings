import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Values already in the environment win over the file, the same rule as node --env-file.
export function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return
  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}
