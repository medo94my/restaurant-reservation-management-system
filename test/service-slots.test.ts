import { describe, expect, it } from 'vitest'
import { SEATING_SPAN_MINUTES, timeDistanceMinutes } from '@/lib/service-slots'

describe('timeDistanceMinutes', () => {
  it('measures plain same-day distance', () => {
    expect(timeDistanceMinutes('19:00', '20:00')).toBe(60)
  })

  it('accepts HH:MM:SS strings as stored in the reservations column', () => {
    expect(timeDistanceMinutes('19:00:00', '20:30:00')).toBe(90)
  })

  it('measures the short way across midnight', () => {
    expect(timeDistanceMinutes('23:30', '00:30')).toBe(60)
    expect(timeDistanceMinutes('00:30', '23:30')).toBe(60)
  })

  it('treats identical times as zero distance', () => {
    expect(timeDistanceMinutes('19:45', '19:45')).toBe(0)
  })

  it('returns Infinity for unparseable times so malformed rows never block a booking', () => {
    expect(timeDistanceMinutes('banana', '19:00')).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('SEATING_SPAN_MINUTES', () => {
  it('assumes one seating occupies the table for 90 minutes', () => {
    expect(SEATING_SPAN_MINUTES).toBe(90)
  })
})
