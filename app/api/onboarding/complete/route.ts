import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  completeOnboarding,
  establishOnboardingManagerSession,
  OnboardingServiceError,
} from '@/lib/onboarding/onboarding-service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken =
      cookieStore.get('onboarding_token')?.value ||
      req.headers.get('x-onboarding-token') ||
      ''

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No active onboarding session found. Please refresh or restart onboarding.' },
        { status: 401 }
      )
    }

    let passcodeConfirmation: string | undefined
    try {
      const body = await req.json()
      if (
        typeof body?.passcodeConfirmation === 'string' &&
        body.passcodeConfirmation.trim().length > 0
      ) {
        passcodeConfirmation = body.passcodeConfirmation
      }
    } catch {
      // Body is optional
    }

    const result = await completeOnboarding(sessionToken, passcodeConfirmation)
    const { sessionEstablished, setCookieHeaders } =
      await establishOnboardingManagerSession(result)

    const jsonBody = {
      success: true,
      workspaceId: result.workspaceId,
      staffId: result.staffId,
      sessionEstablished,
      redirectUrl: sessionEstablished ? '/manager' : '/login',
    }

    const response = NextResponse.json(jsonBody)

    // Clear onboarding session cookie
    response.cookies.set('onboarding_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })

    for (const cookieStr of setCookieHeaders) {
      response.headers.append('Set-Cookie', cookieStr)
    }

    return response
  } catch (error: unknown) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const message = error instanceof Error ? error.message : 'Failed to finalize onboarding'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
