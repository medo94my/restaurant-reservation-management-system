import { eq } from 'drizzle-orm'
import { db, restaurantWorkspaceConfig } from './db.ts'
import {
  COUCH_SHAPES,
  DEFAULT_FLOOR_ITEMS,
  RESTAURANT_MANAGER_USER_ID,
  TABLE_SHAPES,
  TABLE_STATUSES,
  type CouchShape,
  type RestaurantConfig,
  type TableShape,
  type TableStatus,
  type Unit,
} from './restaurant-config.ts'

export interface ConfigStorageAdapter {
  get(userId: string): Promise<RestaurantConfig | null>
  put(userId: string, config: RestaurantConfig): Promise<void>
}

export class DrizzleConfigStorageAdapter implements ConfigStorageAdapter {
  private fallback: InMemoryConfigStorageAdapter
  private database: typeof db

  constructor(
    fallback: InMemoryConfigStorageAdapter = new InMemoryConfigStorageAdapter(),
    database: typeof db = db
  ) {
    this.fallback = fallback
    this.database = database
  }

  async get(userId: string): Promise<RestaurantConfig | null> {
    try {
      const [row] = await this.database
        .select({ config: restaurantWorkspaceConfig.config })
        .from(restaurantWorkspaceConfig)
        .where(eq(restaurantWorkspaceConfig.userId, userId))
        .limit(1)

      if (!row) {
        return this.fallback.get(userId)
      }
      return (row?.config as (RestaurantConfig & { tables?: Unit[] })) ?? null
    } catch (err) {
      console.warn('DrizzleConfigStorageAdapter: Database query failed, falling back to in-memory', err)
      return this.fallback.get(userId)
    }
  }

  async put(userId: string, config: RestaurantConfig): Promise<void> {
    await this.database
      .insert(restaurantWorkspaceConfig)
      .values({ userId, config })
      .onConflictDoUpdate({
        target: restaurantWorkspaceConfig.userId,
        set: { config, updatedAt: new Date() },
      })
    await this.fallback.put(userId, config)
  }
}

export class InMemoryConfigStorageAdapter implements ConfigStorageAdapter {
  private storage = new Map<string, RestaurantConfig>()

  constructor(initial?: Record<string, RestaurantConfig>) {
    if (initial) {
      for (const [key, val] of Object.entries(initial)) {
        this.storage.set(key, JSON.parse(JSON.stringify(val)))
      }
    }
  }

  async get(userId: string): Promise<RestaurantConfig | null> {
    const val = this.storage.get(userId)
    return val ? JSON.parse(JSON.stringify(val)) : null
  }

  async put(userId: string, config: RestaurantConfig): Promise<void> {
    this.storage.set(userId, JSON.parse(JSON.stringify(config)))
  }

  clear(): void {
    this.storage.clear()
  }
}

