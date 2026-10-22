import { prepareTestDatabase } from './prepare-db.js'

export default async function setup() {
  await prepareTestDatabase()
}
