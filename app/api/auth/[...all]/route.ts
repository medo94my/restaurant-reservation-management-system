import { NextResponse } from 'next/server'
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

const handlers = toNextJsHandler(auth)

export const GET = handlers.GET

export async function POST(request: Request) {
  const path = new URL(request.url).pathname

  if (path === '/api/auth/sign-up/email') {
    return NextResponse.json({ message: 'Staff registration requires manager authorization.' }, { status: 403 })
  }

  return handlers.POST(request)
}
