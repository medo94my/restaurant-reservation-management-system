import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateTurnTime,
  dbRowToReservation,
  decodeShiftNote,
  DrizzleReservationStorageAdapter,
  encodeShiftNote,
  InMemoryReservationStorageAdapter,
  InvalidReservationStateError,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationService,
  ReservationValidationError,
  type CustomerSpendRecord,
  type Reservation,
  type ReservationStorageAdapter,
} from './reservation-service.ts'

test('Turn-time calculation - applies 90 mins for <= 4 guests, 120 mins for > 4 guests', () => {
  const service = new ReservationService()

  assert.equal(calculateTurnTime(1), 90)
  assert.equal(calculateTurnTime(2), 90)
  assert.equal(calculateTurnTime(4), 90)
  assert.equal(calculateTurnTime(5), 120)
  assert.equal(calculateTurnTime(8), 120)
  assert.equal(calculateTurnTime(12), 120)

  // Service method delegates correctly
  assert.equal(service.calculateTurnTime(2), 90)
  assert.equal(service.calculateTurnTime(6), 120)
})

test('Reservation creation - creates advance booking with tableId null (assign on arrival)', async () => {
  const service = new ReservationService()

  const reservation = await service.createReservation({
    customerId: 'cust-101',
    customerName: 'Nadia Khoury',
    customerPhone: '+96170123456',
    partySize: 4,
    reservationTime: '2026-11-12T19:00:00.000Z',
    tableId: null,
    notes: 'Window preference if possible',
  })

  assert.ok(reservation.id)
  assert.equal(reservation.customerId, 'cust-101')
  assert.equal(reservation.partySize, 4)
  assert.equal(reservation.durationMinutes, 90) // party of 4 -> 90 min
  assert.equal(reservation.tableId, null)
  assert.equal(reservation.status, 'booked')
  assert.equal(reservation.warning, null)

  const fetched = await service.getReservation(reservation.id)
  assert.deepEqual(fetched, reservation)
})

test('Reservation creation - validates partySize, reservationTime, and customerId', async () => {
  const service = new ReservationService()

  // Missing customerId
  await assert.rejects(
    () =>
      service.createReservation({
        customerId: '',
        partySize: 2,
        reservationTime: '2026-11-12T19:00:00.000Z',
      }),
    (err: unknown) => err instanceof ReservationValidationError && err.message.includes('Customer ID')
  )

  // Invalid partySize
  await assert.rejects(
    () =>
      service.createReservation({
        customerId: 'cust-1',
        partySize: 0,
        reservationTime: '2026-11-12T19:00:00.000Z',
      }),
    (err: unknown) => err instanceof ReservationValidationError && err.message.includes('Party size')
  )

  // Invalid reservationTime
  await assert.rejects(
    () =>
      service.createReservation({
        customerId: 'cust-1',
        partySize: 2,
        reservationTime: 'not-a-date',
      }),
    (err: unknown) => err instanceof ReservationValidationError && err.message.includes('valid ISO date')
  )
})

