import type { Money } from "./api";

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string) {
  let f = dayFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" });
    dayFormatters.set(timeZone, f);
  }
  return f;
}

function timeFormatter(timeZone: string) {
  let f = timeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
    timeFormatters.set(timeZone, f);
  }
  return f;
}

/** "Sat 14 Nov" in the activity's own time zone. */
export function formatDay(iso: string, timeZone: string) {
  return dayFormatter(timeZone).format(new Date(iso)).replace(",", "");
}

/** "5:30 PM" in the activity's own time zone. */
export function formatTime(iso: string, timeZone: string) {
  return timeFormatter(timeZone).format(new Date(iso));
}

/** "Sat 14 Nov · 5:30 PM" */
export function formatWhen(iso: string, timeZone: string) {
  return `${formatDay(iso, timeZone)} · ${formatTime(iso, timeZone)}`;
}

// Narrow symbols so naira and rand read as ₦ and R, not as codes. The dollar lookalikes keep their prefix so pesos never read as USD.
const dollarLookalikes: Record<string, string> = { MXN: "MX$", ARS: "AR$", CAD: "CA$", AUD: "A$" };

export function formatMoney(money: Money) {
  const whole = money.amountMinor % 100 === 0;
  const text = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(money.amountMinor / 100);
  const prefix = dollarLookalikes[money.currency.toUpperCase()];
  return prefix ? text.replace(/^\$/, prefix) : text;
}

/** Shared rule from API.md: "N of 12 spots left", "Last spot of 12", "Full · 12 of 12 booked". */
export function spotsText(spotsLeft: number, capacity: number, short = false) {
  if (spotsLeft <= 0) return `Full · ${capacity} of ${capacity} booked`;
  if (spotsLeft === 1) return `Last spot of ${capacity}`;
  return short ? `${spotsLeft} of ${capacity} left` : `${spotsLeft} of ${capacity} spots left`;
}

export function isFillingFast(spotsLeft: number, capacity: number) {
  return spotsLeft > 0 && spotsLeft <= Math.ceil(capacity / 3);
}

export function isScarce(spotsLeft: number) {
  return spotsLeft > 0 && spotsLeft <= 3;
}

const avatarColours = ["#0F5F5C", "#8A5A44", "#6B4E9B", "#4A6B8A", "#4E7C8A", "#2F6D3A", "#7A5A2F", "#9A4A6B"];

export function avatarColour(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return avatarColours[h % avatarColours.length]!;
}

export function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** "just now", "20 min ago", "yesterday", "Mon", "3 weeks ago" */
export function formatRelative(iso: string, now = Date.now()) {
  const diff = now - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(iso));
  const weeks = Math.round(days / 7);
  if (weeks === 1) return "last week";
  return `${weeks} weeks ago`;
}

export function describeJoin(joinedVia: "direct" | "vouch" | "public", invitedBy: { id: string; displayName: string } | null, viewerId: string | null, role: "owner" | "member") {
  if (joinedVia === "direct") return role === "owner" ? "Started the plan" : "Booked";
  const by = invitedBy ? (invitedBy.id === viewerId ? "you" : invitedBy.displayName) : "someone";
  if (joinedVia === "vouch") return by === "you" ? "Claimed your vouch" : `Vouched by ${by}`;
  return by === "you" ? "Joined from your link" : `From ${by}'s link`;
}

export function listNames(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const categoryLabels: Record<string, string> = {
  outdoors: "Outdoors",
  nights_out: "Nights out",
  food_and_drink: "Food and drink",
  classes: "Classes",
  other: "Other",
};

export const timezones = [
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Zurich",
  "Europe/Rome",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Toronto",
  "America/Chicago",
  "America/Mexico_City",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function timezoneLabel(tz: string) {
  const city = tz.split("/").pop()!.replace(/_/g, " ");
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${city} · ${offset.replace("GMT", "UTC")}`;
}
