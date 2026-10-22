import { createHmac } from 'node:crypto'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { config } from '../../config.js'

export type NormalizedContact = { kind: 'email' | 'phone'; value: string }

// HMAC is exact, so "+234 803..." and "0803..." have to become the same string before hashing.
export function normalizeContact(raw: string, region: string = config.DEFAULT_PHONE_REGION): NormalizedContact | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { kind: 'email', value: email } : null
  }
  const justDigits = trimmed.replace(/\D/g, '')
  if (justDigits.length < 7 || justDigits.length > 15) return null
  const parsed = parsePhoneNumberFromString(trimmed, region as CountryCode)
  if (parsed?.isPossible()) return { kind: 'phone', value: parsed.number }
  return { kind: 'phone', value: trimmed.startsWith('+') ? `+${justDigits}` : justDigits }
}

export function hmacContact(normalized: NormalizedContact): string {
  return createHmac('sha256', config.CONTACT_HMAC_SECRET).update(`${normalized.kind}:${normalized.value}`).digest('hex')
}

export function contactHmacFromRaw(raw: string): string | null {
  const normalized = normalizeContact(raw)
  return normalized ? hmacContact(normalized) : null
}
