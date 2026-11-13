import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, restaurantStaffProfiles } from '@/lib/db'
import { RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    const [profile] = await db.select({ role: restaurantStaffProfiles.role, active: restaurantStaffProfiles.active })
      .from(restaurantStaffProfiles)
      .where(and(
        eq(restaurantStaffProfiles.authUserId, session.user.id),
        eq(restaurantStaffProfiles.restaurantId, RESTAURANT_MANAGER_USER_ID),
      ))
      .limit(1)
    if (profile?.active) redirect(profile.role === 'manager' ? '/manager' : '/hostess')
  }

  const [manager] = await db.select({ id: restaurantStaffProfiles.id }).from(restaurantStaffProfiles).where(and(
    eq(restaurantStaffProfiles.restaurantId, RESTAURANT_MANAGER_USER_ID),
    eq(restaurantStaffProfiles.role, 'manager'),
  )).limit(1)
  redirect(manager ? '/login' : '/setup-manager')
}
