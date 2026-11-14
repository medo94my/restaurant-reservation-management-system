import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  saveOnboardingStep,
  OnboardingServiceError,
} from '@/lib/onboarding/onboarding-service'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
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

    const body = await req.json()
    const { step, data } = body

    if (typeof step !== 'number' || step < 1 || step > 4) {
      return NextResponse.json({ error: 'Invalid step number. Must be between 1 and 4.' }, { status: 400 })
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Missing step payload.' }, { status: 400 })
    }

    const result = await saveOnboardingStep(sessionToken, step, data)
    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof OnboardingServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const message = error instanceof Error ? error.message : 'Failed to save onboarding step'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