test('Conflict / overlap detection - detects overlapping active reservations and generates warning', async () => {
  const service = new ReservationService()

  // Table T1 booked from 18:00 to 19:30 (90 mins, party 2)
  const res1 = await service.createReservation({
    customerId: 'cust-1',
    partySize: 2,
    reservationTime: '2026-11-12T18:00:00.000Z',
    tableId: 'T1',
  })
  assert.equal(res1.warning, null)

  // Check overlap for Table T1 at 18:30 (duration 90 mins -> 18:30 to 20:00)
  const overlap1 = await service.checkTableOverlap('T1', '2026-11-12T18:30:00.000Z', 90)
  assert.equal(overlap1.hasOverlap, true)
  assert.equal(overlap1.conflictingReservations.length, 1)
  assert.equal(overlap1.conflictingReservations[0].id, res1.id)
  assert.ok(overlap1.warning?.includes('Table T1 has overlapping reservation(s)'))

  // Check overlap at 19:30 (starts exactly when previous ends) -> No overlap
  const overlapExactEnd = await service.checkTableOverlap('T1', '2026-11-12T19:30:00.000Z', 90)
  assert.equal(overlapExactEnd.hasOverlap, false)
  assert.equal(overlapExactEnd.conflictingReservations.length, 0)

  // Check overlap for another table T2 at 18:30 -> No overlap
  const overlapOtherTable = await service.checkTableOverlap('T2', '2026-11-12T18:30:00.000Z', 90)
  assert.equal(overlapOtherTable.hasOverlap, false)

  // Check overlap excluding res1 -> No overlap
  const overlapExcluded = await service.checkTableOverlap('T1', '2026-11-12T18:30:00.000Z', 90, res1.id)
  assert.equal(overlapExcluded.hasOverlap, false)

  // Booking table T1 with overlap attaches a warning to reservation by default
  const res2 = await service.createReservation({
    customerId: 'cust-2',
    partySize: 2,
    reservationTime: '2026-11-12T18:30:00.000Z',
    tableId: 'T1',
  })
  assert.ok(res2.warning?.includes('Table T1 has overlapping reservation(s)'))

  // Booking with strictOverlap: true throws ReservationConflictError
  await assert.rejects(
    () =>
      service.createReservation(
        {
          customerId: 'cust-3',
          partySize: 2,
          reservationTime: '2026-11-12T18:45:00.000Z',
          tableId: 'T1',
        },
        { strictOverlap: true }
      ),
    (err: unknown) => err instanceof ReservationConflictError && err.message.includes('overlapping reservation')
  )
})

test('Lifecycle state machine - transitions booked -> confirmed -> seated -> completed', async () => {
  let recordedSpend: CustomerSpendRecord | null = null

  const service = new ReservationService({
    onCustomerSpend: (record) => {
      recordedSpend = record
    },
  })

  // 1. Create reservation ('booked')
  const res = await service.createReservation({
    customerId: 'cust-nadia',
    partySize: 2,
    reservationTime: '2026-11-12T20:00:00.000Z',
    tableId: null,
  })
  assert.equal(res.status, 'booked')

  // 2. Confirm reservation ('confirmed')
  const confirmed = await service.confirmReservation(res.id, 'staff-host')
  assert.equal(confirmed.status, 'confirmed')
  assert.equal(confirmed.staffId, 'staff-host')

  // Idempotent confirmation
  const reconfirmed = await service.confirmReservation(res.id)
  assert.equal(reconfirmed.status, 'confirmed')

  // 3. Seat party ('seated') with table assignment
  const seated = await service.seatParty(res.id, 'T3', 'staff-host')
  assert.equal(seated.status, 'seated')
  assert.equal(seated.tableId, 'T3')
  assert.ok(seated.seatedAt)

  // 4. Complete check ('completed') with bill amount
  const completed = await service.completeCheck(res.id, 185.5, 'staff-server')
  assert.equal(completed.status, 'completed')
  assert.equal(completed.billAmount, 185.5)
  assert.ok(completed.completedAt)

  // Verify customer visit/spend record update was triggered
  assert.ok(recordedSpend)
  assert.equal((recordedSpend as CustomerSpendRecord).customerId, 'cust-nadia')
  assert.equal((recordedSpend as CustomerSpendRecord).billAmount, 185.5)
  assert.equal((recordedSpend as CustomerSpendRecord).reservationId, res.id)

  // Table T3 is released; overlap check no longer sees completed reservation as conflict
  const overlap = await service.checkTableOverlap('T3', '2026-11-12T20:00:00.000Z', 90)
  assert.equal(overlap.hasOverlap, false)
})

