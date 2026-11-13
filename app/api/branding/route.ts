import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { DEFAULT_BRANDING, isRestaurantBranding } from '@/lib/branding'
import { db, restaurantBranding } from '@/lib/db'
import { getStaffContext, isManager } from '@/lib/staff-auth'
import { isSameOrigin } from '@/lib/same-origin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const context = await getStaffContext(request.headers)
  if (!context) return NextResponse.json({ error: 'Sign in to access branding.' }, { status: 401 })

  const [stored] = await db.select({ draft: restaurantBranding.draft, published: restaurantBranding.published })
    .from(restaurantBranding)
    .where(eq(restaurantBranding.restaurantId, context.profile.restaurantId))
    .limit(1)
  const selected = isManager(context) ? stored?.draft : stored?.published
  return NextResponse.json({ branding: isRestaurantBranding(selected) ? selected : DEFAULT_BRANDING }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function PUT(request: Request) {
  const context = await getStaffContext(request.headers)
  if (!isManager(context)) return NextResponse.json({ error: 'Manager access required.' }, { status: context ? 403 : 401 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })

  const payload: unknown = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Invalid branding settings.' }, { status: 400 })
  const body = payload as Record<string, unknown>
  const action = body.action
  const branding = body.branding
  if (!['save', 'publish'].includes(String(action)) || !isRestaurantBranding(branding)) {
    return NextResponse.json({ error: 'Invalid branding settings.' }, { status: 400 })
  }

  const now = new Date()
  try {
    if (action === 'publish') {
      await db.insert(restaurantBranding).values({
        restaurantId: context.profile.restaurantId,
        draft: branding,
        published: branding,
        updatedAt: now,
        publishedAt: now,
      }).onConflictDoUpdate({
        target: restaurantBranding.restaurantId,
        set: { draft: branding, published: branding, updatedAt: now, publishedAt: now },
      })
    } else {
      await db.insert(restaurantBranding).values({
        restaurantId: context.profile.restaurantId,
        draft: branding,
        published: DEFAULT_BRANDING,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: restaurantBranding.restaurantId,
        set: { draft: branding, updatedAt: now },
      })
    }
    return NextResponse.json({ ok: true, published: action === 'publish' })
  } catch (error) {
    console.error('[branding] Save failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Unable to save branding right now.' }, { status: 500 })
  }
}
