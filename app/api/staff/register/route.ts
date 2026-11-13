import { getManagerSession } from '@/lib/manager-session'
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const requestUrl = new URL(request.url)

  if (!origin || origin !== requestUrl.origin) {
    return NextResponse.json({ message: 'Unable to create staff account.' }, { status: 403 })
  }

  if (!(await getManagerSession())) {
    return NextResponse.json({ message: 'Manager authorization is required to create staff accounts.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
    return NextResponse.json({ message: 'Enter a name, valid email, and password with at least 12 characters.' }, { status: 400 })
  }

  const authRequest = new Request(new URL('/api/auth/sign-up/email', requestUrl.origin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ name, email, password }),
  })

  return auth.handler(authRequest)
}
