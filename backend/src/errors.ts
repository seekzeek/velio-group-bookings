export const errorCatalog = {
  SOLD_OUT: { status: 409, message: 'Someone got there a second before you. The last spot went while you were booking, so you haven\'t been booked.' },
  ALREADY_BOOKED: { status: 409, message: 'You\'re already going to this one.' },
  ACTIVITY_STARTED: { status: 410, message: 'This one has already started.' },
  INVITE_NOT_FOUND: { status: 404, message: 'We can\'t find that code. Check it with whoever sent it.' },
  INVITE_EXPIRED: { status: 410, message: 'This invite has expired.' },
  INVITE_USED: { status: 409, message: 'This invite has already been claimed. Ask the person who sent it.' },
  INVITE_REVOKED: { status: 410, message: 'This link was turned off by the person who shared it.' },
  INVITE_NOT_FOR_YOU: { status: 403, message: 'This invite was sent to a different number or email.' },
  INVITES_OFF: { status: 403, message: 'Invites aren\'t available for this activity.' },
  VOUCH_LIMIT: { status: 409, message: 'You\'ve vouched for 10 people on this one. Share the link instead.' },
  NOT_GOING: { status: 403, message: 'Book a spot first, then bring your people.' },
  PHOTO_TOO_LARGE: { status: 413, message: 'This one\'s over 10 MB. Try a smaller photo.' },
  PHOTO_TYPE: { status: 415, message: 'Photos need to be JPG, PNG or WebP.' },
  PHOTO_LIMIT: { status: 409, message: 'That\'s the limit of 6 photos.' },
  VALIDATION: { status: 400, message: 'Some of what you sent isn\'t right.' },
  UNAUTHENTICATED: { status: 401, message: 'We don\'t know who you are yet.' },
  FORBIDDEN: { status: 403, message: 'That isn\'t yours to change.' },
  NOT_FOUND: { status: 404, message: 'We can\'t find that one.' },
  RATE_LIMITED: { status: 429, message: 'Slow down a moment, then try again.' },
  TRY_AGAIN: { status: 503, message: 'Something went wrong on our side. Try again.' },
  INTERNAL: { status: 500, message: 'Something went wrong on our side.' },
} as const

export type ErrorCode = keyof typeof errorCatalog

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: Record<string, unknown> | undefined

  constructor(code: ErrorCode, options: { message?: string; details?: Record<string, unknown> } = {}) {
    super(options.message ?? errorCatalog[code].message)
    this.name = 'AppError'
    this.code = code
    this.status = errorCatalog[code].status
    this.details = options.details
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } }
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
