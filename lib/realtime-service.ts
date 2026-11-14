/**
 * Saffron & Cedar Dining Room - Realtime Event Bus & SSE Streaming
 *
 * Provides a pub/sub event bus for live floor updates, reservation lifecycle,
 * VIP guest profile changes, and automated dining room alerts.
 */

export type FloorUnitUpdatedPayload = {
  unitId: string
  status: string
  guest?: string
  pax?: number
  bill?: number
}

export type ReservationCreatedPayload = {
  reservationId: string | number
  customerName: string
  partySize: number
  time: string
  tableId?: string
}

export type ReservationStatusChangedPayload = {
  reservationId: string | number
  status: string
  tableId?: string
}

export type AlertPrepDuePayload = {
  unitId: string
  bookingName: string
  minutesUntilArrival: number
}

export type AlertOverstayPayload = {
  unitId: string
  minutesOverstayed: number
}

export type CustomerUpdatedPayload = {
  customerId: string
  name: string
  visitCount: number
  loyaltyTier?: string
}

export type FloorUnitUpdatedEvent = {
  type: 'floor:unit_updated'
  payload: FloorUnitUpdatedPayload
}

export type ReservationCreatedEvent = {
  type: 'reservation:created'
  payload: ReservationCreatedPayload
}

export type ReservationStatusChangedEvent = {
  type: 'reservation:status_changed'
  payload: ReservationStatusChangedPayload
}

export type AlertPrepDueEvent = {
  type: 'alert:prep_due'
  payload: AlertPrepDuePayload
}

export type AlertOverstayEvent = {
  type: 'alert:overstay'
  payload: AlertOverstayPayload
}

export type CustomerUpdatedEvent = {
  type: 'customer:updated'
  payload: CustomerUpdatedPayload
}

export type DiningEvent =
  | FloorUnitUpdatedEvent
  | ReservationCreatedEvent
  | ReservationStatusChangedEvent
  | AlertPrepDueEvent
  | AlertOverstayEvent
  | CustomerUpdatedEvent

export type DiningEventType = DiningEvent['type']

export type UpcomingBookingLike = {
  id?: string | number
  reservationId?: string | number
  name?: string
  customerName?: string
  bookingName?: string
  unit?: string
  unitId?: string
  tableId?: string
  time: string | Date
  arrived?: boolean
  status?: string
  pax?: number
  partySize?: number
  [key: string]: unknown
}

export type SseStreamOptions = {
  signal?: AbortSignal
  heartbeatIntervalMs?: number
  initialEvents?: DiningEvent[]
}

export const MIN_SSE_HEARTBEAT_MS = 5000
export const DEFAULT_SSE_HEARTBEAT_MS = 20000
export const MAX_SSE_HEARTBEAT_MS = 60000

/**
 * Parses and clamps a requested SSE heartbeat interval (in ms) to a safe range
 * [MIN_SSE_HEARTBEAT_MS, MAX_SSE_HEARTBEAT_MS] to prevent timer DoS.
 */
export function clampHeartbeatInterval(
  rawHeartbeat: string | number | null | undefined,
  defaultMs: number = DEFAULT_SSE_HEARTBEAT_MS
): number {
  if (rawHeartbeat === null || rawHeartbeat === undefined || rawHeartbeat === '') {
    return defaultMs
  }
  const parsed = typeof rawHeartbeat === 'number' ? rawHeartbeat : Number(rawHeartbeat)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultMs
  }
  return Math.min(MAX_SSE_HEARTBEAT_MS, Math.max(MIN_SSE_HEARTBEAT_MS, Math.floor(parsed)))
}

/**
 * Formats a DiningEvent as an SSE event packet.
 */
export function formatSseEvent(event: DiningEvent): string {
  const data = JSON.stringify(event.payload)
  return `event: ${event.type}\ndata: ${data}\n\n`
}

/**
 * Formats an SSE keepalive comment line.
 */
export function formatHeartbeat(): string {
  return ': keepalive\n\n'
}

/**
 * Calculates minutes until a booking arrival time from a reference time.
 */
