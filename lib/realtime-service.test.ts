import assert from 'node:assert/strict'
import test from 'node:test'
import { auth } from './auth/auth.ts'
import {
  DEFAULT_SSE_HEARTBEAT_MS,
  MAX_SSE_HEARTBEAT_MS,
  MIN_SSE_HEARTBEAT_MS,
  RealtimeEventBus,
  calculateMinutesUntil,
  clampHeartbeatInterval,
  evaluatePrepAlerts,
  formatHeartbeat,
  formatSseEvent,
  realtimeEventBus,
  type DiningEvent,
  type UpcomingBookingLike,
} from './realtime-service.ts'
import { GET as streamRouteGet } from '../app/api/live-floor/stream/route.ts'

test('RealtimeEventBus - general subscription and broadcast', () => {
  const bus = new RealtimeEventBus()
  const received: DiningEvent[] = []

  const unsubscribe = bus.subscribe((event) => {
    received.push(event)
  })

  assert.equal(bus.getSubscriberCount(), 1)

  const event1: DiningEvent = {
    type: 'floor:unit_updated',
    payload: {
      unitId: 'table-3',
      status: 'seated',
      guest: 'Sami Mansour',
      pax: 4,
      bill: 120,
    },
  }

  bus.broadcast(event1)
  assert.equal(received.length, 1)
  assert.deepEqual(received[0], event1)

  unsubscribe()
  assert.equal(bus.getSubscriberCount(), 0)

  bus.broadcast(event1)
  assert.equal(received.length, 1) // No new events received after unsubscribe
})

test('RealtimeEventBus - typed subscription receives only matching event types', () => {
  const bus = new RealtimeEventBus()
  const reservationEvents: any[] = []
  const floorEvents: any[] = []

  const unsubRes = bus.subscribeTo('reservation:created', (ev) => {
    reservationEvents.push(ev)
  })

  const unsubFloor = bus.subscribeTo('floor:unit_updated', (ev) => {
    floorEvents.push(ev)
  })

  assert.equal(bus.getSubscriberCount(), 2)

  bus.broadcast({
    type: 'reservation:created',
    payload: {
      reservationId: 101,
      customerName: 'Maya Chedid',
      partySize: 2,
      time: '19:30',
      tableId: 'table-1',
    },
  })

  bus.broadcast({
    type: 'floor:unit_updated',
    payload: {
      unitId: 'table-2',
      status: 'available',
    },
  })

  assert.equal(reservationEvents.length, 1)
  assert.equal(reservationEvents[0].payload.customerName, 'Maya Chedid')
  assert.equal(floorEvents.length, 1)
  assert.equal(floorEvents[0].payload.unitId, 'table-2')

  unsubRes()
  assert.equal(bus.getSubscriberCount(), 1)
  unsubFloor()
  assert.equal(bus.getSubscriberCount(), 0)
})

test('RealtimeEventBus - broadcasts all 6 required event types with accurate payloads', () => {
  const bus = new RealtimeEventBus()
  const history: DiningEvent[] = []

  bus.subscribe((event) => {
    history.push(event)
  })

  const e1: DiningEvent = {
    type: 'floor:unit_updated',
    payload: { unitId: 'table-5', status: 'prep', pax: 6, bill: 240 },
  }
  const e2: DiningEvent = {
    type: 'reservation:created',
    payload: {
      reservationId: 'res-42',
      customerName: 'Ziad Rahbani',
      partySize: 6,
      time: '20:00',
      tableId: 'table-5',
    },
  }
  const e3: DiningEvent = {
    type: 'reservation:status_changed',
    payload: { reservationId: 'res-42', status: 'seated', tableId: 'table-5' },
  }
  const e4: DiningEvent = {
    type: 'alert:prep_due',
    payload: { unitId: 'table-5', bookingName: 'Ziad Rahbani', minutesUntilArrival: 20 },
  }
  const e5: DiningEvent = {
    type: 'alert:overstay',
    payload: { unitId: 'table-2', minutesOverstayed: 15 },
  }
  const e6: DiningEvent = {
    type: 'customer:updated',
    payload: { customerId: 'c-99', name: 'Laila Kassir', visitCount: 12, loyaltyTier: 'Platinum' },
  }

  bus.broadcast(e1)
  bus.broadcast(e2)
  bus.broadcast(e3)
  bus.broadcast(e4)
  bus.broadcast(e5)
  bus.broadcast(e6)

  assert.equal(history.length, 6)
  assert.deepEqual(history[0], e1)
  assert.deepEqual(history[1], e2)
  assert.deepEqual(history[2], e3)
  assert.deepEqual(history[3], e4)
  assert.deepEqual(history[4], e5)
  assert.deepEqual(history[5], e6)
})

