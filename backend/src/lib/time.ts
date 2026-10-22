const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timezone: string) {
  let f = formatters.get(timezone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(timezone, f)
  }
  return f
}

export function isValidTimezone(timezone: string): boolean {
  try {
    formatter(timezone)
    return true
  } catch {
    return false
  }
}

function wallClockAsUtcMillis(instant: Date, timezone: string): number {
  const parts = Object.fromEntries(formatter(timezone).formatToParts(instant).map((p) => [p.type, p.value]))
  return Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!)
}

// Corrects a UTC guess by the zone's offset at that guess, twice, which settles on the right instant across DST edges.
export function localToUtc(local: string, timezone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!m) throw new Error(`Not a local time: ${local}`)
  const wanted = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0))
  let guess = wanted
  for (let i = 0; i < 2; i++) {
    const offset = wallClockAsUtcMillis(new Date(guess), timezone) - guess
    guess = wanted - offset
  }
  return new Date(guess)
}