export function calculateMinutesUntil(
  bookingTime: string | Date,
  currentTime: Date | string | number = new Date()
): number {
  if (bookingTime instanceof Date) {
    const curMs =
      currentTime instanceof Date
        ? currentTime.getTime()
        : typeof currentTime === 'number'
          ? currentTime
          : new Date(currentTime).getTime()
    return Math.round((bookingTime.getTime() - curMs) / 60000)
  }

  if (typeof bookingTime === 'string' && (bookingTime.includes('T') || bookingTime.includes('-'))) {
    const bDate = new Date(bookingTime)
    if (!isNaN(bDate.getTime())) {
      const curMs =
        currentTime instanceof Date
          ? currentTime.getTime()
          : typeof currentTime === 'number'
            ? currentTime
            : new Date(currentTime).getTime()
      return Math.round((bDate.getTime() - curMs) / 60000)
    }
  }

  // Parse "HH:MM"
  const [bh, bm] = bookingTime.split(':').map(Number)
  const targetMinutes = bh * 60 + bm

  let currentMinutes: number
  if (currentTime instanceof Date) {
    currentMinutes =
      currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60
  } else if (typeof currentTime === 'number') {
    if (currentTime > 1_000_000_000) {
      const d = new Date(currentTime)
      currentMinutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
    } else {
      currentMinutes = currentTime
    }
  } else if (typeof currentTime === 'string') {
    if (currentTime.includes('T') || currentTime.includes('-')) {
      const d = new Date(currentTime)
      currentMinutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
    } else {
      const [ch, cm] = currentTime.split(':').map(Number)
      currentMinutes = ch * 60 + (cm || 0)
    }
  } else {
    currentMinutes = 0
  }

  return Math.round((targetMinutes - currentMinutes + 1440) % 1440)
}

/**
 * Standalone prep alert evaluator.
 */
export function evaluatePrepAlerts(
  upcomingBookings: Iterable<UpcomingBookingLike>,
  currentTime: Date | string | number = new Date(),
  bus?: RealtimeEventBus
): AlertPrepDueEvent[] {
  const targetBus = bus ?? realtimeEventBus
  return targetBus.evaluatePrepAlerts(upcomingBookings, currentTime)
}

/**
 * Deep, resilient Pub/Sub event bus for live dining room updates and SSE streams.
 */
export class RealtimeEventBus {
  private globalListeners = new Set<(event: DiningEvent) => void>()
  private typedListeners = new Map<DiningEventType, Set<(event: any) => void>>()

  /**
   * Subscribes to all dining events.
   * Returns an unsubscribe cleanup callback.
   */
  subscribe(listener: (event: DiningEvent) => void): () => void {
    this.globalListeners.add(listener)
    let removed = false

    return () => {
      if (removed) return
      removed = true
      this.globalListeners.delete(listener)
    }
  }

  /**
   * Subscribes to a specific dining event type.
   */
  subscribeTo<T extends DiningEventType>(
    type: T,
    listener: (event: Extract<DiningEvent, { type: T }>) => void
  ): () => void {
    let set = this.typedListeners.get(type)
    if (!set) {
      set = new Set()
      this.typedListeners.set(type, set)
    }
    set.add(listener)
    let removed = false

    return () => {
      if (removed) return
      removed = true
      set?.delete(listener)
      if (set && set.size === 0) {
        this.typedListeners.delete(type)
      }
    }
  }

  /**
   * Broadcasts an event to all registered listeners and SSE streams.
   */
  broadcast(event: DiningEvent): void {
    for (const listener of this.globalListeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('Error in realtime event listener:', err)
      }
    }

