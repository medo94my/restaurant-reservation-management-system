import { describe, expect, it } from 'vitest'
import { allowedOrigins, isSameOrigin } from '../lib/same-origin'

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })

describe('isSameOrigin (the CSRF gate on every mutating route)', () => {
  it('accepts a direct localhost hit', () => {
    const r = req('http://localhost:3000/api/staff/login', { host: 'localhost:3000', origin: 'http://localhost:3000' })
    expect(isSameOrigin(r)).toBe(true)
  })

  it('accepts a LAN-IP host — the iPad at the door', () => {
    const r = req('http://192.168.18.17:3000/api/auth/sign-out', { host: '192.168.18.17:3000', origin: 'http://192.168.18.17:3000' })
    expect(isSameOrigin(r)).toBe(true)
  })

  it('accepts the forwarded host behind a proxy when it matches Host', () => {
    const r = req('http://10.0.0.1:3000/api/staff/login', {
      host: 'murex-preview.vercel.app',
      'x-forwarded-host': 'murex-preview.vercel.app',
      'x-forwarded-proto': 'https',
      origin: 'https://murex-preview.vercel.app',
    })
    expect(isSameOrigin(r)).toBe(true)
  })

  it('accepts an origin from a trusted deployment env var', () => {
    process.env.VERCEL_URL = 'murex-prod.vercel.app'
    try {
      const r = req('http://10.0.0.1:3000/api/staff/login', { host: '10.0.0.1:3000', origin: 'https://murex-prod.vercel.app' })
      expect(isSameOrigin(r)).toBe(true)
    } finally {
      delete process.env.VERCEL_URL
    }
  })

  it('rejects a cross-site origin', () => {
    const r = req('http://localhost:3000/api/staff/login', { host: 'localhost:3000', origin: 'https://evil.example' })
    expect(isSameOrigin(r)).toBe(false)
  })

  it('rejects a sandboxed-iframe null origin', () => {
    const r = req('http://localhost:3000/api/staff/login', { host: 'localhost:3000', origin: 'null' })
    expect(isSameOrigin(r)).toBe(false)
  })

  it('rejects a forwarded host that matches neither Host nor the trusted env', () => {
    const r = req('http://10.0.0.1:3000/api/staff/login', {
      host: 'murex-preview.vercel.app',
      'x-forwarded-host': 'spoofed.attacker.example',
      origin: 'https://spoofed.attacker.example',
    })
    expect(isSameOrigin(r)).toBe(false)
  })

  it('exposes the Host-derived origins in allowedOrigins (http and https variants)', () => {
    const origins = allowedOrigins(req('http://localhost:3000/x', { host: 'localhost:3000' }))
    expect(origins.has('http://localhost:3000')).toBe(true)
    expect(origins.has('https://localhost:3000')).toBe(true)
  })
})