test('RealtimeEventBus - error isolation in listener callbacks', () => {
  const bus = new RealtimeEventBus()
  let secondReceived = false

  bus.subscribe(() => {
    throw new Error('Listener exploded intentionally')
  })

  bus.subscribe(() => {
    secondReceived = true
  })

  bus.broadcast({
    type: 'alert:overstay',
    payload: { unitId: 'table-1', minutesOverstayed: 10 },
  })

  assert.equal(secondReceived, true)
})

test('RealtimeEventBus - createSseStream cleans up listener on reader.cancel()', async () => {
  const bus = new RealtimeEventBus()
  assert.equal(bus.getSubscriberCount(), 0)

  const stream = bus.createSseStream({ heartbeatIntervalMs: 50 })
  assert.equal(bus.getSubscriberCount(), 1)

  const reader = stream.getReader()
  const firstChunk = await reader.read()
  assert.equal(firstChunk.done, false)
  const text = new TextDecoder().decode(firstChunk.value)
  assert.equal(text, ': connected\n\n')

  await reader.cancel()
  assert.equal(bus.getSubscriberCount(), 0)
})

test('RealtimeEventBus - createSseStream cleans up listener on AbortSignal abort', async () => {
  const bus = new RealtimeEventBus()
  const ac = new AbortController()

  const stream = bus.createSseStream({ signal: ac.signal, heartbeatIntervalMs: 50 })
  assert.equal(bus.getSubscriberCount(), 1)

  ac.abort()
  // Allow event loop to process abort event
  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(bus.getSubscriberCount(), 0)
})

test('RealtimeEventBus - SSE stream receives broadcasted events and format is valid', async () => {
  const bus = new RealtimeEventBus()
  const stream = bus.createSseStream({ heartbeatIntervalMs: 1000 })
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  // First chunk is connection comment
  const init = await reader.read()
  assert.equal(decoder.decode(init.value), ': connected\n\n')

  bus.broadcast({
    type: 'floor:unit_updated',
    payload: {
      unitId: 'table-7',
      status: 'available',
    },
  })

  const eventChunk = await reader.read()
  const eventStr = decoder.decode(eventChunk.value)
  assert.equal(eventStr, 'event: floor:unit_updated\ndata: {"unitId":"table-7","status":"available"}\n\n')

  await reader.cancel()
})

test('RealtimeEventBus - SSE format helper functions', () => {
  const event: DiningEvent = {
    type: 'alert:prep_due',
    payload: { unitId: 'table-4', bookingName: 'Layla', minutesUntilArrival: 25 },
  }
  const formatted = formatSseEvent(event)
  assert.equal(
    formatted,
    'event: alert:prep_due\ndata: {"unitId":"table-4","bookingName":"Layla","minutesUntilArrival":25}\n\n'
  )

  const hb = formatHeartbeat()
  assert.equal(hb, ': keepalive\n\n')
})

test('RealtimeEventBus - calculateMinutesUntil handles string and date formats', () => {
  // HH:MM string format
  assert.equal(calculateMinutesUntil('19:30', '19:10'), 20)
  assert.equal(calculateMinutesUntil('19:15', '19:00'), 15)
  assert.equal(calculateMinutesUntil('00:15', '23:55'), 20) // midnight wrap

  // Date format
  const now = new Date('2026-11-12T18:00:00Z')
  const arrival = new Date('2026-11-12T18:25:00Z')
  assert.equal(calculateMinutesUntil(arrival, now), 25)
})