test('Lifecycle state machine - supports direct seating from booked and terminal cancellation/no-show', async () => {
  const service = new ReservationService()

  // Direct walk-in / arrival seating from booked
  const res1 = await service.createReservation({
    customerId: 'cust-karim',
    partySize: 4,
    reservationTime: '2026-11-12T19:00:00.000Z',
    tableId: 'T4',
  })
  const seated1 = await service.seatParty(res1.id)
  assert.equal(seated1.status, 'seated')
  assert.equal(seated1.tableId, 'T4')

  // Cancel reservation
  const res2 = await service.createReservation({
    customerId: 'cust-maya',
    partySize: 2,
    reservationTime: '2026-11-12T19:30:00.000Z',
  })
  const cancelled = await service.cancelReservation(res2.id, 'Guest feeling unwell')
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.cancelReason, 'Guest feeling unwell')
  assert.ok(cancelled.cancelledAt)

  // No-show reservation
  const res3 = await service.createReservation({
    customerId: 'cust-tarek',
    partySize: 6,
    reservationTime: '2026-11-12T21:00:00.000Z',
  })
  const noShow = await service.markNoShow(res3.id, 'staff-manager')
  assert.equal(noShow.status, 'no_show')
  assert.equal(noShow.staffId, 'staff-manager')
})

test('Lifecycle state machine - enforces invalid transition guards', async () => {
  const service = new ReservationService()

  const res = await service.createReservation({
    customerId: 'cust-1',
    partySize: 2,
    reservationTime: '2026-11-12T20:00:00.000Z',
    tableId: 'T5',
  })

  // Cannot complete check if party is only 'booked'
  await assert.rejects(
    () => service.completeCheck(res.id, 50),
    (err: unknown) => err instanceof InvalidReservationStateError
  )

  // Seat the party
  await service.seatParty(res.id)

  // Cannot seat an already seated party
  await assert.rejects(
    () => service.seatParty(res.id, 'T5'),
    (err: unknown) => err instanceof InvalidReservationStateError && err.message.includes('already seated')
  )

  // Cannot cancel a seated party
  await assert.rejects(
    () => service.cancelReservation(res.id),
    (err: unknown) => err instanceof InvalidReservationStateError
  )

  // Cannot mark no-show for a seated party
  await assert.rejects(
    () => service.markNoShow(res.id),
    (err: unknown) => err instanceof InvalidReservationStateError
  )

  // Complete check
  await service.completeCheck(res.id, 100)

  // Cannot confirm, seat, or cancel completed party
  await assert.rejects(
    () => service.confirmReservation(res.id),
    (err: unknown) => err instanceof InvalidReservationStateError
  )
  await assert.rejects(
    () => service.seatParty(res.id, 'T5'),
    (err: unknown) => err instanceof InvalidReservationStateError
  )
  await assert.rejects(
    () => service.cancelReservation(res.id),
    (err: unknown) => err instanceof InvalidReservationStateError
  )
})

test('Seating collision - rejects seating party on a table that is currently occupied by another seated party', async () => {
  const service = new ReservationService()

  const res1 = await service.createReservation({
    customerId: 'cust-1',
    partySize: 2,
    reservationTime: '2026-11-12T19:00:00.000Z',
    tableId: 'T6',
  })
  const res2 = await service.createReservation({
    customerId: 'cust-2',
    partySize: 2,
    reservationTime: '2026-11-12T19:30:00.000Z',
    tableId: null,
  })

  // Seat party 1 at T6
  await service.seatParty(res1.id, 'T6')

  // Attempting to seat party 2 at T6 while party 1 is still seated throws ReservationConflictError
  await assert.rejects(
    () => service.seatParty(res2.id, 'T6'),
    (err: unknown) => err instanceof ReservationConflictError && err.message.includes('currently occupied')
  )
})

