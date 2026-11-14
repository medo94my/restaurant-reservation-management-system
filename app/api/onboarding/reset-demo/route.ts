import { NextRequest, NextResponse } from 'next/server'
import {
  resetOnboardingDemo,
  OnboardingServiceError,
} from '@/lib/onboarding/onboarding-service'

export const dynamic = 'force-dynamic'

/**
 * Non-production endpoint to reset onboarding state for testing and demonstration.
 * Requires an authenticated manager/admin session.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    await resetOnboardingDemo(req.headers)

    const response = NextResponse.json({
      success: true,
      message: 'Onboarding reset successfully',
    })
    response.cookies.set('onboarding_token', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    })
    response.cookies.set('better-auth.session_token', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (error: unknown) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const authErr = error as { statusCode?: number; status?: string; message?: string }
    if (authErr?.statusCode === 401 || authErr?.status === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: authErr.message || 'Authentication required.' },
        { status: 401 }
      )
    }
    if (authErr?.statusCode === 403 || authErr?.status === 'FORBIDDEN') {
      return NextResponse.json(
        { error: authErr.message || 'Manager privileges required.' },
        { status: 403 }
      )
    }
    const message = error instanceof Error ? error.message : 'Reset failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