test('RealtimeEventBus - evaluatePrepAlerts emits alert:prep_due when arrival is 15-30 minutes away', () => {
  const bus = new RealtimeEventBus()
  const emittedEvents: DiningEvent[] = []

  bus.subscribe((event) => {
    emittedEvents.push(event)
  })

  const currentTime = '19:00'
  const bookings: UpcomingBookingLike[] = [
    {
      id: 1,
      name: 'Too Early',
      unit: 'table-1',
      time: '19:45', // 45 mins away (>30)
    },
    {
      id: 2,
      name: 'Valid Prep 1',
      unit: 'table-2',
      time: '19:20', // 20 mins away (15-30)
    },
    {
      id: 3,
      name: 'Valid Prep 2',
      unitId: 'table-3',
      time: '19:30', // 30 mins away (15-30 boundary)
    },
    {
      id: 4,
      name: 'Valid Prep 3',
      tableId: 'table-4',
      time: '19:15', // 15 mins away (15-30 boundary)
    },
    {
      id: 5,
      name: 'Too Late',
      unit: 'table-5',
      time: '19:10', // 10 mins away (<15)
    },
    {
      id: 6,
      name: 'Already Arrived',
      unit: 'table-6',
      time: '19:20',
      arrived: true, // Should be ignored
    },
    {
      id: 7,
      name: 'Cancelled Booking',
      unit: 'table-7',
      time: '19:20',
      status: 'cancelled', // Should be ignored
    },
  ]

  const returnedAlerts = bus.evaluatePrepAlerts(bookings, currentTime)

  assert.equal(returnedAlerts.length, 3)
  assert.equal(emittedEvents.length, 3)

  assert.deepEqual(returnedAlerts[0], {
    type: 'alert:prep_due',
    payload: {
      unitId: 'table-2',
      bookingName: 'Valid Prep 1',
      minutesUntilArrival: 20,
    },
  })

  assert.deepEqual(returnedAlerts[1], {
    type: 'alert:prep_due',
    payload: {
      unitId: 'table-3',
      bookingName: 'Valid Prep 2',
      minutesUntilArrival: 30,
    },
  })

  assert.deepEqual(returnedAlerts[2], {
    type: 'alert:prep_due',
    payload: {
      unitId: 'table-4',
      bookingName: 'Valid Prep 3',
      minutesUntilArrival: 15,
    },
  })
})

test('RealtimeEventBus - standalone evaluatePrepAlerts delegates to bus', () => {
  const bus = new RealtimeEventBus()
  const alerts = evaluatePrepAlerts(
    [{ name: 'Karim', unit: 'table-10', time: '20:20' }],
    '20:00',
    bus
  )
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].payload.bookingName, 'Karim')
  assert.equal(alerts[0].payload.minutesUntilArrival, 20)
})

test('RealtimeEventBus - evaluateOverstayAlerts emits alert:overstay for seated units', () => {
  const bus = new RealtimeEventBus()
  const alerts: DiningEvent[] = []

  bus.subscribe((e) => alerts.push(e))

  const occupied = [
    { unitId: 'table-1', seatedMinutes: 80 }, // Within 90m limit
    { unitId: 'table-2', seatedMinutes: 115 }, // 25 mins overstayed
  ]

  const generated = bus.evaluateOverstayAlerts(occupied, 90)
  assert.equal(generated.length, 1)
  assert.deepEqual(generated[0], {
    type: 'alert:overstay',
    payload: {
      unitId: 'table-2',
      minutesOverstayed: 25,
    },
  })
  assert.equal(alerts.length, 1)
})