export class ConfigValidationError extends Error {
  constructor(message = 'Invalid restaurant settings.') {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isShortString = (value: unknown, max = 160): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max

export function isRestaurantConfig(value: unknown): value is RestaurantConfig {
  if (!isRecord(value)) return false
  const { visitTiers, occasionTags, customers, floorItems } = value
  if (!Array.isArray(visitTiers) || visitTiers.length < 1 || visitTiers.length > 12) return false
  if (!Array.isArray(occasionTags) || occasionTags.length > 40) return false
  if (!Array.isArray(customers) || customers.length > 5000) return false
  if (!Array.isArray(floorItems) || floorItems.length > 250) return false

  const validTiers = visitTiers.every((tier) =>
    isRecord(tier)
    && isShortString(tier.id, 64)
    && isShortString(tier.label, 40)
    && Number.isInteger(tier.minVisits)
    && Number(tier.minVisits) >= 0
    && typeof tier.color === 'string'
    && /^#[\da-fA-F]{6}$/.test(tier.color)
  )

  const validTags = occasionTags.every((tag) =>
    isRecord(tag)
    && isShortString(tag.id, 64)
    && isShortString(tag.label, 40)
    && typeof tag.color === 'string'
    && /^#[\da-fA-F]{6}$/.test(tag.color)
  )

  const validCustomers = customers.every((customer) =>
    isRecord(customer)
    && isShortString(customer.phone, 24)
    && isShortString(customer.name, 100)
    && Number.isInteger(customer.visits)
    && Number(customer.visits) >= 0
    && typeof customer.note === 'string'
    && customer.note.length <= 500
    && Array.isArray(customer.occasionTags)
    && customer.occasionTags.length <= 40
    && customer.occasionTags.every((tagId) => typeof tagId === 'string' && tagId.length <= 64)
  )

  const validFloorItems = floorItems.every((item) => {
    if (
      !isRecord(item)
      || !isShortString(item.id, 80)
      || !Number.isInteger(item.capacity)
      || Number(item.capacity) < 1
      || Number(item.capacity) > 30
      || typeof item.status !== 'string'
      || !TABLE_STATUSES.includes(item.status as TableStatus)
      || !Number.isFinite(item.x)
      || Number(item.x) < 55
      || Number(item.x) > 945
      || !Number.isFinite(item.y)
      || Number(item.y) < 55
      || Number(item.y) > 545
      || !Number.isInteger(item.rotation)
      || (item.guest !== undefined && (typeof item.guest !== 'string' || item.guest.length > 100))
      || (item.pax !== undefined && (!Number.isInteger(item.pax) || Number(item.pax) < 1 || Number(item.pax) > 30))
      || (item.time !== undefined && (typeof item.time !== 'string' || item.time.length > 40))
      || (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500))
      || (item.bill !== undefined && (!Number.isFinite(item.bill) || Number(item.bill) < 0 || Number(item.bill) > 1_000_000))
      || (item.archived !== undefined && typeof item.archived !== 'boolean')
    ) {
      return false
    }

    if (item.kind === 'Table') {
      return typeof item.tableType === 'string' && TABLE_SHAPES.includes(item.tableType as TableShape)
    }
    if (item.kind === 'Couch') {
      return typeof item.couchType === 'string' && COUCH_SHAPES.includes(item.couchType as CouchShape)
    }
    if (item.kind === 'Room') {
      return (
        typeof item.tableType === 'string'
        && TABLE_SHAPES.includes(item.tableType as TableShape)
        && Number.isInteger(item.roomWidth)
        && Number(item.roomWidth) >= 150
        && Number(item.roomWidth) <= 320
        && Number.isInteger(item.roomHeight)
        && Number(item.roomHeight) >= 120
        && Number(item.roomHeight) <= 240
      )
    }
    return false
  })

  const itemIds = new Set(floorItems.filter(isRecord).map((item) => (typeof item.id === 'string' ? item.id.trim().toLowerCase() : '')))
  return (
    validTiers
    && validTags
    && validCustomers
    && validFloorItems
    && itemIds.size === floorItems.length
    && !itemIds.has('')
  )
}

export function migrateStarterLayout(
  storedConfig: (RestaurantConfig & { tables?: Unit[] }) | null
): RestaurantConfig | null {
  if (!storedConfig) return null

  const legacyItems = storedConfig.tables ?? []
  const hasLegacyItems = Array.isArray(storedConfig.tables)
  const legacyStarterLayout =
    legacyItems.length === 16
    && legacyItems.every((item, index) => {
      const status = index === 4 ? 'prep' : [0, 8].includes(index) ? 'seated' : 'available'
      return (
        item.kind === 'Table'
        && item.id === `Table ${index + 1}`
        && item.tableType === TABLE_SHAPES[index % TABLE_SHAPES.length]
        && item.capacity === [2, 4, 4, 6, 8][index % 5]
        && item.x === 125 + (index % 4) * 250
        && item.y === 95 + Math.floor(index / 4) * 135
        && item.rotation === 0
        && item.status === status
        && !item.archived
      )
    })

  const floorItems =
    storedConfig.floorItems
    ?? (hasLegacyItems
      ? legacyStarterLayout
        ? DEFAULT_FLOOR_ITEMS
        : legacyItems
      : DEFAULT_FLOOR_ITEMS)

  return {
    ...storedConfig,
    floorItems,
  }
}

export class WorkspaceConfigStore {
  private adapter: ConfigStorageAdapter

  constructor(adapter: ConfigStorageAdapter = new DrizzleConfigStorageAdapter()) {
    this.adapter = adapter
  }

  validateConfig(payload: unknown): { valid: true; data: RestaurantConfig } | { valid: false; error: string } {
    if (!isRecord(payload)) {
      return { valid: false, error: 'Invalid restaurant settings.' }
    }
    try {
      const serialized = JSON.stringify(payload)
      if (!serialized || Buffer.byteLength(serialized, 'utf8') > 500_000) {
        return { valid: false, error: 'Invalid restaurant settings.' }
      }
    } catch {
      return { valid: false, error: 'Invalid restaurant settings.' }
    }
    if (!isRestaurantConfig(payload)) {
      return { valid: false, error: 'Invalid restaurant settings.' }
    }
    return { valid: true, data: payload }
  }

  async loadConfig(
    role: 'manager' | 'host',
    userId: string = RESTAURANT_MANAGER_USER_ID
  ): Promise<RestaurantConfig | Omit<RestaurantConfig, 'customers'> | null> {
    const raw = await this.adapter.get(userId)
    const config = migrateStarterLayout(raw as (RestaurantConfig & { tables?: Unit[] }) | null)
    if (!config) return null

    if (role === 'manager') {
      return config
    }

    return {
      floorItems: config.floorItems,
      visitTiers: config.visitTiers,
      occasionTags: config.occasionTags,
    }
  }

  async saveConfig(payload: unknown, userId: string): Promise<{ ok: true }> {
    const result = this.validateConfig(payload)
    if (!result.valid) {
      throw new ConfigValidationError(result.error)
    }
    await this.adapter.put(userId, result.data)
    return { ok: true }
  }
}

const globalForConfig = globalThis as unknown as { workspaceConfigStore?: WorkspaceConfigStore }

export const workspaceConfigStore =
  globalForConfig.workspaceConfigStore ??
  new WorkspaceConfigStore(
    process.env.DATABASE_URL
      ? new DrizzleConfigStorageAdapter()
      : new InMemoryConfigStorageAdapter()
  )

if (process.env.NODE_ENV !== 'production') {
  globalForConfig.workspaceConfigStore = workspaceConfigStore
}
