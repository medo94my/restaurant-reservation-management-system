import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CustomerService,
  DrizzleCustomerStorageAdapter,
  InMemoryCustomerStorageAdapter,
  dbRowToCustomer,
  maskCustomerForRole,
  maskPhone,
  normalizePhone,
  resolveLoyaltyTier,
  CustomerAlreadyExistsError,
  CustomerNotFoundError,
  CustomerValidationError,
  type CustomerStorageAdapter,
  type Customer,
} from './customer-service.ts'
import { normalizePhone as canonicalNormalizePhone } from './phone.ts'

test('CustomerService - normalizePhone strips all non-digits correctly', () => {
  assert.equal(normalizePhone('+961 70 123 456'), '96170123456')
  assert.equal(normalizePhone('+1 (555) 019-2834'), '15550192834')
  assert.equal(normalizePhone('03-998877'), '03998877')
  assert.equal(normalizePhone('  961 3 112 233  '), '9613112233')
  assert.equal(normalizePhone(''), '')
  assert.equal(normalizePhone('letters-only'), '')
})

test('CustomerService - resolveLoyaltyTier correctly maps visit counts', () => {
  // 0-4 visits: 'new'
  assert.equal(resolveLoyaltyTier(0), 'new')
  assert.equal(resolveLoyaltyTier(1), 'new')
  assert.equal(resolveLoyaltyTier(4), 'new')

  // 5-9 visits: 'regular'
  assert.equal(resolveLoyaltyTier(5), 'regular')
  assert.equal(resolveLoyaltyTier(7), 'regular')
  assert.equal(resolveLoyaltyTier(9), 'regular')

  // 10-14 visits: 'loyal'
  assert.equal(resolveLoyaltyTier(10), 'loyal')
  assert.equal(resolveLoyaltyTier(12), 'loyal')
  assert.equal(resolveLoyaltyTier(14), 'loyal')

  // 15+ visits: 'vip'
  assert.equal(resolveLoyaltyTier(15), 'vip')
  assert.equal(resolveLoyaltyTier(25), 'vip')
  assert.equal(resolveLoyaltyTier(100), 'vip')
})

test('CustomerService - customer creation normalizes phone and sets initial tier', async () => {
  const adapter = new InMemoryCustomerStorageAdapter([])
  const service = new CustomerService(adapter)

  const created = await service.createCustomer({
    name: 'Jad Traboulsi',
    phone: '+961 71 888 777',
    dietaryFlags: ['vegetarian', 'no-coriander'],
    seatingPreferences: 'Corner booth',
    permanentNotes: 'Prefers quiet seating',
    visitCount: 0,
    totalSpend: 0,
  })

  assert.ok(created.id.startsWith('cust-'))
  assert.equal(created.name, 'Jad Traboulsi')
  assert.equal(created.phone, '96171888777')
  assert.deepEqual(created.dietaryFlags, ['vegetarian', 'no-coriander'])
  assert.equal(created.seatingPreferences, 'Corner booth')
  assert.equal(created.permanentNotes, 'Prefers quiet seating')
  assert.equal(created.visitCount, 0)
  assert.equal(created.totalSpend, 0)
  assert.equal(created.loyaltyTier, 'new')
  assert.equal(created.lastVisitAt, null)
  assert.ok(created.createdAt)
  assert.ok(created.updatedAt)
})

test('CustomerService - customer creation rejects missing name or invalid phone', async () => {
  const adapter = new InMemoryCustomerStorageAdapter([])
  const service = new CustomerService(adapter)

  await assert.rejects(
    async () => {
      await service.createCustomer({ name: '', phone: '96170111222' })
    },
    CustomerValidationError
  )

  await assert.rejects(
    async () => {
      await service.createCustomer({ name: 'Valid Name', phone: '' })
    },
    CustomerValidationError
  )

  await assert.rejects(
    async () => {
      await service.createCustomer({ name: 'Valid Name', phone: '12' }) // too short
    },
    CustomerValidationError
  )
})

