import { NextResponse } from 'next/server'
import {
  createManagerSessionToken,
  managerCookieOptions,
  managerSessionIsConfigured,
  MANAGER_SESSION_COOKIE,
  verifyManagerPin,
} from '@/lib/manager-session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!managerSessionIsConfigured()) {
    return NextResponse.json({ error: 'Manager access is not configured.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { pin?: unknown } | null
  if (!verifyManagerPin(body?.pin)) {
    return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(MANAGER_SESSION_COOKIE, createManagerSessionToken(), managerCookieOptions())
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(MANAGER_SESSION_COOKIE, '', managerCookieOptions(0))
  return response
}
