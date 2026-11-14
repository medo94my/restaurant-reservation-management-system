import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/auth/auth'
import { ConfigValidationError, workspaceConfigStore } from '@/lib/workspace-config-store'
import { RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const staffSession = await getStaffSession(request?.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const isManager =
      staffSession.user.role === 'manager' || staffSession.user.role === 'admin'
    const role = isManager ? 'manager' : 'host'
    const config = await workspaceConfigStore.loadConfig(role)
    return NextResponse.json({ config }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('GET /api/restaurant-config error:', err)
    return NextResponse.json({ error: 'Unable to load restaurant settings.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const staffSession = await getStaffSession(request?.headers).catch(() => null)
    const isAuthorized = Boolean(
      staffSession?.user &&
      staffSession.user.isActive !== false &&
      (staffSession.user.role === 'manager' || staffSession.user.role === 'admin')
    )
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Manager access required.' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    await workspaceConfigStore.saveConfig(body, RESTAURANT_MANAGER_USER_ID)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/restaurant-config error:', error)
    if (error instanceof ConfigValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unable to save restaurant settings.' }, { status: 500 })
  }
}