test('Pluggable storage adapter - InMemoryReservationStorageAdapter records customer spends and filters by date and status', async () => {
  const storage = new InMemoryReservationStorageAdapter()
  const service = new ReservationService({ storage })

  await service.createReservation({
    customerId: 'cust-1',
    partySize: 2,
    reservationTime: '2026-11-12T18:00:00.000Z',
    tableId: 'T1',
  })

  const res2 = await service.createReservation({
    customerId: 'cust-2',
    partySize: 4,
    reservationTime: '2026-11-12T20:00:00.000Z',
    tableId: 'T2',
  })

  await service.createReservation({
    customerId: 'cust-3',
    partySize: 6,
    reservationTime: '2026-11-13T19:00:00.000Z',
    tableId: 'T1',
  })

  // Filter by date
  const nov12 = await service.listReservations({ date: '2026-11-12' })
  assert.equal(nov12.length, 2)

  const nov13 = await service.listReservations({ date: '2026-11-13' })
  assert.equal(nov13.length, 1)

  // Seat and complete res2
  await service.seatParty(res2.id)
  await service.completeCheck(res2.id, 250)

  // Filter by status
  const seatedOrCompleted = await service.listReservations({ status: 'completed' })
  assert.equal(seatedOrCompleted.length, 1)
  assert.equal(seatedOrCompleted[0].id, res2.id)

  // Check spend records on storage adapter
  const spends = storage.getCustomerSpends()
  assert.equal(spends.length, 1)
  assert.equal(spends[0].customerId, 'cust-2')
  assert.equal(spends[0].billAmount, 250)
})

test('[F7-2] Concurrency - prevents double-booking and double-seating under concurrent calls', async () => {
  const baseStorage = new InMemoryReservationStorageAdapter()
  const slowAdapter: ReservationStorageAdapter = {
    async create(r) {
      await new Promise((resolve) => setTimeout(resolve, 15))
      return baseStorage.create(r)
    },
    async getById(id) {
      await new Promise((resolve) => setTimeout(resolve, 15))
      return baseStorage.getById(id)
    },
    async update(id, updates) {
      await new Promise((resolve) => setTimeout(resolve, 15))
      return baseStorage.update(id, updates)
    },
    async list(filter) {
      await new Promise((resolve) => setTimeout(resolve, 15))
      return baseStorage.list(filter)
    },
  }

  const service = new ReservationService({ storage: slowAdapter })

  // Concurrent strictOverlap bookings for Table T1 at overlapping times
  const bookingResults = await Promise.allSettled([
    service.createReservation(
      {
        customerId: 'cust-race-1',
        partySize: 2,
        reservationTime: '2026-11-14T19:00:00.000Z',
        tableId: 'T1',
      },
      { strictOverlap: true }
    ),
    service.createReservation(
      {
        customerId: 'cust-race-2',
        partySize: 2,
        reservationTime: '2026-11-14T19:15:00.000Z',
        tableId: 'T1',
      },
      { strictOverlap: true }
    ),
  ])

  const fulfilledBookings = bookingResults.filter((r) => r.status === 'fulfilled')
  const rejectedBookings = bookingResults.filter((r) => r.status === 'rejected')
  assert.equal(fulfilledBookings.length, 1, 'Exactly one concurrent strict booking should succeed')
  assert.equal(rejectedBookings.length, 1, 'Conflicting concurrent booking must be rejected')
  assert.ok(rejectedBookings[0].reason instanceof ReservationConflictError)

  // Create two unassigned bookings, then race to seat both on Table T2
  const rA = await service.createReservation({
    customerId: 'cust-seat-a',
    partySize: 2,
    reservationTime: '2026-11-14T20:00:00.000Z',
    tableId: null,
  })
  const rB = await service.createReservation({
    customerId: 'cust-seat-b',
    partySize: 2,
    reservationTime: '2026-11-14T20:05:00.000Z',
    tableId: null,
  })

  const seatResults = await Promise.allSettled([
    service.seatParty(rA.id, 'T2'),
    service.seatParty(rB.id, 'T2'),
  ])

  const fulfilledSeats = seatResults.filter((r) => r.status === 'fulfilled')
  const rejectedSeats = seatResults.filter((r) => r.status === 'rejected')
  assert.equal(fulfilledSeats.length, 1, 'Exactly one concurrent seatParty should succeed')
  assert.equal(rejectedSeats.length, 1, 'Second concurrent seatParty on same table must be rejected')
  assert.ok(rejectedSeats[0].reason instanceof ReservationConflictError)
})

