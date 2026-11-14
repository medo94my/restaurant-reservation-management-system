import { NextResponse } from 'next/server'
import { eq, count, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user, session, account, type AuthUser } from '@/lib/schema'
import {
  auth,
  normalizeStaffAccountRole,
  requireManager,
  validateStaffPasscode,
} from '@/lib/auth/auth'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager()
    const { id } = await params

    const [targetStaff] = await db
      .select({
        id: user.id,
        name: user.name,
        staffId: user.staffId,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1)

    if (!targetStaff) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 })
    }

    return NextResponse.json({ staff: targetStaff })
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to fetch staff.' }, { status })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentManager = await requireManager()
    const { id } = await params

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
    }

    const { name, role, isActive, passcode } = body as Record<string, unknown>

    // Validate inputs before mutating anything.
    const requestedRole =
      role === undefined || role === null || role === '' ? undefined : normalizeStaffAccountRole(role)
    if (requestedRole === null) {
      return NextResponse.json({ error: 'Role must be either manager or host.' }, { status: 400 })
    }

    const hasPasscodeReset = typeof passcode === 'string' && passcode.trim().length > 0
    if (hasPasscodeReset) {
      const passcodeError = validateStaffPasscode(passcode)
      if (passcodeError) {
        return NextResponse.json({ error: passcodeError }, { status: 400 })
      }
    }

    const [targetUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1)

    if (!targetUser) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 })
    }

    const currentRole = normalizeStaffAccountRole(targetUser.role) ?? targetUser.role
    const isRoleChange = requestedRole !== undefined && requestedRole !== currentRole

    // 1. Guard against staff changing their own role
    if (targetUser.id === currentManager.id && isRoleChange) {
      return NextResponse.json(
        { error: 'Managers cannot change their own role.' },
        { status: 400 }
      )
    }

    // 2. Guard against deactivating or demoting the last active manager
    const isDemotingOrDeactivating =
      (isActive === false && targetUser.isActive) ||
      (isRoleChange && requestedRole !== 'manager' && targetUser.role === 'manager')

    if (targetUser.role === 'manager' && isDemotingOrDeactivating) {
      const [mgrCount] = await db
        .select({ total: count() })
        .from(user)
        .where(and(eq(user.role, 'manager'), eq(user.isActive, true)))

      if (mgrCount.total <= 1) {
        return NextResponse.json(
          { error: 'Action denied: Cannot deactivate or demote the last active manager.' },
          { status: 400 }
        )
      }
    }

    const updates: Partial<AuthUser> = {
      updatedAt: new Date(),
    }

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim()
    }

    if (isRoleChange && requestedRole) {
      updates.role = requestedRole
    }

    if (typeof isActive === 'boolean') {
      updates.isActive = isActive
    }

    await db.update(user).set(updates).where(eq(user.id, targetUser.id))

    // If deactivating, revoke active sessions *after* persisting isActive=false so a concurrent
    // sign-in cannot slip a new session in between. With cookieCache disabled this takes effect
    // on the very next request.
    if (isActive === false) {
      await db.delete(session).where(eq(session.userId, targetUser.id))
    }

    // 3. Passcode reset if provided
    if (hasPasscodeReset && typeof passcode === 'string') {
      const authContext = await auth.$context
      const hashedPassword = await authContext.password.hash(passcode)

      await db
        .update(account)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(account.userId, targetUser.id))

      // Invalidate existing sessions so user logs in with new passcode
      await db.delete(session).where(eq(session.userId, targetUser.id))
    }

    const [updated] = await db
      .select({
        id: user.id,
        name: user.name,
        staffId: user.staffId,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, targetUser.id))
      .limit(1)

    return NextResponse.json({
      success: true,
      staff: updated,
      message: 'Staff account updated successfully.',
    })
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to update staff.' }, { status })
  }
}
