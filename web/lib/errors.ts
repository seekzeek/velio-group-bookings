export type ErrorCode =
  | "SOLD_OUT"
  | "ALREADY_BOOKED"
  | "ACTIVITY_STARTED"
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_USED"
  | "INVITE_REVOKED"
  | "INVITE_NOT_FOR_YOU"
  | "INVITES_OFF"
  | "VOUCH_LIMIT"
  | "NOT_GOING"
  | "PHOTO_TOO_LARGE"
  | "PHOTO_TYPE"
  | "PHOTO_LIMIT"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TRY_AGAIN"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string | undefined, status: number, details?: Record<string, unknown>) {
    super(message ?? errorCopy[code].title);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiError(err: unknown, code?: ErrorCode): err is ApiError {
  return err instanceof ApiError && (code === undefined || err.code === code);
}

// What each code means to a person, matching API.md. Screens use these instead of raw messages.
export const errorCopy: Record<ErrorCode, { title: string; body: string; next: "other_dates" | "explore" | "plan" | "retry" | "fix_field" | "pick_user" | "none" }> = {
  SOLD_OUT: { title: "Someone got there a second before you", body: "The last spot went while you were booking, so you haven't been booked.", next: "other_dates" },
  ALREADY_BOOKED: { title: "You're already going", body: "Your spot is saved. Here's your plan.", next: "plan" },
  ACTIVITY_STARTED: { title: "This one has already started", body: "Here's what's coming up instead.", next: "explore" },
  INVITE_NOT_FOUND: { title: "We can't find that code", body: "Check it with whoever sent it. Capitals and dashes don't matter.", next: "fix_field" },
  INVITE_EXPIRED: { title: "This invite has expired", body: "The activity it was for has already happened.", next: "explore" },
  INVITE_USED: { title: "This invite has already been claimed", body: "Ask the person who sent it for another one.", next: "explore" },
  INVITE_REVOKED: { title: "This link was turned off", body: "The person who shared it turned it off. Ask them for a new one.", next: "explore" },
  INVITE_NOT_FOR_YOU: { title: "This invite was sent to a different number or email", body: "Check which one they used.", next: "fix_field" },
  INVITES_OFF: { title: "Invites aren't available for this activity", body: "You can still book a spot directly.", next: "explore" },
  VOUCH_LIMIT: { title: "You've vouched for 10 people on this one", body: "Share the link instead.", next: "none" },
  NOT_GOING: { title: "Book a spot first", body: "Then bring your people.", next: "explore" },
  PHOTO_TOO_LARGE: { title: "This one's over 10 MB", body: "Try a smaller photo.", next: "fix_field" },
  PHOTO_TYPE: { title: "Photos need to be JPG, PNG or WebP", body: "", next: "fix_field" },
  PHOTO_LIMIT: { title: "That's the limit of 6 photos", body: "", next: "none" },
  VALIDATION: { title: "Some of that isn't right", body: "Check the highlighted fields.", next: "fix_field" },
  UNAUTHENTICATED: { title: "Pick who you are first", body: "Choose a user at the top of the page.", next: "pick_user" },
  FORBIDDEN: { title: "That isn't yours to change", body: "", next: "none" },
  NOT_FOUND: { title: "We can't find that one", body: "It may have been removed.", next: "explore" },
  RATE_LIMITED: { title: "Slow down a moment", body: "Try again in a few seconds.", next: "retry" },
  TRY_AGAIN: { title: "Something went wrong on our side", body: "Nothing was booked. Try again.", next: "retry" },
  INTERNAL: { title: "Something went wrong on our side", body: "Nothing was booked. Try again.", next: "retry" },
};