test('[F7-2] DrizzleReservationStorageAdapter executes createAtomic and seatAtomic inside DB transactions with FOR UPDATE row locks', async () => {
  let transactionCalls = 0
  let forUpdateCalls = 0
  let advisoryLockCalls = 0

  const dbRows = new Map<string, Record<string, unknown>>()

  const makeMockTx = () => ({
    async execute() {
      advisoryLockCalls += 1
      return []
    },
    select() {
      return {
        from() {
          return {
            where() {
              const rows = Array.from(dbRows.values())
              const resultPromise = Promise.resolve(rows) as Promise<unknown[]> & {
                for: (mode: string) => Promise<unknown[]>
                limit: (n: number) => Promise<unknown[]> & { for: (mode: string) => Promise<unknown[]> }
              }
              resultPromise.for = (mode: string) => {
                if (mode === 'update') forUpdateCalls += 1
                return Promise.resolve(rows)
              }
              resultPromise.limit = (n: number) => {
                const sliced = rows.slice(0, n)
                const limitPromise = Promise.resolve(sliced) as Promise<unknown[]> & {
                  for: (mode: string) => Promise<unknown[]>
                }
                limitPromise.for = (mode: string) => {
                  if (mode === 'update') forUpdateCalls += 1
                  return Promise.resolve(sliced)
                }
                return limitPromise
              }
              return resultPromise
            },
          }
        },
      }
    },
    insert() {
      return {
        values(vals: Record<string, unknown>) {
          return {
            async returning() {
              const row: Record<string, unknown> = {
                ...vals,
                createdAt: vals.createdAt ?? new Date(),
                updatedAt: vals.updatedAt ?? new Date(),
              }
              dbRows.set(String(row.id), row)
              return [row]
            },
          }
        },
      }
    },
    update() {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where() {
              return {
                async returning() {
                  const first = Array.from(dbRows.values())[0]
                  if (!first) return []
                  const updated = { ...first, ...vals }
                  dbRows.set(String(updated.id), updated)
                  return [updated]
                },
              }
            },
          }
        },
      }
    },
  })

  const mockDb = {
    async transaction<T>(cb: (tx: ReturnType<typeof makeMockTx>) => Promise<T>): Promise<T> {
      transactionCalls += 1
      return cb(makeMockTx())
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new DrizzleReservationStorageAdapter(mockDb as any)
  const service = new ReservationService({ storage: adapter })

  const created = await service.createReservation(
    {
      customerId: '11111111-1111-4111-a111-111111111111',
      customerName: 'Nadia Khoury',
      customerPhone: '96170123456',
      partySize: 4,
      reservationTime: '2026-11-14T19:00:00.000Z',
      tableId: 'Table 5',
    },
    { strictOverlap: true }
  )

  assert.equal(transactionCalls, 1)
  assert.ok(forUpdateCalls >= 1)
  assert.ok(advisoryLockCalls >= 1)

  const seated = await service.seatParty(created.id, 'Table 5', 'staff-1')
  assert.equal(transactionCalls, 2)
  assert.ok(forUpdateCalls >= 3)
  assert.equal(seated.status, 'seated')
  assert.ok(seated.seatedAt)
})

