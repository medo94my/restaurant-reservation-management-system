import { NextRequest, NextResponse } from 'next/server'
import {
  initOnboardingSession,
  OnboardingServiceError,
} from '@/lib/onboarding/onboarding-service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const existingToken =
      req.cookies.get('onboarding_token')?.value ||
      req.headers.get('x-onboarding-token') ||
      undefined

    const session = await initOnboardingSession(existingToken)

    const res = NextResponse.json({
      success: true,
      workspaceId: session.workspaceId,
      currentStep: session.currentStep,
      ...(session.draftData ? { draftData: session.draftData } : {}),
    })

    // Set HTTP-only cookie for the onboarding token (2 hour TTL)
    res.cookies.set('onboarding_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 2 * 60 * 60,
    })

    return res
  } catch (error: unknown) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const message = error instanceof Error ? error.message : 'Failed to initialize onboarding'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