test('CustomerService - uniqueness validation prevents duplicate phone numbers', async () => {
  const adapter = new InMemoryCustomerStorageAdapter([])
  const service = new CustomerService(adapter)

  await service.createCustomer({
    name: 'First Guest',
    phone: '+961 70 123 456',
  })

  // Same exact phone digits, different formatting
  await assert.rejects(
    async () => {
      await service.createCustomer({
        name: 'Second Guest',
        phone: '961-70-123-456',
      })
    },
    CustomerAlreadyExistsError
  )
})

test('CustomerService - searchCustomers matches case-insensitive names and partial phones', async () => {
  const adapter = new InMemoryCustomerStorageAdapter([])
  const service = new CustomerService(adapter)

  await service.createCustomer({ name: 'Nadia Khoury', phone: '+961 70 123 456' })
  await service.createCustomer({ name: 'Karim Haddad', phone: '+961 71 111 222' })
  await service.createCustomer({ name: 'Maya Saad', phone: '+961 76 999 888' })

  // Search by partial case-insensitive name
  const nameSearch1 = await service.searchCustomers('nadia')
  assert.equal(nameSearch1.length, 1)
  assert.equal(nameSearch1[0].name, 'Nadia Khoury')

  const nameSearch2 = await service.searchCustomers('KHOURY')
  assert.equal(nameSearch2.length, 1)
  assert.equal(nameSearch2[0].name, 'Nadia Khoury')

  // Search by partial phone number
  const phoneSearch1 = await service.searchCustomers('71111')
  assert.equal(phoneSearch1.length, 1)
  assert.equal(phoneSearch1[0].name, 'Karim Haddad')

  // Search by formatted phone substring
  const phoneSearch2 = await service.searchCustomers('+961 76')
  assert.equal(phoneSearch2.length, 1)
  assert.equal(phoneSearch2[0].name, 'Maya Saad')

  // Empty search returns all top recent/loyal customers
  const emptySearch = await service.searchCustomers('')
  assert.equal(emptySearch.length, 3)
})

test('CustomerService - recordVisitAndSpend increments visits, spend, updates lastVisitAt, and advances tier', async () => {
  const adapter = new InMemoryCustomerStorageAdapter([])
  const service = new CustomerService(adapter)

  const customer = await service.createCustomer({
    name: 'Rana Azar',
    phone: '+961 70 444 555',
    visitCount: 4, // 'new' tier (0-4)
    totalSpend: 320,
  })
  assert.equal(customer.loyaltyTier, 'new')

  // 1st visit: 4 -> 5 visits, transitions to 'regular' (5-9)
  const after5th = await service.recordVisitAndSpend(customer.id, 125.5)
  assert.equal(after5th.visitCount, 5)
  assert.equal(after5th.totalSpend, 445.5)
  assert.equal(after5th.loyaltyTier, 'regular')
  assert.ok(after5th.lastVisitAt instanceof Date || typeof after5th.lastVisitAt === 'string')

  // Advance visits to 9
  await service.updateCustomer(customer.id, { visitCount: 9 })
  assert.equal((await service.getCustomerById(customer.id))?.loyaltyTier, 'regular')

  // 10th visit: transitions from 'regular' to 'loyal' (10-14)
  const after10th = await service.recordVisitAndSpend(customer.id, 200)
  assert.equal(after10th.visitCount, 10)
  assert.equal(after10th.totalSpend, 645.5)
  assert.equal(after10th.loyaltyTier, 'loyal')

  // Advance visits to 14
  await service.updateCustomer(customer.id, { visitCount: 14 })
  assert.equal((await service.getCustomerById(customer.id))?.loyaltyTier, 'loyal')

  // 15th visit: transitions from 'loyal' to 'vip' (15+)
  const after15th = await service.recordVisitAndSpend(customer.id, 350)
  assert.equal(after15th.visitCount, 15)
  assert.equal(after15th.totalSpend, 995.5)
  assert.equal(after15th.loyaltyTier, 'vip')
})

