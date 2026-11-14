import test from 'node:test'
import assert from 'node:assert/strict'
import { DiningSessionStore, generateBookingId } from './dining-service.ts'
import type { CustomerProfile, RestaurantConfig, TableUnit } from './restaurant-config.ts'

test('DiningSessionStore - initial snapshot has floor items, starter bookings, and zero initial revenue', () => {
  const store = new DiningSessionStore()
  const snap = store.getSnapshot()

  assert.ok(snap.units.length > 0)
  assert.ok(snap.bookings.length >= 2)
  assert.equal(snap.revenue, 0)
  assert.equal(snap.isDirty, false)
  assert.equal(snap.syncStatus, 'saved')
})

test('DiningSessionStore - booking a table updates floor unit to prep and creates/updates customer record', () => {
  const store = new DiningSessionStore()
  const booking = store.bookTable({
    name: 'Sami Zayn',
    phone: '+961 70 999 888',
    pax: 4,
    kind: 'Table',
    tableType: 'square',
    time: '20:30',
    note: 'Corner table please',
    occasionTags: ['vip'],
  })

  assert.ok(booking)
  assert.equal(booking.name, 'Sami Zayn')
  assert.equal(booking.phone, '96170999888')

  const snap = store.getSnapshot()
  assert.ok(snap.bookings.some((b) => b.id === booking.id))

  // Assigned unit should be marked prep
  const assigned = snap.units.find((u) => u.id === booking.unit)
  assert.ok(assigned)
  assert.equal(assigned.status, 'prep')
  assert.equal(assigned.guest, 'Sami Zayn')

  // Customer should be in CRM
  const customer = store.findCustomer('96170999888')
  assert.ok(customer)
  assert.equal(customer.name, 'Sami Zayn')
  assert.ok(customer.occasionTags.includes('vip'))
  assert.equal(customer.visits, 0)
})

test('DiningSessionStore - completeSeating clears unit, updates revenue, and increments guest visits', () => {
  const store = new DiningSessionStore()

  // Find a unit and place a booking on it
  const targetUnit = store.getSnapshot().units.find((u) => u.kind === 'Table' && u.status === 'available') as TableUnit
  assert.ok(targetUnit)

  const booking = store.bookTable({
    name: 'Leila Farah',
    phone: '96131234567', // Existing customer with 4 visits
    pax: 2,
    kind: 'Table',
    tableType: targetUnit.tableType,
    time: '19:00',
    unitId: targetUnit.id,
  })
  assert.ok(booking)

  // Seat the table
  store.updateUnit(targetUnit.id, { status: 'seated', guest: 'Leila Farah', pax: 2, time: '7:00 PM' })
  assert.equal(store.getSnapshot().units.find((u) => u.id === targetUnit.id)?.status, 'seated')

  // Complete seating with bill
  store.completeSeating(targetUnit.id, 145.5)

  const snap = store.getSnapshot()
  const clearedUnit = snap.units.find((u) => u.id === targetUnit.id)
  assert.equal(clearedUnit?.status, 'available')
  assert.equal(clearedUnit?.guest, undefined)
  assert.equal(clearedUnit?.bill, 145.5)
  assert.equal(snap.revenue, 145.5)

  // Guest visits incremented from 4 to 5
  const guest = store.findCustomer('96131234567')
  assert.equal(guest?.visits, 5)

  // Tier resolved to Regular (minVisits 5)
  const tier = store.resolveGuestTier(guest!.visits)
  assert.equal(tier.id, 'regular')
})

