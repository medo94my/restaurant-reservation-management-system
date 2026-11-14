import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COUCH_SHAPES,
  DEFAULT_CUSTOMERS,
  DEFAULT_FLOOR_ITEMS,
  DEFAULT_OCCASION_TAGS,
  DEFAULT_RESTAURANT_CONFIG,
  DEFAULT_VISIT_TIERS,
  TABLE_SHAPES,
  type RestaurantConfig,
  type TableStatus,
} from './restaurant-config.ts'
import {
  ConfigValidationError,
  DrizzleConfigStorageAdapter,
  InMemoryConfigStorageAdapter,
  WorkspaceConfigStore,
  isRestaurantConfig,
  migrateStarterLayout,
} from './workspace-config-store.ts'

test('WorkspaceConfigStore - schema validation accepts valid configs', () => {
  const store = new WorkspaceConfigStore(new InMemoryConfigStorageAdapter())
  const valid = store.validateConfig(DEFAULT_RESTAURANT_CONFIG)
  assert.equal(valid.valid, true)
  assert.equal(isRestaurantConfig(DEFAULT_RESTAURANT_CONFIG), true)
})

test('WorkspaceConfigStore - schema validation rejects invalid configs', () => {
  const store = new WorkspaceConfigStore(new InMemoryConfigStorageAdapter())

  // Not an object
  assert.equal(store.validateConfig(null).valid, false)
  assert.equal(store.validateConfig('invalid').valid, false)

  // Empty visit tiers
  const emptyTiers = { ...DEFAULT_RESTAURANT_CONFIG, visitTiers: [] }
  assert.equal(store.validateConfig(emptyTiers).valid, false)

  // Invalid hex color
  const badColor = {
    ...DEFAULT_RESTAURANT_CONFIG,
    visitTiers: [{ id: 't1', label: 'Tier 1', minVisits: 0, color: 'not-a-color' }],
  }
  assert.equal(store.validateConfig(badColor).valid, false)

  // Invalid floor item coordinates
  const outOfBoundsItem = {
    ...DEFAULT_RESTAURANT_CONFIG,
    floorItems: [
      {
        id: 'Table 1',
        kind: 'Table' as const,
        tableType: 'round' as const,
        capacity: 4,
        status: 'available' as const,
        x: 10, // out of range (< 55)
        y: 100,
        rotation: 0,
      },
    ],
  }
  assert.equal(store.validateConfig(outOfBoundsItem).valid, false)

  // Duplicate floor item IDs (case-insensitive)
  const duplicateIds = {
    ...DEFAULT_RESTAURANT_CONFIG,
    floorItems: [
      {
        id: 'Table 1',
        kind: 'Table' as const,
        tableType: 'round' as const,
        capacity: 4,
        status: 'available' as const,
        x: 100,
        y: 100,
        rotation: 0,
      },
      {
        id: 'table 1',
        kind: 'Table' as const,
        tableType: 'square' as const,
        capacity: 2,
        status: 'available' as const,
        x: 200,
        y: 200,
        rotation: 0,
      },
    ],
  }
  assert.equal(store.validateConfig(duplicateIds).valid, false)
})

test('WorkspaceConfigStore - role masking strips customers for host and retains for manager', async () => {
  const adapter = new InMemoryConfigStorageAdapter({
    testUser: DEFAULT_RESTAURANT_CONFIG,
  })
  const store = new WorkspaceConfigStore(adapter)

  const managerConfig = await store.loadConfig('manager', 'testUser')
  assert.ok(managerConfig)
  assert.ok('customers' in managerConfig)
  assert.equal(managerConfig.customers.length, DEFAULT_CUSTOMERS.length)

  const hostConfig = await store.loadConfig('host', 'testUser')
  assert.ok(hostConfig)
  assert.equal('customers' in hostConfig, false)
  assert.deepEqual(hostConfig.visitTiers, DEFAULT_VISIT_TIERS)
  assert.deepEqual(hostConfig.occasionTags, DEFAULT_OCCASION_TAGS)
  assert.equal(hostConfig.floorItems.length, DEFAULT_FLOOR_ITEMS.length)
})

test('WorkspaceConfigStore - saveConfig persists valid config and rejects invalid payload', async () => {
  const adapter = new InMemoryConfigStorageAdapter()
  const store = new WorkspaceConfigStore(adapter)

  // Saving invalid config throws ConfigValidationError
  await assert.rejects(
    async () => {
      await store.saveConfig({ bad: 'data' }, 'manager-1')
    },
    (err: unknown) => err instanceof ConfigValidationError
  )

  // Saving valid config succeeds
  const result = await store.saveConfig(DEFAULT_RESTAURANT_CONFIG, 'manager-1')
  assert.deepEqual(result, { ok: true })

  // Loading returns the saved config
  const loaded = await store.loadConfig('manager', 'manager-1')
  assert.ok(loaded)
  assert.equal(loaded?.floorItems.length, DEFAULT_FLOOR_ITEMS.length)
})