test('CustomerService - recordVisitAndSpend rejects non-existent ID or invalid bill amount', async () => {
  const adapter = new InMemoryCustomerStorageAdapter([])
  const service = new CustomerService(adapter)

  await assert.rejects(
    async () => {
      await service.recordVisitAndSpend('non-existent-id', 100)
    },
    CustomerNotFoundError
  )

  const customer = await service.createCustomer({
    name: 'Test Guest',
    phone: '96170999111',
  })

  await assert.rejects(
    async () => {
      await service.recordVisitAndSpend(customer.id, -50)
    },
    CustomerValidationError
  )
})

test('CustomerService - updateCustomer updates profile fields and checks phone conflicts', async () => {
  const adapter = new InMemoryCustomerStorageAdapter([])
  const service = new CustomerService(adapter)

  const guestA = await service.createCustomer({
    name: 'Guest A',
    phone: '96170111111',
    dietaryFlags: ['vegetarian'],
  })

  const guestB = await service.createCustomer({
    name: 'Guest B',
    phone: '96170222222',
  })

  // Update profile details
  const updatedA = await service.updateCustomer(guestA.id, {
    dietaryFlags: ['vegetarian', 'gluten-free'],
    seatingPreferences: 'Outdoor terrace',
    permanentNotes: 'VIP guest table',
  })

  assert.deepEqual(updatedA.dietaryFlags, ['vegetarian', 'gluten-free'])
  assert.equal(updatedA.seatingPreferences, 'Outdoor terrace')
  assert.equal(updatedA.permanentNotes, 'VIP guest table')

  // Attempting to change guestB's phone to guestA's phone should throw conflict error
  await assert.rejects(
    async () => {
      await service.updateCustomer(guestB.id, {
        phone: '961 70 111 111',
      })
    },
    CustomerAlreadyExistsError
  )
})

test('CustomerService - pluggable CustomerStorageAdapter allows custom implementation', async () => {
  let customCreated = false

  const customAdapter: CustomerStorageAdapter = {
    async findCustomerByPhone() {
      return null
    },
    async searchCustomers() {
      return []
    },
    async createCustomer(data) {
      customCreated = true
      return { ...data }
    },
    async updateCustomer(id, data) {
      return { id, ...data } as Customer
    },
    async recordVisitAndSpend(id) {
      return { id } as Customer
    },
    async getCustomerById(id) {
      return { id, name: 'Custom Stored Guest', phone: '96170000000', dietaryFlags: [], visitCount: 5, totalSpend: 500, loyaltyTier: 'regular', createdAt: '', updatedAt: '' }
    },
  }

  const customService = new CustomerService(customAdapter)
  const created = await customService.createCustomer({
    name: 'Custom Adapter Guest',
    phone: '96170333444',
  })

  assert.ok(customCreated)
  assert.equal(created.name, 'Custom Adapter Guest')

  const fetched = await customService.getCustomerById('custom-1')
  assert.equal(fetched?.name, 'Custom Stored Guest')
})

test('[F6-5] normalizePhone in customer-service is re-exported from lib/phone.ts', () => {
  assert.strictEqual(normalizePhone, canonicalNormalizePhone)
})

test('[F6-1] maskPhone and maskCustomerForRole enforce GLOSSARY.md role-based data masking', () => {
  assert.equal(maskPhone('+961 70 123 456'), '*******3456')
  assert.equal(maskPhone('1234'), '****')
  assert.equal(maskPhone(''), '')

  const fullCustomer: Customer = {
    id: 'cust-1',
    name: 'Layla Nassar',
    phone: '96170123456',
    dietaryFlags: ['gluten-free'],
    seatingPreferences: 'Window table',
    permanentNotes: 'Prefers sparkling water on arrival',
    note: 'Prefers sparkling water on arrival',
    visitCount: 16,
    visits: 16,
    totalSpend: 1450.75,
    lastVisitAt: '2026-10-01T20:00:00.000Z',
    loyaltyTier: 'vip',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-10-01T20:00:00.000Z',
    occasionTags: ['vip', 'anniversary'],
  }

  // Managers and admins receive unmasked PII and spend
  const forManager = maskCustomerForRole(fullCustomer, 'manager')
  assert.equal(forManager.phone, '96170123456')
  assert.equal(forManager.totalSpend, 1450.75)
  assert.equal(forManager.permanentNotes, 'Prefers sparkling water on arrival')
  assert.equal(forManager.note, 'Prefers sparkling water on arrival')
  assert.deepEqual(forManager.occasionTags, ['vip', 'anniversary'])

  const forAdmin = maskCustomerForRole(fullCustomer, 'admin')
  assert.equal(forAdmin.phone, '96170123456')
  assert.equal(forAdmin.totalSpend, 1450.75)

  // Non-manager roles (host, server, undefined) have phone, spend, and notes masked
  for (const role of ['host', 'hostess', 'server', undefined, null]) {
    const masked = maskCustomerForRole(fullCustomer, role)
    assert.equal(masked.name, 'Layla Nassar')
    assert.equal(masked.phone, '*******3456')
    assert.equal(masked.totalSpend, 0)
    assert.equal(masked.permanentNotes, '')
    assert.equal(masked.note, '')
    // Operational hospitality context remains available to hosts
    assert.deepEqual(masked.dietaryFlags, ['gluten-free'])
    assert.equal(masked.seatingPreferences, 'Window table')
    assert.equal(masked.loyaltyTier, 'vip')
    assert.deepEqual(masked.occasionTags, ['vip', 'anniversary'])
  }
})

