import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, restaurantWorkspaceConfig } from '@/lib/db'
import { getManagerSession } from '@/lib/manager-session'
import { RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'
import type { RestaurantConfig, TableShape, TableStatus } from '@/lib/restaurant-config'

export const runtime = 'nodejs'

const tableShapes: TableShape[] = ['round', 'square', 'rectangle', 'oval', 'long']
const tableStatuses: TableStatus[] = ['available', 'seated', 'prep', 'blocked']
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isShortString = (value: unknown, max = 160): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max

function isRestaurantConfig(value: unknown): value is RestaurantConfig {
  if (!isRecord(value)) return false
  const { visitTiers, occasionTags, customers, tables } = value
  if (!Array.isArray(visitTiers) || visitTiers.length < 1 || visitTiers.length > 12) return false
  if (!Array.isArray(occasionTags) || occasionTags.length > 40) return false
  if (!Array.isArray(customers) || customers.length > 5000) return false
  if (!Array.isArray(tables) || tables.length > 250) return false

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
  const validTables = tables.every((table) => isRecord(table)
    && isShortString(table.id, 80)
    && table.kind === 'Table'
    && typeof table.tableType === 'string'
    && tableShapes.includes(table.tableType as TableShape)
    && Number.isInteger(table.capacity)
    && Number(table.capacity) >= 1
    && Number(table.capacity) <= 30
    && typeof table.status === 'string'
    && tableStatuses.includes(table.status as TableStatus)
    && Number.isFinite(table.x)
    && Number(table.x) >= 55
    && Number(table.x) <= 945
    && Number.isFinite(table.y)
    && Number(table.y) >= 55
    && Number(table.y) <= 545
    && Number.isFinite(table.rotation)
    && Number.isInteger(table.rotation)
    && (table.guest === undefined || typeof table.guest === 'string' && table.guest.length <= 100)
    && (table.note === undefined || typeof table.note === 'string' && table.note.length <= 500)
    && (table.archived === undefined || typeof table.archived === 'boolean'))

  const tableIds = new Set(tables.filter(isRecord).map((table) => typeof table.id === 'string' ? table.id.trim().toLowerCase() : ''))
  return validTiers && validTags && validCustomers && validTables && tableIds.size === tables.length && !tableIds.has('')
}

export async function GET() {
  try {
    const [row] = await db
      .select({ config: restaurantWorkspaceConfig.config })
      .from(restaurantWorkspaceConfig)
      .where(eq(restaurantWorkspaceConfig.userId, RESTAURANT_MANAGER_USER_ID))
      .limit(1)

    const session = await getManagerSession()
    const config = row?.config
    const visibleConfig = !config ? null : session ? config : {
      tables: config.tables,
      visitTiers: config.visitTiers,
      occasionTags: config.occasionTags,
    }

    return NextResponse.json({ config: visibleConfig }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load restaurant settings.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getManagerSession()
  if (!session) return NextResponse.json({ error: 'Manager access required.' }, { status: 401 })

  const config = await request.json().catch(() => null)
  if (!isRestaurantConfig(config) || JSON.stringify(config).length > 500_000) {
    return NextResponse.json({ error: 'Invalid restaurant settings.' }, { status: 400 })
  }

  try {
    await db
      .insert(restaurantWorkspaceConfig)
      .values({ userId: session.userId, config })
      .onConflictDoUpdate({
        target: restaurantWorkspaceConfig.userId,
        set: { config, updatedAt: new Date() },
      })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to save restaurant settings.' }, { status: 500 })
  }
}
