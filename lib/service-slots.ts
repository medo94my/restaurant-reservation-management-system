/**
 * Seating-slot math for same-table double-booking prevention.
 *
 * Two bookings for the same table on the same service date are a
 * double-booking when their start times are closer than one seating span —
 * a seating is assumed to occupy the table (turnover included) for that
 * span. Distance is measured cyclically across midnight, so a 23:30 booking
 * still conflicts with a 00:30 one.
 */
export const SEATING_SPAN_MINUTES = 90

/** Parse 'HH:MM' or 'HH:MM:SS' into minutes since midnight; null when unparseable. */
function minutesOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Minutes between two 'HH:MM[:SS]' times on the same service date, measured
 * the short way around the clock. Unparseable inputs return Infinity so
 * malformed rows can never block a booking.
 */
export function timeDistanceMinutes(a: string, b: string): number {
  const minuteA = minutesOfDay(a)
  const minuteB = minutesOfDay(b)
  if (minuteA === null || minuteB === null) return Number.POSITIVE_INFINITY
  const delta = Math.abs(minuteA - minuteB)
  return Math.min(delta, 1440 - delta)
}