test('WorkspaceConfigStore - migrates legacy starter layout when floorItems is absent', () => {
  const legacyTables = Array.from({ length: 16 }, (_, index) => {
    const status: TableStatus = index === 4 ? 'prep' : [0, 8].includes(index) ? 'seated' : 'available'
    return {
      id: `Table ${index + 1}`,
      kind: 'Table' as const,
      tableType: TABLE_SHAPES[index % TABLE_SHAPES.length],
      capacity: [2, 4, 4, 6, 8][index % 5],
      x: 125 + (index % 4) * 250,
      y: 95 + Math.floor(index / 4) * 135,
      rotation: 0,
      status,
      archived: false,
    }
  })

  const legacyConfig = {
    visitTiers: DEFAULT_VISIT_TIERS,
    occasionTags: DEFAULT_OCCASION_TAGS,
    customers: DEFAULT_CUSTOMERS,
    tables: legacyTables,
  } as unknown as RestaurantConfig & { tables?: typeof legacyTables }

  const migrated = migrateStarterLayout(legacyConfig)
  assert.ok(migrated)
  // Should migrate starter layout to DEFAULT_FLOOR_ITEMS
  assert.deepEqual(migrated.floorItems, DEFAULT_FLOOR_ITEMS)
})

test('WorkspaceConfigStore - validates optional FloorItemBase fields (pax, time, bill) and shared shape constants', () => {
  assert.deepEqual(TABLE_SHAPES, ['round', 'square', 'rectangle', 'oval', 'long'])
  assert.deepEqual(COUCH_SHAPES, ['loveseat', 'sofa', 'l-sectional', 'banquette'])

  const baseItem = {
    id: 'Table 1',
    kind: 'Table' as const,
    tableType: 'round' as const,
    capacity: 4,
    status: 'seated' as const,
    x: 100,
    y: 100,
    rotation: 0,
  }

  // Valid optional fields
  assert.equal(
    isRestaurantConfig({
      ...DEFAULT_RESTAURANT_CONFIG,
      floorItems: [{ ...baseItem, pax: 4, time: '7:30 PM', bill: 185.5 }],
    }),
    true
  )

  // Invalid pax (non-integer, < 1, > 30)
  for (const badPax of [0, -1, 31, 2.5, '4', null]) {
    assert.equal(
      isRestaurantConfig({
        ...DEFAULT_RESTAURANT_CONFIG,
        floorItems: [{ ...baseItem, pax: badPax as unknown as number }],
      }),
      false,
      `Expected pax=${String(badPax)} to fail validation`
    )
  }

  // Invalid time (non-string or > 40 chars)
  for (const badTime of [123, 'x'.repeat(41), null]) {
    assert.equal(
      isRestaurantConfig({
        ...DEFAULT_RESTAURANT_CONFIG,
        floorItems: [{ ...baseItem, time: badTime as unknown as string }],
      }),
      false,
      `Expected time=${String(badTime)} to fail validation`
    )
  }

  // Invalid bill (negative, NaN, Infinity, > 1_000_000, non-number)
  for (const badBill of [-0.01, -10, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001, '100', null]) {
    assert.equal(
      isRestaurantConfig({
        ...DEFAULT_RESTAURANT_CONFIG,
        floorItems: [{ ...baseItem, bill: badBill as unknown as number }],
      }),
      false,
      `Expected bill=${String(badBill)} to fail validation`
    )
  }
})

test('WorkspaceConfigStore - validateConfig checks 500_000-byte size limit before deep traversal', () => {
  const store = new WorkspaceConfigStore(new InMemoryConfigStorageAdapter())

  let deepTraversalReached = false
  const oversizedPayload = {
    toJSON() {
      return 'x'.repeat(500_001)
    },
    get visitTiers() {
      deepTraversalReached = true
      return DEFAULT_VISIT_TIERS
    },
  }

  const res = store.validateConfig(oversizedPayload)
  assert.equal(res.valid, false)
  assert.equal(deepTraversalReached, false, 'Oversized payload should be rejected before deep traversal')
})

test('DrizzleConfigStorageAdapter.put propagates DB write errors and does not silently succeed', async () => {
  const fallback = new InMemoryConfigStorageAdapter()
  const dbError = new Error('PostgreSQL connection refused')
  const failingDb = {
    insert() {
      return {
        values() {
          return {
            async onConflictDoUpdate() {
              throw dbError
            },
          }
        },
      }
    },
  } as unknown as ConstructorParameters<typeof DrizzleConfigStorageAdapter>[1]

  const adapter = new DrizzleConfigStorageAdapter(fallback, failingDb)
  const store = new WorkspaceConfigStore(adapter)

  await assert.rejects(
    async () => {
      await store.saveConfig(DEFAULT_RESTAURANT_CONFIG, 'manager-1')
    },
    (err: unknown) => err === dbError
  )

  // Fallback should not hold uncommitted data when DB write fails
  assert.equal(await fallback.get('manager-1'), null)
})
