import { NextResponse } from 'next/server'
import { eq, count, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user, type AuthUser } from '@/lib/schema'
import {
  auth,
  normalizeStaffAccountRole,
  requireManager,
  validateStaffPasscode,
} from '@/lib/auth/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireManager()

    const staffList = await db
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
      .orderBy(user.staffId)

    return NextResponse.json({ staff: staffList }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to fetch staff.' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    await requireManager()

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
    }

    const { staffId, name, passcode, role } = body as Record<string, unknown>

    if (!staffId || typeof staffId !== 'string' || !staffId.trim()) {
      return NextResponse.json({ error: 'Staff ID is required.' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Staff name is required.' }, { status: 400 })
    }

    const passcodeError = validateStaffPasscode(passcode)
    if (passcodeError || typeof passcode !== 'string') {
      return NextResponse.json({ error: passcodeError }, { status: 400 })
    }

    const assignedRole = normalizeStaffAccountRole(role)
    if (!assignedRole) {
      return NextResponse.json({ error: 'Role must be either manager or host.' }, { status: 400 })
    }
    const cleanStaffId = staffId.trim().toUpperCase()

    // Check if staffId already exists
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.staffId, cleanStaffId))
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: `Staff ID '${cleanStaffId}' is already in use.` },
        { status: 409 }
      )
    }

    // Create user via Better Auth
    const newUser = await auth.api.signUpEmail({
      body: {
        email: `${cleanStaffId.toLowerCase()}@staff.internal`,
        username: cleanStaffId,
        password: passcode,
        name: name.trim(),
        role: assignedRole,
        staffId: cleanStaffId,
        isActive: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        staff: {
          id: newUser.user.id,
          name: newUser.user.name,
          staffId: cleanStaffId,
          role: assignedRole,
          isActive: true,
          createdAt: newUser.user.createdAt,
        },
        message: 'Staff account created successfully.',
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to create staff.' }, { status })
  }
}
