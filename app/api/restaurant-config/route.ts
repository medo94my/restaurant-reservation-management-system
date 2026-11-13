import { and, eq, notInArray, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, restaurantGuestProfiles, restaurantWorkspaceConfig } from '@/lib/db'
import { getStaffContext, isManager } from '@/lib/staff-auth'
import { DEFAULT_FLOOR_ITEMS, DEFAULT_OCCASION_TAGS, DEFAULT_VISIT_TIERS, RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'
import type { CouchShape, CustomerProfile, RestaurantConfig, TableShape, TableStatus, Unit } from '@/lib/restaurant-config'

export const runtime = 'nodejs'

const tableShapes: TableShape[] = ['round', 'square', 'rectangle', 'oval', 'long']
const couchShapes: CouchShape[] = ['loveseat', 'sofa']
const tableStatuses: TableStatus[] = ['available', 'seated', 'prep', 'blocked']
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isShortString = (value: unknown, max = 160): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max

function isRestaurantConfig(value: unknown): value is RestaurantConfig {
  if (!isRecord(value)) return false
  const { visitTiers, occasionTags, customers, floorItems } = value
  if (!Array.isArray(visitTiers) || visitTiers.length < 1 || visitTiers.length > 12) return false
  if (!Array.isArray(occasionTags) || occasionTags.length > 40) return false
  if (!Array.isArray(customers) || customers.length > 5000) return false
  if (!Array.isArray(floorItems) || floorItems.length > 250) return false

  const validTiers = visitTiers.every((tier) => isRecord(tier)
    && isShortString(tier.id, 64)
    && isShortString(tier.label, 40)
    && Number.isInteger(tier.minVisits)
    && Number(tier.minVisits) >= 0
    && typeof tier.color === 'string'
    && /^#[\da-fA-F]{6}$/.test(tier.color))
  const validTags = occasionTags.every((tag) => isRecord(tag)
    && isShortString(tag.id, 64)
    && isShortString(tag.label, 40)
    && typeof tag.color === 'string'
    && /^#[\da-fA-F]{6}$/.test(tag.color))
  const validCustomers = customers.every((customer) => isRecord(customer)
    && isShortString(customer.phone, 24)
    && isShortString(customer.name, 100)
    && Number.isInteger(customer.visits)
    && Number(customer.visits) >= 0
    && typeof customer.note === 'string'
    && customer.note.length <= 500
    && Array.isArray(customer.occasionTags)
    && customer.occasionTags.length <= 40
    && customer.occasionTags.every((tagId) => typeof tagId === 'string' && tagId.length <= 64))
  const validFloorItems = floorItems.every((item) => {
    if (!isRecord(item)
      || !isShortString(item.id, 80)
      || !Number.isInteger(item.capacity)
      || Number(item.capacity) < 1
      || Number(item.capacity) > 30
      || typeof item.status !== 'string'
      || !tableStatuses.includes(item.status as TableStatus)
      || !Number.isFinite(item.x)
      || Number(item.x) < 55
      || Number(item.x) > 945
      || !Number.isFinite(item.y)
      || Number(item.y) < 55
      || Number(item.y) > 545
      || !Number.isInteger(item.rotation)
      || (item.guest !== undefined && (typeof item.guest !== 'string' || item.guest.length > 100))
      || (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500))
      || (item.archived !== undefined && typeof item.archived !== 'boolean')) return false

    if (item.kind === 'Table') return typeof item.tableType === 'string' && tableShapes.includes(item.tableType as TableShape)
    if (item.kind === 'Couch') return typeof item.couchType === 'string' && couchShapes.includes(item.couchType as CouchShape)
    if (item.kind === 'Room') return typeof item.tableType === 'string'
      && tableShapes.includes(item.tableType as TableShape)
      && Number.isInteger(item.roomWidth)
      && Number(item.roomWidth) >= 150
      && Number(item.roomWidth) <= 320
      && Number.isInteger(item.roomHeight)
      && Number(item.roomHeight) >= 120
      && Number(item.roomHeight) <= 240
    return false
  })

  const itemIds = new Set(floorItems.filter(isRecord).map((item) => typeof item.id === 'string' ? item.id.trim().toLowerCase() : ''))
  return validTiers && validTags && validCustomers && validFloorItems && itemIds.size === floorItems.length && !itemIds.has('')
}

export async function GET(request: Request) {
  const staffContext = await getStaffContext(request.headers)
  if (!staffContext) return NextResponse.json({ error: 'Sign in to access restaurant settings.' }, { status: 401 })

  try {
  const [row] = await db
      .select({ config: restaurantWorkspaceConfig.config })
      .from(restaurantWorkspaceConfig)
      .where(eq(restaurantWorkspaceConfig.userId, RESTAURANT_MANAGER_USER_ID))
      .limit(1)

    const session = staffContext
    const storedConfig = row?.config as (RestaurantConfig & { tables?: Unit[] }) | undefined
    const legacyItems = storedConfig?.tables ?? []
    const hasLegacyItems = Array.isArray(storedConfig?.tables)
    const legacyStarterLayout = legacyItems.length === 16 && legacyItems.every((item, index) => {
      const status = index === 4 ? 'prep' : [0, 8].includes(index) ? 'seated' : 'available'
      return item.kind === 'Table'
        && item.id === `Table ${index + 1}`
        && item.tableType === tableShapes[index % tableShapes.length]
        && item.capacity === [2, 4, 4, 6, 8][index % 5]
        && item.x === 125 + (index % 4) * 250
        && item.y === 95 + Math.floor(index / 4) * 135
        && item.rotation === 0
        && item.status === status
        && !item.archived
    })
  let guestRows = session ? await db.select().from(restaurantGuestProfiles)
    .where(eq(restaurantGuestProfiles.restaurantId, session.profile.restaurantId))
    .orderBy(restaurantGuestProfiles.name) : []

  if (session && guestRows.length === 0 && storedConfig?.customers?.length) {
    await db.insert(restaurantGuestProfiles).values(storedConfig.customers.map((customer) => ({
      restaurantId: RESTAURANT_MANAGER_USER_ID,
      phone: customer.phone,
      name: customer.name,
      visits: customer.visits,
      note: customer.note,
      occasionTags: customer.occasionTags,
    }))).onConflictDoNothing()
    guestRows = await db.select().from(restaurantGuestProfiles)
      .where(eq(restaurantGuestProfiles.restaurantId, session.profile.restaurantId))
      .orderBy(restaurantGuestProfiles.name)
  }

  const config: RestaurantConfig = {
    ...(storedConfig ?? {}),
    floorItems: storedConfig?.floorItems ?? (hasLegacyItems ? (legacyStarterLayout ? DEFAULT_FLOOR_ITEMS : legacyItems) : DEFAULT_FLOOR_ITEMS),
    customers: session ? guestRows.map((customer): CustomerProfile => ({
      name: customer.name,
      phone: customer.phone,
      visits: customer.visits,
      note: customer.note,
      occasionTags: customer.occasionTags,
    })) : [],
    visitTiers: storedConfig?.visitTiers ?? DEFAULT_VISIT_TIERS,
    occasionTags: storedConfig?.occasionTags ?? DEFAULT_OCCASION_TAGS,
  }
  const visibleConfig = session ? config : {
    floorItems: config.floorItems,
    visitTiers: config.visitTiers,
    occasionTags: config.occasionTags,
  }

  return NextResponse.json({ config: visibleConfig }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load restaurant settings.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getStaffContext(request.headers)
  if (!session) return NextResponse.json({ error: 'Sign in to update restaurant settings.' }, { status: 401 })
  if (!isManager(session)) return NextResponse.json({ error: 'Manager access required.' }, { status: 403 })
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 })

  const config = await request.json().catch(() => null)
  if (!isRestaurantConfig(config) || JSON.stringify(config).length > 500_000) {
    return NextResponse.json({ error: 'Invalid restaurant settings.' }, { status: 400 })
  }

  try {
  const guests = config.customers.map((customer) => ({
    restaurantId: session.profile.restaurantId,
    phone: customer.phone,
    name: customer.name,
    visits: customer.visits,
    note: customer.note,
    occasionTags: customer.occasionTags,
    updatedAt: new Date(),
  }))

  await db.transaction(async (tx) => {
    await tx.insert(restaurantWorkspaceConfig)
      .values({ userId: RESTAURANT_MANAGER_USER_ID, config })
      .onConflictDoUpdate({
        target: restaurantWorkspaceConfig.userId,
        set: { config, updatedAt: new Date() },
      })

    if (guests.length) {
      await tx.insert(restaurantGuestProfiles).values(guests).onConflictDoUpdate({
        target: [restaurantGuestProfiles.restaurantId, restaurantGuestProfiles.phone],
        set: {
          name: sql`excluded.name`,
          visits: sql`excluded.visits`,
          note: sql`excluded.note`,
          occasionTags: sql`excluded.occasion_tags`,
          updatedAt: new Date(),
        },
      })
    }

    const guestPhones = guests.map((guest) => guest.phone)
    if (guestPhones.length) {
      await tx.delete(restaurantGuestProfiles).where(and(
        eq(restaurantGuestProfiles.restaurantId, session.profile.restaurantId),
        notInArray(restaurantGuestProfiles.phone, guestPhones),
      ))
    } else {
      await tx.delete(restaurantGuestProfiles).where(eq(restaurantGuestProfiles.restaurantId, session.profile.restaurantId))
    }
  })

  return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to save restaurant settings.' }, { status: 500 })
  }
}