test('DiningSessionStore - controllable clock generates prep alerts for due bookings', () => {
  const baseTime = new Date('2026-11-12T19:00:00')
  const store = new DiningSessionStore({
    clock: () => baseTime,
    initialBookings: [
      {
        id: 101,
        name: 'Tarek Nassar',
        phone: '96170111999',
        pax: 2,
        kind: 'Table',
        tableType: 'round',
        time: '19:25', // 25 mins from 19:00 -> due!
        note: 'Anniversary',
        unit: 'Table 1',
      },
      {
        id: 102,
        name: 'Late Guest',
        phone: '96170111888',
        pax: 2,
        kind: 'Table',
        tableType: 'round',
        time: '21:00', // 120 mins from 19:00 -> not due
        note: '',
        unit: 'Table 2',
      },
    ],
  })

  // At 19:00, Tarek is due in 25 mins
  store.setClock(new Date('2026-11-12T19:00:00'))
  let snap = store.getSnapshot()
  assert.equal(snap.dueBookings.length, 1)
  assert.equal(snap.dueBookings[0].id, 101)
  assert.equal(snap.dueBookings[0].mins, 25)

  // Advance time to 19:15 -> Tarek is due in 10 mins (less than 15, alert cleared)
  store.setClock(new Date('2026-11-12T19:15:00'))
  snap = store.getSnapshot()
  assert.equal(snap.dueBookings.length, 0)
})

test('DiningSessionStore - persistence sync adapter executes and handles error transitions', async () => {
  let syncedPayload: RestaurantConfig | null = null
  let shouldFail = false

  const store = new DiningSessionStore({
    debounceMs: 10,
    syncAdapter: async (payload) => {
      if (shouldFail) throw new Error('Network error')
      syncedPayload = payload
    },
  })

  // Mutate state
  store.updateUnit('Table 1', { status: 'blocked' })
  assert.equal(store.getSnapshot().isDirty, true)

  // Flush sync
  await store.flushSync()

  assert.equal(store.getSnapshot().isDirty, false)
  assert.equal(store.getSnapshot().syncStatus, 'saved')
  assert.ok(syncedPayload)
  const payload: RestaurantConfig = syncedPayload
  assert.equal(payload.floorItems.find((u) => u.id === 'Table 1')?.status, 'blocked')

  // Simulate network failure
  shouldFail = true
  store.updateUnit('Table 1', { status: 'available' })
  await store.flushSync()

  assert.equal(store.getSnapshot().syncStatus, 'error')
})

test('[F8-3] DiningSessionStore - completeSeating accumulates shift revenue across multiple turns and updates CRM spend', () => {
  const store = new DiningSessionStore()
  const targetUnit = store
    .getSnapshot()
    .units.find((u) => u.kind === 'Table' && u.status === 'available' && u.capacity >= 4) as TableUnit
  assert.ok(targetUnit)

  // Turn 1: Leila Farah spends $140
  const b1 = store.bookTable({
    name: 'Leila Farah',
    phone: '96131234567',
    pax: 2,
    kind: 'Table',
    tableType: 'any',
    time: '18:30',
    unitId: targetUnit.id,
  })
  assert.ok(b1)
  store.seatPrepUnit(targetUnit.id)
  store.completeSeating(targetUnit.id, 140)

  let snap = store.getSnapshot()
  assert.equal(snap.units.find((u) => u.id === targetUnit.id)?.bill, 140)
  assert.equal(snap.revenue, 140)
  const leilaAfterTurn1 = store.findCustomer('96131234567') as CustomerProfile & {
    totalSpend?: number
  }
  assert.equal(leilaAfterTurn1?.visits, 5)
  assert.equal(leilaAfterTurn1?.totalSpend, 140)

  // Turn 2 on the same unit: Karim Haddad spends $210.50
  const b2 = store.bookTable({
    name: 'Karim Haddad',
    phone: '96171111111',
    pax: 4,
    kind: 'Table',
    tableType: 'any',
    time: '20:30',
    unitId: targetUnit.id,
  })
  assert.ok(b2)
  store.seatPrepUnit(targetUnit.id)
  store.completeSeating(targetUnit.id, 210.5)

  snap = store.getSnapshot()
  assert.equal(snap.units.find((u) => u.id === targetUnit.id)?.bill, 350.5)
  assert.equal(snap.revenue, 350.5)
  // Leila's visits must not be incremented again on Karim's turn
  assert.equal(store.findCustomer('96131234567')?.visits, 5)
  const karimAfterTurn2 = store.findCustomer('96171111111') as CustomerProfile & {
    totalSpend?: number
  }
  assert.equal(karimAfterTurn2?.visits, 9)
  assert.equal(karimAfterTurn2?.totalSpend, 210.5)

  // Turn 3 on the same unit closed out with 0 / undefined bill preserves accumulated spend
  store.updateUnit(targetUnit.id, { status: 'seated', guest: 'Walk-in', pax: 2 })
  store.completeSeating(targetUnit.id, 0)
  assert.equal(store.getSnapshot().units.find((u) => u.id === targetUnit.id)?.bill, 350.5)
  assert.equal(store.getSnapshot().revenue, 350.5)
})