test('[F8-1] clampHeartbeatInterval enforces >= 5000ms minimum and safe bounds', () => {
  assert.equal(MIN_SSE_HEARTBEAT_MS, 5000)
  assert.equal(DEFAULT_SSE_HEARTBEAT_MS, 20000)
  assert.equal(MAX_SSE_HEARTBEAT_MS, 60000)

  // Missing or invalid defaults to 20000ms
  assert.equal(clampHeartbeatInterval(null), 20000)
  assert.equal(clampHeartbeatInterval(undefined), 20000)
  assert.equal(clampHeartbeatInterval(''), 20000)
  assert.equal(clampHeartbeatInterval('invalid'), 20000)
  assert.equal(clampHeartbeatInterval('-50'), 20000)
  assert.equal(clampHeartbeatInterval('0'), 20000)

  // Sub-5000ms values (DoS risk like ?heartbeat=10 or ?heartbeat=30) are clamped to 5000ms
  assert.equal(clampHeartbeatInterval('10'), 5000)
  assert.equal(clampHeartbeatInterval('30'), 5000)
  assert.equal(clampHeartbeatInterval('4999'), 5000)

  // Valid in-range values are preserved
  assert.equal(clampHeartbeatInterval('5000'), 5000)
  assert.equal(clampHeartbeatInterval('15000'), 15000)
  assert.equal(clampHeartbeatInterval(25000), 25000)

  // Excessive values are capped at 60000ms
  assert.equal(clampHeartbeatInterval('120000'), 60000)
})

test('[F8-1] API route - GET /api/live-floor/stream returns 401 when unauthenticated or inactive', async (t) => {
  // 1. Unauthenticated request -> 401
  t.mock.method(auth.api, 'getSession', async () => null)
  const unauthReq = new Request('http://localhost/api/live-floor/stream')
  const unauthRes = await streamRouteGet(unauthReq)
  assert.equal(unauthRes.status, 401)

  // 2. Inactive staff user -> 401
  t.mock.method(auth.api, 'getSession', async () => ({
    session: { id: 'sess-inactive', userId: 'u-inactive', expiresAt: new Date(Date.now() + 60000) },
    user: { id: 'u-inactive', name: 'Inactive Host', role: 'host', staffId: 'HOST-99', isActive: false },
  }))
  const inactiveReq = new Request('http://localhost/api/live-floor/stream')
  const inactiveRes = await streamRouteGet(inactiveReq)
  assert.equal(inactiveRes.status, 401)
})

test('API route - GET /api/live-floor/stream sets SSE headers and streams events when authenticated', async (t) => {
  t.mock.method(auth.api, 'getSession', async () => ({
    session: { id: 'sess-active', userId: 'u-active', expiresAt: new Date(Date.now() + 60000) },
    user: { id: 'u-active', name: 'Active Hostess', role: 'host', staffId: 'HOST-01', isActive: true },
  }))

  const ac = new AbortController()
  const req = new Request('http://localhost/api/live-floor/stream?heartbeat=10', {
    signal: ac.signal,
  })

  const initialCount = realtimeEventBus.getSubscriberCount()
  const res = await streamRouteGet(req)

  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'text/event-stream')
  assert.equal(res.headers.get('Cache-Control'), 'no-cache, no-transform')
  assert.equal(res.headers.get('Connection'), 'keep-alive')

  assert.equal(realtimeEventBus.getSubscriberCount(), initialCount + 1)

  const reader = res.body?.getReader()
  assert.ok(reader)
  const decoder = new TextDecoder()

  // 1. Initial connection line
  const chunk1 = await reader.read()
  assert.equal(decoder.decode(chunk1.value), ': connected\n\n')

  // 2. Broadcast an event over the singleton bus
  realtimeEventBus.broadcast({
    type: 'reservation:status_changed',
    payload: { reservationId: 'res-88', status: 'arrived', tableId: 'T-9' },
  })

  const chunk2 = await reader.read()
  const text2 = decoder.decode(chunk2.value)
  assert.ok(text2.includes('event: reservation:status_changed'))
  assert.ok(text2.includes('"reservationId":"res-88"'))

  // 3. Cancel reader and verify subscriber count decreases
  await reader.cancel()
  assert.equal(realtimeEventBus.getSubscriberCount(), initialCount)
})