test('[F7-3] DrizzleReservationStorageAdapter propagates DB errors without mutating fallback before DB queries', async () => {
  const fallback = new InMemoryReservationStorageAdapter()
  const dbError = new Error('ECONNREFUSED: PostgreSQL unavailable')

  const failingDb = {
    async transaction<T>(cb: (tx: unknown) => Promise<T>): Promise<T> {
      return cb(failingDb)
    },
    select() {
      return {
        from() {
          return {
            leftJoin() {
              const p = Promise.reject(dbError) as Promise<unknown> & {
                where: () => { limit: () => Promise<unknown> }
              }
              // Prevent unhandled rejection when .where() is chained synchronously
              p.catch(() => undefined)
              p.where = () => ({
                limit: async () => {
                  throw dbError
                },
              })
              return p
            },
            where() {
              const p = Promise.reject(dbError) as Promise<unknown> & {
                for: () => Promise<unknown>
                limit: () => { for: () => Promise<unknown> }
              }
              p.catch(() => undefined)
              p.for = async () => {
                throw dbError
              }
              p.limit = () => ({
                for: async () => {
                  throw dbError
                },
              })
              return p
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
              throw dbError
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
                  throw dbError
                },
              }
            },
          }
        },
      }
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new DrizzleReservationStorageAdapter(fallback, failingDb as any)

  const sampleReservation: Reservation = {
    id: '22222222-2222-4222-a222-222222222222',
    customerId: '33333333-3333-4333-a333-333333333333',
    customerName: 'Karim Haddad',
    customerPhone: '96171111111',
    partySize: 4,
    reservationTime: '2026-11-14T20:00:00.000Z',
    durationMinutes: 90,
    tableId: 'Table 2',
    status: 'booked',
    notes: 'Central table',
    warning: null,
    createdAt: '2026-11-14T18:00:00.000Z',
    updatedAt: '2026-11-14T18:00:00.000Z',
  }

  await assert.rejects(() => adapter.create(sampleReservation), /ECONNREFUSED/)
  assert.equal((await fallback.list()).length, 0, 'Fallback must not be mutated before DB insert')

  await assert.rejects(() => adapter.getById(sampleReservation.id), /ECONNREFUSED/)
  await assert.rejects(() => adapter.list(), /ECONNREFUSED/)
  await assert.rejects(
    () => adapter.update(sampleReservation.id, { status: 'confirmed' }),
    /ECONNREFUSED/
  )
})