test('[F6-2] DrizzleCustomerStorageAdapter propagates DB errors without falling back to InMemoryCustomerStorageAdapter', async () => {
  const dbOutageError = new Error('ECONNREFUSED: PostgreSQL connection refused')

  const failingDb = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => {
                  throw dbOutageError
                },
                orderBy() {
                  return {
                    limit: async () => {
                      throw dbOutageError
                    },
                  }
                },
              }
            },
            orderBy() {
              return {
                limit: async () => {
                  throw dbOutageError
                },
              }
            },
          }
        },
      }
    },
    insert() {
      return {
        values() {
          return {
            returning: async () => {
              throw dbOutageError
            },
          }
        },
      }
    },
    update() {
      return {
        set() {
          return {
            where() {
              return {
                returning: async () => {
                  throw dbOutageError
                },
              }
            },
          }
        },
      }
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new DrizzleCustomerStorageAdapter(failingDb as any)

  await assert.rejects(() => adapter.findCustomerByPhone('+961 70 123 456'), /ECONNREFUSED/)
  await assert.rejects(() => adapter.searchCustomers('Nadia'), /ECONNREFUSED/)
  await assert.rejects(() => adapter.searchCustomers(''), /ECONNREFUSED/)
  await assert.rejects(() => adapter.getCustomerById('cust-1'), /ECONNREFUSED/)
  await assert.rejects(
    () =>
      adapter. updateCustomer('cust-1', {
        name: 'Updated Name',
      }),
    /ECONNREFUSED/
  )
  await assert.rejects(() => adapter.recordVisitAndSpend('cust-1', 120), /ECONNREFUSED/)
})