    const typeSet = this.typedListeners.get(event.type)
    if (typeSet && typeSet.size > 0) {
      for (const listener of typeSet) {
        try {
          listener(event)
        } catch (err) {
          console.error(`Error in typed realtime listener for ${event.type}:`, err)
        }
      }
    }
  }

  /**
   * Evaluates upcoming bookings and broadcasts `alert:prep_due` when 15-30 minutes away.
   */
  evaluatePrepAlerts(
    upcomingBookings: Iterable<UpcomingBookingLike>,
    currentTime: Date | string | number = new Date()
  ): AlertPrepDueEvent[] {
    const alerts: AlertPrepDueEvent[] = []

    for (const booking of upcomingBookings) {
      if (!booking) continue
      if (booking.arrived) continue
      if (
        booking.status === 'arrived' ||
        booking.status === 'seated' ||
        booking.status === 'cancelled' ||
        booking.status === 'completed'
      ) {
        continue
      }

      if (!booking.time) continue

      const minutesUntilArrival = calculateMinutesUntil(booking.time, currentTime)
      if (minutesUntilArrival >= 15 && minutesUntilArrival <= 30) {
        const unitId = String(booking.unitId ?? booking.unit ?? booking.tableId ?? '')
        const bookingName = String(
          booking.bookingName ?? booking.customerName ?? booking.name ?? 'Guest'
        )

        const event: AlertPrepDueEvent = {
          type: 'alert:prep_due',
          payload: {
            unitId,
            bookingName,
            minutesUntilArrival,
          },
        }

        this.broadcast(event)
        alerts.push(event)
      }
    }

    return alerts
  }

  /**
   * Evaluates seated units and emits `alert:overstay` if exceeding max dining duration.
   */
  evaluateOverstayAlerts(
    occupiedUnits: Iterable<{
      unitId: string
      seatedAt?: string | Date
      seatedMinutes?: number
    }>,
    maxDiningMinutes = 90
  ): AlertOverstayEvent[] {
    const alerts: AlertOverstayEvent[] = []

    for (const item of occupiedUnits) {
      let overstayed: number | null = null

      if (typeof item.seatedMinutes === 'number') {
        if (item.seatedMinutes > maxDiningMinutes) {
          overstayed = item.seatedMinutes - maxDiningMinutes
        }
      } else if (item.seatedAt) {
        const seatedDate = item.seatedAt instanceof Date ? item.seatedAt : new Date(item.seatedAt)
        if (!isNaN(seatedDate.getTime())) {
          const diffMinutes = Math.floor((Date.now() - seatedDate.getTime()) / 60000)
          if (diffMinutes > maxDiningMinutes) {
            overstayed = diffMinutes - maxDiningMinutes
          }
        }
      }

      if (overstayed !== null && overstayed > 0) {
        const event: AlertOverstayEvent = {
          type: 'alert:overstay',
          payload: {
            unitId: item.unitId,
            minutesOverstayed: overstayed,
          },
        }
        this.broadcast(event)
        alerts.push(event)
      }
    }

    return alerts
  }

  /**
   * Creates a ReadableStream suitable for HTTP Server-Sent Events (SSE).
   * Automatically cleans up subscription and heartbeat timers on disconnect.
   */
  createSseStream(options: SseStreamOptions = {}): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let unsubscribe: (() => void) | null = null
    let isTerminated = false

    const cleanup = () => {
      if (isTerminated) return
      isTerminated = true

      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }

      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
    }

    const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 20000

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        // Initial comment line to establish connection immediately
        try {
          controller.enqueue(encoder.encode(': connected\n\n'))
        } catch {
          cleanup()
          return
        }

        if (options.initialEvents && options.initialEvents.length > 0) {
          for (const ev of options.initialEvents) {
            try {
              controller.enqueue(encoder.encode(formatSseEvent(ev)))
            } catch {
              cleanup()
              return
            }
          }
        }

        // Subscribe to live bus events
        unsubscribe = this.subscribe((event) => {
          if (isTerminated) return
          try {
            controller.enqueue(encoder.encode(formatSseEvent(event)))
          } catch {
            cleanup()
            try {
              controller.close()
            } catch {}
          }
        })

        // Start heartbeat tick interval
        if (heartbeatIntervalMs > 0) {
          heartbeatTimer = setInterval(() => {
            if (isTerminated) {
              if (heartbeatTimer) clearInterval(heartbeatTimer)
              return
            }
            try {
              controller.enqueue(encoder.encode(formatHeartbeat()))
            } catch {
              cleanup()
              try {
                controller.close()
              } catch {}
            }
          }, heartbeatIntervalMs)
        }

        // Handle abort signal from incoming HTTP request
        if (options.signal) {
          if (options.signal.aborted) {
            cleanup()
            try {
              controller.close()
            } catch {}
          } else {
            options.signal.addEventListener(
              'abort',
              () => {
                cleanup()
                try {
                  controller.close()
                } catch {}
              },
              { once: true }
            )
          }
        }
      },
      cancel: () => {
        cleanup()
      },
    })

    return stream
  }

  /**
   * Alias for createSseStream.
   */
  subscribeStream(options: SseStreamOptions = {}): ReadableStream<Uint8Array> {
    return this.createSseStream(options)
  }

  /**
   * Returns current active subscriber count across global and typed listeners.
   */
  getSubscriberCount(): number {
    let count = this.globalListeners.size
    for (const set of this.typedListeners.values()) {
      count += set.size
    }
    return count
  }

  /**
   * Clears all subscribers (useful for test isolation).
   */
  clearSubscribers(): void {
    this.globalListeners.clear()
    this.typedListeners.clear()
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __realtimeEventBus: RealtimeEventBus | undefined
}

export const realtimeEventBus: RealtimeEventBus =
  globalThis.__realtimeEventBus ?? (globalThis.__realtimeEventBus = new RealtimeEventBus())