test('[F7-3] DrizzleReservationStorageAdapter and dbRowToReservation persist and map billAmount, seatedAt, completedAt, cancelledAt, cancelReason, and warning without fallback', async () => {
  const storedRows = new Map<string, Record<string, unknown>>()

  const mockDb = {
    async transaction<T>(cb: (tx: unknown) => Promise<T>): Promise<T> {
      return cb(mockDb)
    },
    select() {
      return {
        from() {
          return {
            leftJoin() {
              const allJoined = Array.from(storedRows.values()).map((r) => ({
                reservation: r,
                customer: null,
              }))
              const p = Promise.resolve(allJoined) as Promise<unknown[]> & {
                where: () => { limit: (n: number) => Promise<unknown[]> }
              }
              p.where = () => ({
                limit: async (n: number) => allJoined.slice(0, n),
              })
              return p
            },
            where() {
              const allRows = Array.from(storedRows.values())
              const p = Promise.resolve(allRows) as Promise<unknown[]> & {
                for: () => Promise<unknown[]>
                limit: (n: number) => Promise<unknown[]> & { for: () => Promise<unknown[]> }
              }
              p.for = async () => allRows
              p.limit = (n: number) => {
                const sliced = allRows.slice(0, n)
                const lp = Promise.resolve(sliced) as Promise<unknown[]> & {
                  for: () => Promise<unknown[]>
                }
                lp.for = async () => sliced
                return lp
              }
              return p
            },
          }
        },
      }
    },
    insert() {
      return {
        values(vals: Record<string, unknown>) {
          return {
            async returning() {
              const row: Record<string, unknown> = {
                ...vals,
                createdAt: vals.createdAt ?? new Date(),
                updatedAt: vals.updatedAt ?? new Date(),
              }
              storedRows.set(String(row.id), row)
              return [row]
            },
          }
        },
      }
    },
    update() {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where() {
              return {
                async returning() {
                  const existing = Array.from(storedRows.values())[0]
                  if (!existing) return []
                  const updated = { ...existing, ...vals }
                  storedRows.set(String(updated.id), updated)
                  return [updated]
                },
              }
            },
          }
        },
      }
    },
  }

  // Separate adapter instances sharing only mockDb (verifying zero reliance on in-memory fallback)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writerAdapter = new DrizzleReservationStorageAdapter(mockDb as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerAdapter = new DrizzleReservationStorageAdapter(mockDb as any)

  const created = await writerAdapter.create({
    id: '44444444-4444-4444-a444-444444444444',
    customerId: 'cust-nadia',
    customerName: 'Nadia Khoury',
    customerPhone: '96170123456',
    partySize: 4,
    reservationTime: '2026-11-14T19:00:00.000Z',
    durationMinutes: 90,
    tableId: 'Table 3',
    status: 'booked',
    notes: 'Quiet corner',
    warning: 'Table Table 3 has overlapping reservation(s): prior',
    createdAt: '2026-11-14T17:00:00.000Z',
    updatedAt: '2026-11-14T17:00:00.000Z',
  })

  assert.equal(created.warning, 'Table Table 3 has overlapping reservation(s): prior')
  assert.equal(created.notes, 'Quiet corner')

  await writerAdapter.update(created.id, {
    status: 'seated',
    seatedAt: '2026-11-14T19:05:00.000Z',
  })

  await writerAdapter.update(created.id, {
    status: 'completed',
    billAmount: 310.75,
    completedAt: '2026-11-14T20:40:00.000Z',
    cancelledAt: null,
    cancelReason: null,
  })

  const fetched = await readerAdapter.getById(created.id)
  assert.ok(fetched)
  assert.equal(fetched.notes, 'Quiet corner')
  assert.equal(fetched.warning, 'Table Table 3 has overlapping reservation(s): prior')
  assert.equal(fetched.seatedAt, '2026-11-14T19:05:00.000Z')
  assert.equal(fetched.completedAt, '2026-11-14T20:40:00.000Z')
  assert.equal(fetched.billAmount, 310.75)
  assert.equal(fetched.cancelledAt, null)
  assert.equal(fetched.cancelReason, null)

  // Verify cancellation fields round-trip cleanly via encodeShiftNote / decodeShiftNote / dbRowToReservation
  const cancelledEncoded = encodeShiftNote({
    notes: 'VIP guest',
    cancelledAt: '2026-11-14T18:00:00.000Z',
    cancelReason: 'Flight delayed',
    warning: 'Overlap warning',
  })
  const decoded = decodeShiftNote(cancelledEncoded)
  assert.equal(decoded.notes, 'VIP guest')
  assert.equal(decoded.cancelledAt, '2026-11-14T18:00:00.000Z')
  assert.equal(decoded.cancelReason, 'Flight delayed')
  assert.equal(decoded.warning, 'Overlap warning')

  const mappedCancel = dbRowToReservation({
    id: '55555555-5555-4555-a555-555555555555',
    customerId: '66666666-6666-4666-a666-666666666666',
    tableId: 'Table 1',
    partySize: 2,
    reservationTime: new Date('2026-11-14T21:00:00.000Z'),
    expectedDurationMin: 90,
    status: 'cancelled',
    shiftNote: cancelledEncoded,
    createdByStaffId: null,
    createdAt: new Date('2026-11-14T16:00:00.000Z'),
    updatedAt: new Date('2026-11-14T18:00:00.000Z'),
  })
  assert.equal(mappedCancel.notes, 'VIP guest')
  assert.equal(mappedCancel.cancelledAt, '2026-11-14T18:00:00.000Z')
  assert.equal(mappedCancel.cancelReason, 'Flight delayed')
  assert.equal(mappedCancel.warning, 'Overlap warning')
})

