import { and, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authAccount, authSession, authUser, db, restaurantStaffProfiles } from '@/lib/db'
import { getStaffContext, isManager } from '@/lib/staff-auth'
import { isSameOrigin } from '@/lib/same-origin'

export async function PATCH(request: Request, contextParams: { params: Promise<{ id: string }> }) {
  const context = await getStaffContext(request.headers)
  if (!isManager(context)) return NextResponse.json({ error: 'Manager access required.' }, { status: context ? 403 : 401 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })

  const { id } = await contextParams.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter a valid update.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Enter a valid update.' }, { status: 400 })
  const payload = body as Record<string, unknown>
  const [staff] = await db.select().from(restaurantStaffProfiles).where(and(
    eq(restaurantStaffProfiles.id, id),
    eq(restaurantStaffProfiles.restaurantId, context.profile.restaurantId),
  )).limit(1)
  if (!staff) return NextResponse.json({ error: 'Staff account not found.' }, { status: 404 })
  if (staff.authUserId === context.session.user.id && (payload.active === false || payload.role === 'hostess')) {
    return NextResponse.json({ error: 'You cannot deactivate or demote your own manager account.' }, { status: 400 })
  }

  const role = payload.role === undefined ? staff.role : payload.role
  const active = payload.active === undefined ? staff.active : payload.active
  const passcode = payload.passcode
  if (!['manager', 'hostess'].includes(String(role)) || typeof active !== 'boolean' || (passcode !== undefined && (typeof passcode !== 'string' || passcode.length < 8 || passcode.length > 64))) {
    return NextResponse.json({ error: 'Check the role, active status, and passcode.' }, { status: 400 })
  }

  const losingManager = staff.role === 'manager' && staff.active && (role !== 'manager' || active === false)
  if (losingManager) {
    const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(restaurantStaffProfiles).where(and(
      eq(restaurantStaffProfiles.restaurantId, context.profile.restaurantId),
      eq(restaurantStaffProfiles.role, 'manager'),
      eq(restaurantStaffProfiles.active, true),
    ))
    if (Number(count?.count ?? 0) <= 1) return NextResponse.json({ error: 'Keep at least one active manager account.' }, { status: 400 })
  }

  try {
    if (typeof passcode === 'string') {
      await auth.api.setUserPassword({ body: { userId: staff.authUserId, newPassword: passcode }, headers: request.headers })
    }

    await db.transaction(async (transaction) => {
      await transaction.update(restaurantStaffProfiles).set({ role: String(role), active, updatedAt: new Date() }).where(eq(restaurantStaffProfiles.id, staff.id))
      await transaction.update(authUser).set({ role: role === 'manager' ? 'admin' : 'user', banned: !active }).where(eq(authUser.id, staff.authUserId))
      if (!active || typeof passcode === 'string') {
        await transaction.delete(authSession).where(eq(authSession.userId, staff.authUserId))
      }
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[staff-auth] Staff update failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Unable to update this staff account.' }, { status: 400 })
  }
}

export async function DELETE(request: Request, contextParams: { params: Promise<{ id: string }> }) {
  const context = await getStaffContext(request.headers)
  if (!isManager(context)) return NextResponse.json({ error: 'Manager access required.' }, { status: context ? 403 : 401 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })

  const { id } = await contextParams.params
  const [staff] = await db.select().from(restaurantStaffProfiles).where(and(
    eq(restaurantStaffProfiles.id, id),
    eq(restaurantStaffProfiles.restaurantId, context.profile.restaurantId),
  )).limit(1)
  if (!staff) return NextResponse.json({ error: 'Staff account not found.' }, { status: 404 })
  if (staff.authUserId === context.session.user.id) return NextResponse.json({ error: 'You cannot delete your own manager account.' }, { status: 400 })

  if (staff.role === 'manager' && staff.active) {
    const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(restaurantStaffProfiles).where(and(
      eq(restaurantStaffProfiles.restaurantId, context.profile.restaurantId),
      eq(restaurantStaffProfiles.role, 'manager'),
      eq(restaurantStaffProfiles.active, true),
    ))
    if (Number(count?.count ?? 0) <= 1) return NextResponse.json({ error: 'Keep at least one active manager account.' }, { status: 400 })
  }

  try {
    await db.transaction(async (transaction) => {
      await transaction.delete(authSession).where(eq(authSession.userId, staff.authUserId))
      await transaction.delete(authAccount).where(eq(authAccount.userId, staff.authUserId))
      await transaction.delete(restaurantStaffProfiles).where(eq(restaurantStaffProfiles.id, staff.id))
      await transaction.delete(authUser).where(eq(authUser.id, staff.authUserId))
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[staff-auth] Staff deletion failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Unable to delete this staff account.' }, { status: 500 })
  }
}
