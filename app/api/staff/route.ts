import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authUser, db, restaurantStaffProfiles } from '@/lib/db'
import { getStaffContext, isManager, staffAuthUsername } from '@/lib/staff-auth'
import { RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'
import { isSameOrigin } from '@/lib/same-origin'
import { createHash } from 'node:crypto'

function accountEmail(staffId: string) {
  const key = createHash('sha256').update(`${RESTAURANT_MANAGER_USER_ID}:${staffId}`).digest('hex').slice(0, 24)
  return `staff.${key}@accounts.saffron.invalid`
}

function validStaffId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9._-]{3,30}$/.test(value)
}

export async function GET(request: Request) {
  const context = await getStaffContext(request.headers)
  if (!isManager(context)) return NextResponse.json({ error: 'Manager access required.' }, { status: context ? 403 : 401 })

  const staff = await db
    .select({ id: restaurantStaffProfiles.id, staffId: restaurantStaffProfiles.staffId, name: restaurantStaffProfiles.name, role: restaurantStaffProfiles.role, active: restaurantStaffProfiles.active, createdAt: restaurantStaffProfiles.createdAt })
    .from(restaurantStaffProfiles)
    .where(eq(restaurantStaffProfiles.restaurantId, context.profile.restaurantId))
    .orderBy(asc(restaurantStaffProfiles.name))
  return NextResponse.json({ staff })
}

export async function POST(request: Request) {
  const context = await getStaffContext(request.headers)
  if (!isManager(context)) return NextResponse.json({ error: 'Manager access required.' }, { status: context ? 403 : 401 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Enter valid staff details.' }, { status: 400 })
    const payload = body as Record<string, unknown>
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    const staffId = typeof payload.staffId === 'string' ? payload.staffId.trim().toLowerCase() : ''
    const role = payload.role
    const passcode = typeof payload.passcode === 'string' ? payload.passcode : ''
    if (name.length < 2 || name.length > 100 || !validStaffId(staffId) || !['manager', 'hostess'].includes(String(role)) || passcode.length < 8 || passcode.length > 64) {
      return NextResponse.json({ error: 'Check the name, staff ID, role, and passcode requirements.' }, { status: 400 })
    }

    const [duplicate] = await db.select({ id: restaurantStaffProfiles.id }).from(restaurantStaffProfiles).where(and(
      eq(restaurantStaffProfiles.restaurantId, context.profile.restaurantId),
      eq(restaurantStaffProfiles.staffId, staffId),
    )).limit(1)
    if (duplicate) return NextResponse.json({ error: 'That staff ID is already in use.' }, { status: 409 })

    const result = await auth.api.signUpEmail({
      body: { email: accountEmail(staffId), password: passcode, name, username: staffAuthUsername(context.profile.restaurantId, staffId) },
      headers: request.headers,
    })
    const managerRole = role === 'manager'
    await db.transaction(async (transaction) => {
      await transaction.update(authUser).set({ role: managerRole ? 'admin' : 'user', banned: false }).where(eq(authUser.id, result.user.id))
      await transaction.insert(restaurantStaffProfiles).values({
        id: crypto.randomUUID(),
        restaurantId: context.profile.restaurantId,
        authUserId: result.user.id,
        staffId,
        name,
        role: String(role),
        active: true,
      })
    })

    return NextResponse.json({ ok: true, staff: { id: staffId, name, role, active: true } }, { status: 201 })
  } catch (error) {
    console.error('[staff-auth] Staff creation failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Unable to create this staff account.' }, { status: 400 })
  }
}
