import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'

export const MANAGER_SESSION_COOKIE = 'restaurant-manager-session'
const SESSION_TTL_SECONDS = 8 * 60 * 60

type SessionPayload = { sub: string; exp: number }

function getSessionSecret() {
  const configuredSecret = process.env.MANAGER_SESSION_SECRET
  const databaseSecret = process.env.DATABASE_URL
  if (!configuredSecret || !databaseSecret) return null
  return createHmac('sha256', databaseSecret)
    .update(`restaurant-manager-session:v1:${configuredSecret}`)
    .digest('base64url')
}

function signatureFor(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createManagerSessionToken() {
  const secret = getSessionSecret()
  if (!secret) throw new Error('Manager session signing is not configured')

  const payload = Buffer.from(JSON.stringify({
    sub: RESTAURANT_MANAGER_USER_ID,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  } satisfies SessionPayload)).toString('base64url')

  return `${payload}.${signatureFor(payload, secret)}`
}

export function managerCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  }
}

function verifyToken(token: string | undefined): SessionPayload | null {
  const secret = getSessionSecret()
  if (!secret || !token) return null

  const [encodedPayload, signature, extra] = token.split('.')
  if (!encodedPayload || !signature || extra !== undefined) return null

  const expectedSignature = signatureFor(encodedPayload, secret)
  if (!safeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload
    if (payload.sub !== RESTAURANT_MANAGER_USER_ID || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function getManagerSession() {
  const cookieStore = await cookies()
  const payload = verifyToken(cookieStore.get(MANAGER_SESSION_COOKIE)?.value)
  return payload ? { userId: payload.sub } : null
}

export function verifyManagerPin(value: unknown) {
  const expectedPin = process.env.MANAGER_PIN
  if (typeof value !== 'string' || !expectedPin || !/^\d{6}$/.test(expectedPin) || !/^\d{6}$/.test(value)) return false
  return safeEqual(value, expectedPin)
}

export function managerSessionIsConfigured() {
  return Boolean(process.env.MANAGER_PIN && /^\d{6}$/.test(process.env.MANAGER_PIN) && getSessionSecret())
}
