import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { SetupManagerForm } from '@/components/auth/setup-manager-form'
import { getStaffContext, isManager } from '@/lib/staff-auth'
import { db, restaurantStaffProfiles } from '@/lib/db'
import { RESTAURANT_ID } from '@/lib/restaurant-config'

export default async function SetupManagerPage() {
  const context = await getStaffContext()
  if (context) redirect(isManager(context) ? '/manager' : '/hostess')

  const [manager] = await db.select({ id: restaurantStaffProfiles.id }).from(restaurantStaffProfiles).where(and(
    eq(restaurantStaffProfiles.restaurantId, RESTAURANT_ID),
    eq(restaurantStaffProfiles.role, 'manager'),
  )).limit(1)
  if (manager || !process.env.MANAGER_PIN) redirect('/login')
  return <SetupManagerForm />
}
