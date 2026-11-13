import { NextResponse } from 'next/server'
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

const authHandler = toNextJsHandler(auth)

function isBlockedPath(path: string) {
  return path.startsWith('/api/auth/admin')
    || path.startsWith('/api/auth/sign-up')
    || path.startsWith('/api/auth/sign-in')
}

export async function GET(request: Request) {
  if (isBlockedPath(new URL(request.url).pathname)) {
    return NextResponse.json({ error: 'Use the protected staff workflows.' }, { status: 404 })
  }
  return authHandler.GET(request)
}

export async function POST(request: Request) {
  if (isBlockedPath(new URL(request.url).pathname)) {
    return NextResponse.json({ error: 'Use the protected staff workflows.' }, { status: 404 })
  }
  return authHandler.POST(request)
}
