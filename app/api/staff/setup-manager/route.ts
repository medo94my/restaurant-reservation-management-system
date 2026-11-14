import { createHash, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, authUser, restaurantStaffProfiles } from '@/lib/db'
import { clearLoginThrottle, consumeLoginThrottle, loginThrottleKeys, staffAuthUsername } from '@/lib/staff-auth'
import { isSameOrigin } from '@/lib/same-origin'
import { RESTAURANT_ID } from '@/lib/restaurant-config'

function sameSecret(candidate: string, expected: string) {
  const left = Buffer.from(candidate)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function accountEmail(staffId: string) {
  const key = createHash('sha256').update(`${RESTAURANT_ID}:${staffId}`).digest('hex').slice(0, 24)
  return `staff.${key}@accounts.saffron.invalid`
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Unable to complete manager setup.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Unable to complete manager setup.' }, { status: 400 })
  const payload = body as Record<string, unknown>
  const setupCode = typeof payload.setupCode === 'string' ? payload.setupCode : ''
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const staffId = typeof payload.staffId === 'string' ? payload.staffId.trim().toLowerCase() : ''
  const passcode = typeof payload.passcode === 'string' ? payload.passcode : ''
  const expectedSetupCode = process.env.MANAGER_PIN ?? ''

  if (!expectedSetupCode || !/^\d{6}$/.test(expectedSetupCode)) {
    return NextResponse.json({ error: 'Initial manager setup is not configured.' }, { status: 503 })
  }

  const throttleKeys = loginThrottleKeys(request, 'manager-bootstrap')
  try {
    if ((await Promise.all(throttleKeys.map(consumeLoginThrottle))).some(Boolean)) {
      return NextResponse.json({ error: 'Setup is temporarily locked. Try again in 15 minutes.' }, { status: 429 })
    }

    const [existingManager] = await db
      .select({ id: restaurantStaffProfiles.id })
      .from(restaurantStaffProfiles)
      .where(and(
        eq(restaurantStaffProfiles.restaurantId, RESTAURANT_ID),
        eq(restaurantStaffProfiles.role, 'manager'),
      ))
      .limit(1)
    if (existingManager) return NextResponse.json({ error: 'Manager setup has already been completed.' }, { status: 409 })

    if (!sameSecret(setupCode, expectedSetupCode)
      || name.length < 2
      || name.length > 100
      || !/^[a-z0-9._-]{3,30}$/.test(staffId)
      || passcode.length < 8
      || passcode.length > 64) {
      return NextResponse.json({ error: 'Unable to complete manager setup. Check the details and try again.' }, { status: 400 })
    }

    const [duplicate] = await db
      .select({ id: restaurantStaffProfiles.id })
      .from(restaurantStaffProfiles)
      .where(and(
        eq(restaurantStaffProfiles.restaurantId, RESTAURANT_ID),
        eq(restaurantStaffProfiles.staffId, staffId),
      ))
      .limit(1)
    if (duplicate) return NextResponse.json({ error: 'Unable to complete manager setup. Check the details and try again.' }, { status: 400 })

    const result = await auth.api.signUpEmail({
      body: { email: accountEmail(staffId), password: passcode, name, username: staffAuthUsername(RESTAURANT_ID, staffId) },
      headers: request.headers,
    })

    await db.transaction(async (transaction) => {
      await transaction.update(authUser).set({ role: 'admin', banned: false }).where(eq(authUser.id, result.user.id))
      await transaction.insert(restaurantStaffProfiles).values({
        id: crypto.randomUUID(),
        restaurantId: RESTAURANT_ID,
        authUserId: result.user.id,
        staffId,
        name,
        role: 'manager',
        active: true,
      })
    })

    await clearLoginThrottle(throttleKeys)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('[staff-auth] Initial manager setup failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Unable to complete manager setup. Check the details and try again.' }, { status: 400 })
  }
}
