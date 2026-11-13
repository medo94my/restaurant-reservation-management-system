import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, restaurantStaffProfiles } from '@/lib/db'
import { clearLoginThrottle, consumeLoginThrottle, loginThrottleKeys, staffAuthUsername } from '@/lib/staff-auth'
import { RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'
import { isSameOrigin } from '@/lib/same-origin'

const genericFailure = () => NextResponse.json({ error: 'Unable to sign in. Check your staff ID and passcode.' }, { status: 401 })

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  if (requestOrigin && !isSameOrigin(request)) {
    return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return genericFailure()
  }

  if (!body || typeof body !== 'object') return genericFailure()
  const payload = body as Record<string, unknown>
  const staffId = typeof payload.staffId === 'string' ? payload.staffId.trim().toLowerCase() : ''
  const passcode = typeof payload.passcode === 'string' ? payload.passcode : ''
  if (!/^[a-z0-9._-]{3,30}$/.test(staffId) || passcode.length < 8 || passcode.length > 64) return genericFailure()

  try {
    const throttleKeys = loginThrottleKeys(request, staffId)
    const blocked = await Promise.all(throttleKeys.map(consumeLoginThrottle))
    if (blocked.some(Boolean)) {
      return NextResponse.json({ error: 'Unable to sign in right now. Try again in 15 minutes.' }, { status: 429 })
    }

    const [profile] = await db
      .select({ restaurantId: restaurantStaffProfiles.restaurantId, staffId: restaurantStaffProfiles.staffId, active: restaurantStaffProfiles.active })
      .from(restaurantStaffProfiles)
      .where(and(
        eq(restaurantStaffProfiles.restaurantId, RESTAURANT_MANAGER_USER_ID),
        eq(restaurantStaffProfiles.staffId, staffId),
      ))
      .limit(1)

    if (!profile?.active) return genericFailure()

    const origin = new URL(request.url).origin
    const authRequest = new Request(new URL('/api/auth/sign-in/username', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ username: staffAuthUsername(profile.restaurantId, profile.staffId), password: passcode }),
    })
    const response = await auth.handler(authRequest)

    if (!response.ok) return genericFailure()
    await clearLoginThrottle(throttleKeys)
    return response
  } catch (error) {
    console.error('[staff-auth] Sign-in failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Unable to sign in right now. Try again shortly.' }, { status: 503 })
  }
}
