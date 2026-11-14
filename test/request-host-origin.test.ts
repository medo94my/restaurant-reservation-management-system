import { describe, expect, it } from 'vitest'
import { requestHostOrigin } from '../lib/request-host-origin'

const req = (headers: Record<string, string>) => new Request('http://internal/x', { headers })

describe('requestHostOrigin (Better Auth trustedOrigins callback)', () => {
  it('tolerates an undefined request — better-auth calls it without one on internal paths', () => {
    // Regression: an unguarded request.headers once crashed inside better-auth's
    // context resolution with an unhandled rejection, failing every sign-in.
    expect(requestHostOrigin(undefined)).toBeUndefined()
  })

  it('derives the origin from the Host header (localhost dev)', () => {
    expect(requestHostOrigin(req({ host: 'localhost:3003' }))).toBe('http://localhost:3003')
  })

  it('derives the origin from a LAN-IP host (iPad at the door)', () => {
    expect(requestHostOrigin(req({ host: '192.168.18.17:3003' }))).toBe('http://192.168.18.17:3003')
  })

  it('honors x-forwarded-proto behind a proxy', () => {
    expect(requestHostOrigin(req({ host: 'murex.vercel.app', 'x-forwarded-proto': 'https,http' }))).toBe('https://murex.vercel.app')
  })

  it('returns undefined without a Host header', () => {
    expect(requestHostOrigin(new Request('http://internal/x'))).toBeUndefined()
  })

  it('returns undefined for a malformed Host header', () => {
    expect(requestHostOrigin(req({ host: 'bad host with spaces' }))).toBeUndefined()
  })
})
