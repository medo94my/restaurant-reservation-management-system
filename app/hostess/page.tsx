import RestaurantDashboard from '@/components/restaurant-dashboard'
import { DEFAULT_BRANDING, isRestaurantBranding } from '@/lib/branding'
import { db, restaurantBranding } from '@/lib/db'
import { RESTAURANT_ID } from '@/lib/restaurant-config'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function HostessPage() {
  const [stored] = await db.select({ published: restaurantBranding.published }).from(restaurantBranding)
    .where(eq(restaurantBranding.restaurantId, RESTAURANT_ID)).limit(1)
  return <RestaurantDashboard branding={isRestaurantBranding(stored?.published) ? stored.published : DEFAULT_BRANDING} />
}
