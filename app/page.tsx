import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/auth'
import { getOnboardingStatus } from '@/lib/onboarding/onboarding-service'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  // Check if initial restaurant onboarding has been completed
  const onboardingStatus = await getOnboardingStatus()
  if (!onboardingStatus.isCompleted) {
    redirect('/onboarding')
  }

  const staffSession = await getStaffSession()

  if (!staffSession || !staffSession.user || !staffSession.user.isActive) {
    redirect('/login')
  }

  const role = staffSession.user.role
  if (role === 'manager' || role === 'admin') {
    redirect('/manager')
  }

  redirect('/hostess')
}
