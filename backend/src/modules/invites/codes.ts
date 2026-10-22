import { randomInt } from 'node:crypto'

// No 0, O, 1, I or L, so a code read out loud or typed from a screenshot can't be misread.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 8

const alphabet = new Set(CODE_ALPHABET)

export function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

export function normalizeCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length !== CODE_LENGTH) return null
  for (const ch of cleaned) if (!alphabet.has(ch)) return null
  return cleaned
}

export function displayCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}