test('[F6-2] DrizzleCustomerStorageAdapter.searchCustomers applies SQL WHERE filtering and LIMIT', async () => {
  let whereCalled = false
  let limitPassed: number | null = null

  const mockRow = {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Nadia Khoury',
    phone: '96170123456',
    email: null,
    visitCount: 8,
    totalSpend: '680.00',
    loyaltyTier: 'regular',
    dietaryFlags: ['vegetarian'],
    seatingPreferences: ['Quiet table'],
    occasionTags: ['vip', 'birthday'],
    permanentNotes: 'Corner table',
    lastVisitAt: new Date('2026-10-10T20:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-10-10T20:00:00Z'),
  }

  const mockDb = {
    select() {
      return {
        from() {
          return {
            where(clause: unknown) {
              assert.ok(clause, 'SQL WHERE clause must be provided for non-empty search query')
              whereCalled = true
              return {
                orderBy() {
                  return {
                    limit: async (n: number) => {
                      limitPassed = n
                      return [mockRow]
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new DrizzleCustomerStorageAdapter(mockDb as any)
  const results = await adapter.searchCustomers('Nadia', 25)

  assert.equal(whereCalled, true)
  assert.equal(limitPassed, 25)
  assert.equal(results.length, 1)
  assert.equal(results[0].name, 'Nadia Khoury')
  assert.deepEqual(results[0].occasionTags, ['vip', 'birthday'])
})

test('[F6-3] dbRowToCustomer, createCustomer, and updateCustomer map and persist occasionTags', async () => {
  const insertedValues: Record<string, unknown> = {}
  const updatedValues: Record<string, unknown> = {}

  const baseRow = {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Tariq Mansour',
    phone: '96171555666',
    email: null,
    visitCount: 12,
    totalSpend: '1020.00',
    loyaltyTier: 'loyal',
    dietaryFlags: ['nut-free'],
    seatingPreferences: ['Window table'],
    occasionTags: ['anniversary', 'vip'],
    permanentNotes: 'Loves terrace',
    lastVisitAt: new Date('2026-10-12T20:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-10-12T20:00:00Z'),
  }

  const mapped = dbRowToCustomer(baseRow)
  assert.deepEqual(mapped.occasionTags, ['anniversary', 'vip'])

  const mockDb = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [],
              }
            },
          }
        },
      }
    },
    insert() {
      return {
        values(vals: Record<string, unknown>) {
          Object.assign(insertedValues, vals)
          return {
            returning: async () => [{ ...baseRow, occasionTags: vals.occasionTags as string[] }],
          }
        },
      }
    },
    update() {
      return {
        set(vals: Record<string, unknown>) {
          Object.assign(updatedValues, vals)
          return {
            where() {
              return {
                returning: async () => [{ ...baseRow, occasionTags: vals.occasionTags as string[] }],
              }
            },
          }
        },
      }
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new DrizzleCustomerStorageAdapter(mockDb as any)

  const created = await adapter.createCustomer({
    ...mapped,
    occasionTags: ['birthday', 'wine-lover'],
  })
  assert.deepEqual(insertedValues.occasionTags, ['birthday', 'wine-lover'])
  assert.deepEqual(created.occasionTags, ['birthday', 'wine-lover'])

  const updated = await adapter.updateCustomer(mapped.id, {
    occasionTags: ['vvip'],
  })
  assert.deepEqual(updatedValues.occasionTags, ['vvip'])
  assert.deepEqual(updated.occasionTags, ['vvip'])
})

test('[F6-4] DrizzleCustomerStorageAdapter.recordVisitAndSpend performs a single atomic SQL UPDATE', async () => {
  let selectCalls = 0
  let updateCalls = 0
  const setPayload: Record<string, unknown> = {}

  const updatedRow = {
    id: '33333333-3333-4333-a333-333333333333',
    name: 'Ziad Karam',
    phone: '96170777888',
    email: null,
    visitCount: 5,
    totalSpend: '425.50',
    loyaltyTier: 'regular',
    dietaryFlags: [],
    seatingPreferences: [],
    occasionTags: ['regular-guest'],
    permanentNotes: '',
    lastVisitAt: new Date(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date(),
  }

  const mockDb = {
    select() {
      selectCalls += 1
      throw new Error('recordVisitAndSpend must not perform a separate non-atomic SELECT before UPDATE')
    },
    update() {
      updateCalls += 1
      return {
        set(vals: Record<string, unknown>) {
          Object.assign(setPayload, vals)
          return {
            where() {
              return {
                returning: async () => [updatedRow],
              }
            },
          }
        },
      }
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new DrizzleCustomerStorageAdapter(mockDb as any)
  const service = new CustomerService(adapter)

  const result = await service.recordVisitAndSpend(updatedRow.id, 105.5)
  assert.equal(selectCalls, 0, 'Must not perform read-before-write SELECT')
  assert.equal(updateCalls, 1, 'Must perform exactly one atomic UPDATE')
  assert.ok(setPayload.visitCount, 'visitCount SQL increment expression must be set')
  assert.ok(setPayload.totalSpend, 'totalSpend SQL increment expression must be set')
  assert.ok(setPayload.loyaltyTier, 'loyaltyTier SQL CASE expression must be set')
  assert.equal(result.visitCount, 5)
  assert.equal(result.totalSpend, 425.5)
  assert.equal(result.loyaltyTier, 'regular')
})
