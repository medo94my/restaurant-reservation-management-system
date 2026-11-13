import { headers } from 'next/headers'
import RestaurantDashboard from '@/components/restaurant-dashboard'
import { StaffAccountBar, StaffEntry } from '@/components/staff-auth'
import { auth } from '@/lib/auth'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) return <StaffEntry />

  return (
    <>
      <StaffAccountBar email={session.user.email} />
      <RestaurantDashboard />
    </>
  )
}
