import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { verifyPassword } from 'better-auth/crypto'
import { db } from '@/lib/db'
import { clearLoginThrottle, consumeLoginThrottle, getStaffContext, loginThrottleKeys } from '@/lib/staff-auth'
import { isSameOrigin } from '@/lib/same-origin'

export const runtime = 'nodejs'

/**
 * Confirms the signed-in staff member's own passcode for destructive actions
 * (e.g. deleting a guest profile). The passcode is checked against the
 * better-auth credential account, and attempts share the sign-in throttle
 * buckets so abuse of either path locks both.
 */
export async function POST(request: Request) {
  const context = await getStaffContext(request.headers)
  if (!context) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const passcode = typeof body?.passcode === 'string' ? body.passcode : ''
  if (passcode.length === 0) return NextResponse.json({ error: 'Enter your passcode.' }, { status: 400 })

  const keys = loginThrottleKeys(request, context.profile.staffId)
  if ((await Promise.all(keys.map(consumeLoginThrottle))).some(Boolean)) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
  }

  const result = await db.execute(sql`select "password" from "account" where "userId" = ${context.session.user.id} and "providerId" = 'credential' limit 1`)
  const hash = (result.rows as Array<{ password?: string } | null>)[0]?.password
  if (!hash) return NextResponse.json({ error: 'Unable to verify the passcode.' }, { status: 500 })

  if (!(await verifyPassword({ hash, password: passcode }))) {
    return NextResponse.json({ error: 'Passcode is incorrect.' }, { status: 401 })
  }
  await clearLoginThrottle(keys)
  return NextResponse.json({ ok: true })
}
