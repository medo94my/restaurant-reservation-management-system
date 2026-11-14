import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiningStore } from './dining-store.ts'
import type { CustomerProfile, RestaurantConfig, TableUnit } from './restaurant-config.ts'

test('Zustand DiningStore - initial state has floor items, starter bookings, and zero initial revenue', () => {
  const store = createDiningStore()
  const state = store.getState()

  assert.ok(state.units.length > 0)
  assert.ok(state.bookings.length >= 2)
  assert.equal(state.revenue, 0)
  assert.equal(state.isDirty, false)
  assert.equal(state.syncStatus, 'saved')
})

test('Zustand DiningStore - bookTable updates unit to prep and creates/updates customer record', () => {
  const store = createDiningStore()
  const booking = store.getState().bookTable({
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

  const state = store.getState()
  assert.ok(state.bookings.some((b) => b.id === booking.id))

  const assigned = state.units.find((u) => u.id === booking.unit)
  assert.ok(assigned)
  assert.equal(assigned.status, 'prep')
  assert.equal(assigned.guest, 'Sami Zayn')

  const customer = state.findCustomer('96170999888')
  assert.ok(customer)
  assert.equal(customer.name, 'Sami Zayn')
  assert.ok(customer.occasionTags.includes('vip'))
})

test('Zustand DiningStore - completeSeating clears unit, updates revenue, and increments guest visits', () => {
  const store = createDiningStore()

  const targetUnit = store.getState().units.find(
    (u) => u.kind === 'Table' && u.status === 'available'
  ) as TableUnit
  assert.ok(targetUnit)

  const booking = store.getState().bookTable({
    name: 'Leila Farah',
    phone: '96131234567',
    pax: 2,
    kind: 'Table',
    tableType: 'any',
    time: '20:00',
    unitId: targetUnit.id,
  })
  assert.ok(booking)

  const initialVisits = store.getState().findCustomer('96131234567')?.visits ?? 0

  store.getState().completeSeating(targetUnit.id, 120)

  const updatedUnit = store.getState().units.find((u) => u.id === targetUnit.id)
  assert.ok(updatedUnit)
  assert.equal(updatedUnit.status, 'available')
  assert.equal(updatedUnit.guest, undefined)

  assert.equal(store.getState().revenue, 120)

  const updatedCustomer = store.getState().findCustomer('96131234567')
  assert.ok(updatedCustomer)
  assert.equal(updatedCustomer.visits, initialVisits + 1)
})

test('Zustand DiningStore - tick updates clock and recalculates due bookings', () => {
  const baseTime = new Date('2026-11-12T19:00:00')
  const store = createDiningStore(baseTime)

  store.getState().bookTable({
    name: 'Timer Test Guest',
    phone: '96170111222',
    pax: 2,
    kind: 'Table',
    tableType: 'any',
    time: '19:25', // 25 mins from 19:00 -> due!
  })

  // At 19:00, 19:25 booking is 25 mins away -> due
  store.getState().tick(new Date('2026-11-12T19:00:00'))
  assert.ok(store.getState().dueBookings.some((b) => b.name === 'Timer Test Guest'))

  // Advance time to 19:15 (10 mins away, less than 15) -> no longer in 15-30 alert window
  store.getState().tick(new Date('2026-11-12T19:15:00'))
  assert.ok(!store.getState().dueBookings.some((b) => b.name === 'Timer Test Guest'))
})

test('Zustand DiningStore - updateBooking edits existing booking in prep and updates unit & customer', () => {
  const store = createDiningStore()
  const targetUnit = store.getState().units.find((u) => u.status === 'available')!
  assert.ok(targetUnit)

  const booking = store.getState().bookTable({
    name: 'Rami Malek',
    phone: '96170123987',
    pax: 2,
    kind: 'Table',
    tableType: 'any',
    time: '21:00',
    unitId: targetUnit.id,
    note: 'Initial note',
    occasionTags: ['vip'],
  })!
  assert.ok(booking)

  // Verify initial prep status
  let unit = store.getState().units.find((u) => u.id === targetUnit.id)!
  assert.equal(unit.status, 'prep')
  assert.equal(unit.pax, 2)
  assert.equal(unit.note, 'Initial note')

  // Now update the booking while in prep
  const updated = store.getState().updateBooking(booking.id, {
    pax: 4,
    note: 'Upgraded to 4 guests · champagne requested',
    customOccasion: 'Emmy Celebration',
    occasionTags: ['vip', 'other'],
  })
  assert.ok(updated)
  assert.equal(updated.pax, 4)
  assert.equal(updated.customOccasion, 'Emmy Celebration')

  // Unit must reflect the updated booking
  unit = store.getState().units.find((u) => u.id === targetUnit.id)!
  assert.equal(unit.pax, 4)
  assert.equal(unit.note, 'Upgraded to 4 guests · champagne requested')

  // Seat the prep unit directly
  store.getState().seatPrepUnit(targetUnit.id)
  unit = store.getState().units.find((u) => u.id === targetUnit.id)!
  assert.equal(unit.status, 'seated')

  // Release table test
  store.getState().releaseTable(targetUnit.id)
  unit = store.getState().units.find((u) => u.id === targetUnit.id)!
  assert.equal(unit.status, 'available')
  assert.equal(unit.guest, undefined)
})

test('[F8-3] Zustand DiningStore - completeSeating accumulates shift revenue across multiple turns and updates CRM spend', () => {
  const store = createDiningStore()
  const targetUnit = store
    .getState()
    .units.find((u) => u.kind === 'Table' && u.status === 'available' && u.capacity >= 4) as TableUnit
  assert.ok(targetUnit)

  // Turn 1: Leila Farah spends $95.25
  const b1 = store.getState().bookTable({
    name: 'Leila Farah',
    phone: '96131234567',
    pax: 2,
    kind: 'Table',
    tableType: 'any',
    time: '19:00',
    unitId: targetUnit.id,
  })
  assert.ok(b1)
  store.getState().seatPrepUnit(targetUnit.id)
  store.getState().completeSeating(targetUnit.id, 95.25)

  assert.equal(store.getState().units.find((u) => u.id === targetUnit.id)?.bill, 95.25)
  assert.equal(store.getState().revenue, 95.25)
  const leila = store.getState().findCustomer('96131234567') as CustomerProfile & {
    totalSpend?: number
  }
  assert.equal(leila?.visits, 5)
  assert.equal(leila?.totalSpend, 95.25)

  // Turn 2 on the same unit: Karim Haddad spends $164.75
  const b2 = store.getState().bookTable({
    name: 'Karim Haddad',
    phone: '96171111111',
    pax: 4,
    kind: 'Table',
    tableType: 'any',
    time: '21:00',
    unitId: targetUnit.id,
  })
  assert.ok(b2)
  store.getState().seatPrepUnit(targetUnit.id)
  store.getState().completeSeating(targetUnit.id, 164.75)

  assert.equal(store.getState().units.find((u) => u.id === targetUnit.id)?.bill, 260)
  assert.equal(store.getState().revenue, 260)
  assert.equal(store.getState().findCustomer('96131234567')?.visits, 5)
  const karim = store.getState().findCustomer('96171111111') as CustomerProfile & {
    totalSpend?: number
  }
  assert.equal(karim?.visits, 9)
  assert.equal(karim?.totalSpend, 164.75)
})

test('[F8-2] Zustand DiningStore - applyRemoteUnitUpdate and applyRemoteReservationCreated avoid SSE-to-PUT sync loop and preserve bill', async () => {
  const store = createDiningStore(new Date(), 5)
  let syncCalls = 0
  store.getState().setSyncAdapter(async () => {
    syncCalls += 1
  })

  store.getState().applyRemoteUnitUpdate('Table 2', {
    status: 'occupied',
    guest: 'SSE Party',
    pax: 4,
    bill: 310,
  })

  let state = store.getState()
  const u2 = state.units.find((u) => u.id === 'Table 2')
  assert.equal(u2?.status, 'seated')
  assert.equal(u2?.guest, 'SSE Party')
  assert.equal(u2?.bill, 310)
  assert.equal(state.revenue, 310)
  assert.equal(state.isDirty, false)

  // Remote update omitting bill preserves existing bill
  store.getState().applyRemoteUnitUpdate('Table 2', {
    status: 'available',
    guest: undefined,
    pax: undefined,
  })
  assert.equal(store.getState().units.find((u) => u.id === 'Table 2')?.bill, 310)
  assert.equal(store.getState().isDirty, false)

  // Remote reservation creation updates bookings without marking dirty
  const beforeCount = store.getState().bookings.length
  const remoteBooking = store.getState().applyRemoteReservationCreated({
    reservationId: 7777,
    customerName: 'Nadine Labaki',
    partySize: 2,
    time: '20:45',
    tableId: 'Table 3',
  })
  assert.ok(remoteBooking)
  assert.equal(store.getState().bookings.length, beforeCount + 1)
  assert.equal(store.getState().isDirty, false)

  await store.getState().flushSync()
  assert.equal(syncCalls, 0)
})

test('[F8-4] Zustand DiningStore - mergeUnits sums combinedCapacity and reassigns bookings on merged units', () => {
  const store = createDiningStore()
  const u2 = store.getState().units.find((u) => u.id === 'Table 2')!
  const u3 = store.getState().units.find((u) => u.id === 'Table 3')!
  assert.ok(u2 && u3)

  const booking = store.getState().bookTable({
    name: 'Combined Table Guest',
    phone: '96170888999',
    pax: u2.capacity,
    kind: 'Table',
    tableType: 'any',
    time: '20:30',
    unitId: 'Table 2',
  })
  assert.ok(booking)

  const merged = store.getState().mergeUnits(['Table 2', 'Table 3'])
  assert.ok(merged)
  assert.equal(merged.id, 'Merge (Table 2+Table 3)')
  assert.equal(merged.capacity, u2.capacity + u3.capacity)

  const state = store.getState()
  assert.equal(
    state.bookings.find((b) => b.id === booking.id)?.unit,
    'Merge (Table 2+Table 3)'
  )
  assert.equal(state.units.find((u) => u.id === 'Table 2')?.archived, true)
  assert.equal(state.units.find((u) => u.id === 'Table 3')?.archived, true)
})

test('[F8-5] Zustand DiningStore - isolated sync state per store instance and collision-free booking IDs', async () => {
  const storeA = createDiningStore(new Date(), 5)
  const storeB = createDiningStore(new Date(), 5)

  const payloadsA: RestaurantConfig[] = []
  const payloadsB: RestaurantConfig[] = []

  storeA.getState().setSyncAdapter(async (payload) => {
    payloadsA.push(payload)
  })
  storeB.getState().setSyncAdapter(async (payload) => {
    payloadsB.push(payload)
  })

  // Mutate only storeA and flush
  storeA.getState().updateUnit('Table 2', { status: 'blocked' })
  assert.equal(storeA.getState().isDirty, true)
  assert.equal(storeB.getState().isDirty, false)

  await storeA.getState().flushSync()
  assert.equal(payloadsA.length, 1)
  assert.equal(payloadsB.length, 0)
  assert.equal(storeA.getState().syncStatus, 'saved')

  // Rapid same-millisecond bookings on storeB must have distinct IDs
  const b1 = storeB.getState().bookTable({
    name: 'Guest Alpha',
    phone: '96170111222',
    pax: 2,
    kind: 'Table',
    tableType: 'any',
    time: '19:00',
  })
  const b2 = storeB.getState().bookTable({
    name: 'Guest Beta',
    phone: '96170333444',
    pax: 2,
    kind: 'Table',
    tableType: 'any',
    time: '19:30',
  })
  assert.ok(b1 && b2)
  assert.notEqual(b1.id, b2.id)
})

