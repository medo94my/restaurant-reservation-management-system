import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getOnboardingStatus } from '@/lib/onboarding/onboarding-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('onboarding_token')?.value

    const status = await getOnboardingStatus(sessionToken)
    return NextResponse.json(status)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve onboarding status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
