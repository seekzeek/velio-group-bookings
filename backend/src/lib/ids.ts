import { createHash } from 'node:crypto'

// A UUID derived from a name, so seeds and fixtures get the same ids on every run.
export function deterministicUuid(name: string): string {
  const bytes = createHash('sha256').update(name).digest().subarray(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Walks deterministic ids until one lands where the flag needs it, so a seed can place an activity in or out of the holdout.
export function deterministicUuidWhere(name: string, accept: (id: string) => boolean): string {
  for (let i = 0; i < 10_000; i++) {
    const id = deterministicUuid(`${name}:${i}`)
    if (accept(id)) return id
  }
  throw new Error(`No id found for ${name}`)
}
