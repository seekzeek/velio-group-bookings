import { describe, expect, it } from 'vitest'
import { deterministicUuid } from '../src/lib/ids.js'
import { HOLDOUT_PERCENT, activityBucket, invitesEnabledFor, isHoldout } from '../src/modules/flags/flags.js'
import { displayCode, generateCode, normalizeCode } from '../src/modules/invites/codes.js'
import { hmacContact, normalizeContact } from '../src/modules/invites/contacts.js'

const sample = Array.from({ length: 2000 }, (_, i) => deterministicUuid(`flag-sample-${i}`))

describe('invite flag', () => {
  it('buckets are stable and spread across 0 to 99', () => {
    const id = sample[0]!
    expect(activityBucket(id)).toBe(activityBucket(id))
    const buckets = new Set(sample.map(activityBucket))
    expect(buckets.size).toBe(100)
    const holdoutShare = sample.filter(isHoldout).length / sample.length
    expect(holdoutShare).toBeGreaterThan(0.07)
    expect(holdoutShare).toBeLessThan(0.13)
  })

  it('never enables the holdout, at any rollout', () => {
    const holdout = sample.filter(isHoldout)
    for (const rolloutPercent of [0, 5, 50, 100]) {
      expect(holdout.some((id) => invitesEnabledFor(id, { enabled: true, rolloutPercent }))).toBe(false)
    }
  })

  it('ramps only through the other 90 buckets and the kill switch wins', () => {
    const rest = sample.filter((id) => !isHoldout(id))
    expect(rest.some((id) => invitesEnabledFor(id, { enabled: true, rolloutPercent: 0 }))).toBe(false)
    expect(rest.every((id) => invitesEnabledFor(id, { enabled: true, rolloutPercent: 100 }))).toBe(true)
    const half = rest.filter((id) => invitesEnabledFor(id, { enabled: true, rolloutPercent: 50 })).length / rest.length
    expect(half).toBeGreaterThan(0.4)
    expect(half).toBeLessThan(0.6)
    expect(rest.some((id) => invitesEnabledFor(id, { enabled: false, rolloutPercent: 100 }))).toBe(false)
    expect(HOLDOUT_PERCENT).toBe(10)
  })
})

describe('contacts', () => {
  it('normalises phones to E.164 so different spellings hash the same', () => {
    const a = normalizeContact('+1 415 555 0133')
    const b = normalizeContact('(415) 555-0133')
    expect(a).toEqual({ kind: 'phone', value: '+14155550133' })
    expect(b).toEqual(a)
    expect(hmacContact(a!)).toBe(hmacContact(b!))
    expect(normalizeContact('0803 123 4567', 'NG')?.value).toBe('+2348031234567')
  })

  it('normalises emails and rejects junk', () => {
    expect(normalizeContact('  Dami@Example.COM ')).toEqual({ kind: 'email', value: 'dami@example.com' })
    expect(normalizeContact('not an email@')).toBeNull()
    expect(normalizeContact('12')).toBeNull()
    expect(normalizeContact('')).toBeNull()
  })

  it('hashes never equal the input', () => {
    const h = hmacContact({ kind: 'email', value: 'dami@example.com' })
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toContain('dami')
  })
})

describe('codes', () => {
  it('generates 8 characters from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
      expect(normalizeCode(code)).toBe(code)
    }
  })

  it('accepts dashes, spaces and lowercase, rejects lookalikes', () => {
    expect(normalizeCode(' ax7k-29qm ')).toBe('AX7K29QM')
    expect(displayCode('AX7K29QM')).toBe('AX7K-29QM')
    expect(normalizeCode('AX7K-29Q')).toBeNull()
    expect(normalizeCode('AX7K-29O1')).toBeNull()
  })
})
