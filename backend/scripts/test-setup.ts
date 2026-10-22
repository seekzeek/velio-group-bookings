import { loadDotEnv } from '../src/lib/env-file.js'
import { prepareTestDatabase } from '../test/prepare-db.js'

loadDotEnv('.env')
const url = await prepareTestDatabase()
console.log(`test database ready at ${url.replace(/\/\/.*@/, '//')}`)