test('[F8-2] DiningSessionStore - applyRemoteUnitUpdate and applyRemoteReservationCreated do not trigger syncAdapter and preserve bill', async () => {
  let syncCalls = 0
  const store = new DiningSessionStore({
    debounceMs: 5,
    syncAdapter: async () => {
      syncCalls += 1
    },
  })

  store.applyRemoteUnitUpdate('Table 2', {
    status: 'occupied',
    guest: 'Remote Guest',
    pax: 3,
    bill: 185,
  })

  let snap = store.getSnapshot()
  const unit2 = snap.units.find((u) => u.id === 'Table 2')
  assert.equal(unit2?.status, 'seated')
  assert.equal(unit2?.guest, 'Remote Guest')
  assert.equal(unit2?.pax, 3)
  assert.equal(unit2?.bill, 185)
  assert.equal(snap.revenue, 185)
  assert.equal(snap.isDirty, false)

  // Subsequent remote update without bill preserves existing unit.bill
  store.applyRemoteUnitUpdate('Table 2', {
    status: 'available',
    guest: undefined,
    pax: undefined,
  })
  snap = store.getSnapshot()
  assert.equal(snap.units.find((u) => u.id === 'Table 2')?.bill, 185)
  assert.equal(snap.isDirty, false)

  // Remote reservation creation updates bookings without marking dirty
  const initialBookingCount = snap.bookings.length
  const remoteBooking = store.applyRemoteReservationCreated({
    reservationId: 9001,
    customerName: 'Fairouz Haddad',
    partySize: 4,
    time: '2026-11-14T21:30:00.000Z',
    tableId: 'Table 3',
  })
  assert.ok(remoteBooking)
  snap = store.getSnapshot()
  assert.equal(snap.bookings.length, initialBookingCount + 1)
  assert.equal(snap.isDirty, false)

  await store.flushSync()
  assert.equal(syncCalls, 0)
})

test('[F8-4] DiningSessionStore - mergeUnits sums combinedCapacity and reassigns bookings on merged units', () => {
  const store = new DiningSessionStore()
  const u2 = store.getSnapshot().units.find((u) => u.id === 'Table 2')!
  const u3 = store.getSnapshot().units.find((u) => u.id === 'Table 3')!
  assert.ok(u2 && u3)

  const booking = store.bookTable({
    name: 'Merged Party',
    phone: '96170555444',
    pax: u2.capacity,
    kind: 'Table',
    tableType: 'any',
    time: '20:15',
    unitId: 'Table 2',
  })
  assert.ok(booking)

  const merged = store.mergeUnits(['Table 2', 'Table 3'])
  assert.ok(merged)
  assert.equal(merged.id, 'Merge (Table 2+Table 3)')
  assert.equal(merged.capacity, u2.capacity + u3.capacity)

  const snap = store.getSnapshot()
  const updatedBooking = snap.bookings.find((b) => b.id === booking.id)
  assert.equal(updatedBooking?.unit, 'Merge (Table 2+Table 3)')
  assert.equal(snap.units.find((u) => u.id === 'Table 2')?.archived, true)
  assert.equal(snap.units.find((u) => u.id === 'Table 3')?.archived, true)
})

test('[F8-5] DiningSessionStore - generateBookingId produces collision-free IDs in the same millisecond', () => {
  const ids = new Set<number>()
  for (let i = 0; i < 50; i += 1) {
    ids.add(generateBookingId())
  }
  assert.equal(ids.size, 50)
})
