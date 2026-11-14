import { useSyncExternalStore } from 'react'
import { clampUnitPosition, createFloorUnit } from './floor-layout.ts'
import {
  DEFAULT_CUSTOMERS,
  DEFAULT_FLOOR_ITEMS,
  DEFAULT_OCCASION_TAGS,
  DEFAULT_VISIT_TIERS,
  type Booking,
  type CustomerProfile,
  type OccasionTag,
  type RestaurantConfig,
  type TableShape,
  type TableStatus,
  type Unit,
  type VisitTier,
} from './restaurant-config.ts'

export type WorkspaceSyncAdapter = (payload: RestaurantConfig) => Promise<unknown>

export type NewBookingRequest = {
  name: string
  phone: string
  pax: number
  kind: Unit['kind']
  tableType: TableShape | 'any'
  time: string
  note?: string
  unitId?: string
  occasionTags?: string[]
  customOccasion?: string
}

export type RemoteReservationCreatedInput = {
  reservationId?: string | number
  customerName?: string
  customerPhone?: string
  partySize?: number
  time?: string
  tableId?: string
  notes?: string
}

export type DueBooking = Booking & { mins: number }

export type DiningServiceSnapshot = {
  units: Unit[]
  bookings: Booking[]
  customers: CustomerProfile[]
  visitTiers: VisitTier[]
  occasionTags: OccasionTag[]
  clock: Date
  dueBookings: DueBooking[]
  revenue: number
  covers: number
  syncStatus: 'saved' | 'saving' | 'error'
  isDirty: boolean
}

export type DiningServiceOptions = {
  initialConfig?: Partial<RestaurantConfig>
  initialBookings?: Booking[]
  syncAdapter?: WorkspaceSyncAdapter
  debounceMs?: number
  clock?: () => Date
}

let lastGeneratedBookingId = 0

export function generateBookingId(existingBookings: readonly { id: number }[] = []): number {
  const maxExisting = existingBookings.reduce((max, b) => (b.id > max ? b.id : max), 0)
  const candidate = Math.max(Date.now(), lastGeneratedBookingId + 1, maxExisting + 1)
  lastGeneratedBookingId = candidate
  return candidate
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function normalizeBookingTime(rawTime: string | undefined, fallbackClock: Date): string {
  if (!rawTime) {
    return `${String(fallbackClock.getHours()).padStart(2, '0')}:${String(fallbackClock.getMinutes()).padStart(2, '0')}`
  }
  const trimmed = rawTime.trim()
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map(Number)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
  }
  return trimmed
}

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

function calculateMinutesUntil(time: string, currentMinutes: number): number {
  const [h, m] = time.split(':').map(Number)
  const targetMinutes = h * 60 + m
  return (targetMinutes - currentMinutes + 1440) % 1440
}

export class DiningSessionStore {
  private units: Unit[]
  private bookings: Booking[]
  private customers: CustomerProfile[]
  private visitTiers: VisitTier[]
  private occasionTags: OccasionTag[]
  private clock: Date
  private syncStatus: 'saved' | 'saving' | 'error' = 'saved'
  private isDirty = false

  private readonly syncAdapter?: WorkspaceSyncAdapter
  private readonly debounceMs: number
  private readonly getClock: () => Date

  private listeners = new Set<() => void>()
  private snapshotCache: DiningServiceSnapshot | null = null
  private revision = 0
  private syncQueue = Promise.resolve<unknown>(undefined)
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private completedBookingIds = new Set<number>()

  constructor(options: DiningServiceOptions = {}) {
    this.units = options.initialConfig?.floorItems ? [...options.initialConfig.floorItems] : [...DEFAULT_FLOOR_ITEMS]
    this.customers = options.initialConfig?.customers ? [...options.initialConfig.customers] : [...DEFAULT_CUSTOMERS]
    this.visitTiers = options.initialConfig?.visitTiers ? [...options.initialConfig.visitTiers] : [...DEFAULT_VISIT_TIERS]
    this.occasionTags = options.initialConfig?.occasionTags ? [...options.initialConfig.occasionTags] : [...DEFAULT_OCCASION_TAGS]

    if (options.initialBookings) {
      this.bookings = [...options.initialBookings]
    } else {
      const now = options.clock ? options.clock() : new Date()
      const arrival = new Date(now.getTime() + 20 * 60 * 1000)
      const arrivalTime = `${String(arrival.getHours()).padStart(2, '0')}:${String(arrival.getMinutes()).padStart(2, '0')}`
      this.bookings = [
        {
          id: 1,
          name: 'Nadia Khoury',
          phone: '96170123456',
          pax: 8,
          kind: 'Table',
          tableType: 'any',
          time: arrivalTime,
          note: 'Always requests a quiet table · no coriander',
          unit: 'Table 5',
        },
        {
          id: 2,
          name: 'Karim Haddad',
          phone: '96171111111',
          pax: 4,
          kind: 'Table',
          tableType: 'any',
          time: '21:10',
          note: 'Prefers a central table',
          unit: 'Table 6',
        },
      ]
    }

    this.getClock = options.clock ?? (() => new Date())
    this.clock = this.getClock()
    this.syncAdapter = options.syncAdapter
    this.debounceMs = options.debounceMs ?? 650
  }

  // --- Subscription ---

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): DiningServiceSnapshot => {
    if (this.snapshotCache) return this.snapshotCache

    const currentMinutes = this.clock.getHours() * 60 + this.clock.getMinutes()
    const dueBookings: DueBooking[] = this.bookings
      .map((b) => ({ ...b, mins: calculateMinutesUntil(b.time, currentMinutes) }))
      .filter((b) => b.mins >= 15 && b.mins <= 30 && !b.arrived)

    const revenue = this.units.reduce((sum, unit) => sum + (unit.bill || 0), 0)
    const covers = this.bookings.reduce((sum, b) => sum + b.pax, 0) +
      this.units.filter((u) => u.status === 'seated').reduce((sum, u) => sum + (u.pax || 0), 0)

    this.snapshotCache = {
      units: this.units,
      bookings: this.bookings,
      customers: this.customers,
      visitTiers: this.visitTiers,
      occasionTags: this.occasionTags,
      clock: this.clock,
      dueBookings,
      revenue,
      covers,
      syncStatus: this.syncStatus,
      isDirty: this.isDirty,
    }

    return this.snapshotCache
  }

  private notify() {
    this.snapshotCache = null
    for (const listener of this.listeners) {
      listener()
    }
  }

  // --- Clock & Alerts ---

  setClock(date: Date) {
    this.clock = date
    this.notify()
  }

  tick(date?: Date) {
    this.clock = date ?? this.getClock()
    this.notify()
  }

  // --- Guest Lookup & Loyalty ---

  findCustomer(phone: string): CustomerProfile | undefined {
    const normalized = normalizePhone(phone)
    if (!normalized) return undefined
    return this.customers.find((c) => c.phone === normalized)
  }

  resolveGuestTier(visits: number): VisitTier {
    return [...this.visitTiers]
      .sort((a, b) => b.minVisits - a.minVisits)
      .find((tier) => visits >= tier.minVisits) ?? this.visitTiers[0]
  }

  // --- Booking Operations ---

  bookTable(request: NewBookingRequest): Booking | null {
    const phone = normalizePhone(request.phone)
    const guestName = request.name.trim()
    if (!guestName || phone.length < 7) return null

    const visibleUnits = this.units.filter((u) => !u.archived)

    // Check target unit availability if specified
    const chosenUnit = request.unitId
      ? visibleUnits.find((u) => u.id === request.unitId && u.status === 'available')
      : undefined

    if (request.unitId && (!chosenUnit || request.pax > chosenUnit.capacity)) {
      return null
    }

    // Auto-allocate unit if not specified
    const matchedUnit = chosenUnit ?? visibleUnits.find(
      (u) =>
        u.kind === request.kind &&
        u.status === 'available' &&
        request.pax <= u.capacity &&
        (request.tableType === 'any' || u.kind !== 'Table' || u.tableType === request.tableType)
    )

    const assignedUnitId = matchedUnit?.id ?? `${request.kind} · assign`

    const booking: Booking = {
      id: generateBookingId(this.bookings),
      name: guestName,
      phone,
      pax: request.pax,
      kind: matchedUnit?.kind ?? request.kind,
      tableType: matchedUnit?.kind === 'Table' ? request.tableType : 'any',
      time: request.time,
      note: request.note || '',
      unit: assignedUnitId,
    }

    this.bookings = [...this.bookings, booking].sort((a, b) => a.time.localeCompare(b.time))

    // Update customer CRM record
    const existing = this.findCustomer(phone)
    const requestedTags = request.occasionTags ?? []
    if (existing) {
      const mergedTags = Array.from(new Set([...existing.occasionTags, ...requestedTags]))
      this.customers = this.customers.map((c) =>
        c.phone === phone
          ? { ...c, name: guestName, note: request.note || c.note, occasionTags: mergedTags }
          : c
      )
    } else {
      this.customers = [
        { phone, name: guestName, visits: 0, note: request.note || '', occasionTags: requestedTags },
        ...this.customers,
      ]
    }

    // Update target unit status if assigned
    if (matchedUnit) {
      this.updateUnit(matchedUnit.id, {
        status: 'prep',
        guest: booking.name,
        pax: booking.pax,
        time: formatDisplayTime(booking.time),
        note: booking.note,
      })
    }

    this.markDirty()
    this.notify()
    return booking
  }

  updateBooking(
    bookingId: number,
    patch: Partial<NewBookingRequest> & { customOccasion?: string }
  ): Booking | null {
    const existing = this.bookings.find((b) => b.id === bookingId)
    if (!existing) return null

    const nextName = patch.name !== undefined ? patch.name.trim() : existing.name
    const nextPhone = patch.phone !== undefined ? normalizePhone(patch.phone) : existing.phone
    const nextPax = patch.pax !== undefined ? patch.pax : existing.pax
    const nextTime = patch.time !== undefined ? patch.time : existing.time
    const nextNote = patch.note !== undefined ? patch.note : existing.note
    const nextTags = patch.occasionTags !== undefined ? patch.occasionTags : existing.occasionTags
    const nextCustomOccasion =
      patch.customOccasion !== undefined ? patch.customOccasion : existing.customOccasion

    const updatedBooking: Booking = {
      ...existing,
      name: nextName,
      phone: nextPhone,
      pax: nextPax,
      time: nextTime,
      note: nextNote,
      occasionTags: nextTags,
      customOccasion: nextCustomOccasion,
    }

    this.bookings = this.bookings
      .map((b) => (b.id === bookingId ? updatedBooking : b))
      .sort((a, b) => a.time.localeCompare(b.time))

    // Update unit if assigned
    if (existing.unit) {
      this.updateUnit(existing.unit, {
        guest: updatedBooking.name,
        pax: updatedBooking.pax,
        time: formatDisplayTime(updatedBooking.time),
        note: updatedBooking.note,
      })
    }

    // Update customer CRM profile
    const cust = this.findCustomer(nextPhone)
    if (cust) {
      const mergedTags = nextTags
        ? Array.from(new Set([...cust.occasionTags, ...nextTags]))
        : cust.occasionTags
      this.customers = this.customers.map((c) =>
        c.phone === nextPhone
          ? { ...c, name: nextName, note: nextNote || c.note, occasionTags: mergedTags }
          : c
      )
    }

    this.markDirty()
    this.notify()
    return updatedBooking
  }

  releaseTable(unitId: string) {
    this.updateUnit(unitId, {
      status: 'available',
      guest: undefined,
      pax: undefined,
      time: undefined,
      note: undefined,
    })
    this.bookings = this.bookings.map((b) =>
      b.unit === unitId ? { ...b, unit: `${b.kind} · unassigned` } : b
    )
    this.markDirty()
    this.notify()
  }

  seatPrepUnit(unitId: string) {
    const target = this.units.find((u) => u.id === unitId)
    if (target && target.status === 'prep') {
      this.updateUnit(unitId, { status: 'seated' })
    }
  }

  toggleArrival(bookingId: number) {
    this.bookings = this.bookings.map((b) =>
      b.id === bookingId ? { ...b, arrived: !b.arrived } : b
    )
    this.notify()
  }

  // --- Seating & Check Closeout ---

  completeSeating(unitId: string, bill?: number) {
    const target = this.units.find((u) => u.id === unitId)
    if (!target) return

    const validBill =
      typeof bill === 'number' && Number.isFinite(bill) && bill >= 0 ? bill : undefined
    const addedBill = validBill ?? 0

    // Find active booking attached to this unit to attribute customer visit and spend
    const completedBooking =
      [...this.bookings]
        .reverse()
        .find(
          (b) =>
            b.unit === unitId &&
            !this.completedBookingIds.has(b.id) &&
            (!target.guest || b.name.toLowerCase() === target.guest.toLowerCase())
        ) ??
      [...this.bookings]
        .reverse()
        .find((b) => b.unit === unitId && !this.completedBookingIds.has(b.id))

    const guestProfile = completedBooking
      ? this.findCustomer(completedBooking.phone)
      : target.guest
        ? this.customers.find((c) => c.name.toLowerCase() === target.guest!.toLowerCase())
        : undefined

    if (completedBooking) {
      this.completedBookingIds.add(completedBooking.id)
    }

    if (guestProfile) {
      this.customers = this.customers.map((c) => {
        if (c.phone !== guestProfile.phone) return c
        const prevSpend = (c as CustomerProfile & { totalSpend?: number }).totalSpend ?? 0
        const nextSpend = prevSpend + addedBill
        return {
          ...c,
          visits: c.visits + 1,
          ...(nextSpend > 0 ||
          (c as CustomerProfile & { totalSpend?: number }).totalSpend !== undefined
            ? { totalSpend: nextSpend }
            : {}),
        } as CustomerProfile
      })
    }

    this.units = this.units.map((u) =>
      u.id === unitId
        ? ({
            ...u,
            status: 'available' as const,
            guest: undefined,
            pax: undefined,
            time: undefined,
            note: undefined,
            bill: validBill !== undefined ? (u.bill || 0) + validBill : u.bill,
          } as Unit)
        : u
    )

    this.markDirty()
    this.notify()
  }

  // --- Unit & Configuration Mutations ---

  updateUnit(unitId: string, patch: Partial<Unit>, options?: { sync?: boolean }) {
    this.units = this.units.map((u) =>
      u.id === unitId ? ({ ...u, ...patch } as Unit) : u
    )
    if (options?.sync !== false) {
      this.markDirty()
    }
    this.notify()
  }

  applyRemoteUnitUpdate(
    unitId: string,
    patch: Omit<Partial<Unit>, 'status'> & { status?: TableStatus | 'occupied' }
  ) {
    const normalizedStatus: TableStatus | undefined =
      patch.status === 'occupied'
        ? 'seated'
        : patch.status === 'available' ||
            patch.status === 'seated' ||
            patch.status === 'prep' ||
            patch.status === 'blocked'
          ? patch.status
          : undefined

    this.units = this.units.map((u) => {
      if (u.id !== unitId) return u
      const nextBill =
        typeof patch.bill === 'number' && Number.isFinite(patch.bill) ? patch.bill : u.bill
      return {
        ...u,
        ...patch,
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        bill: nextBill,
      } as Unit
    })
    this.notify()
  }

  applyRemoteReservationCreated(payload: RemoteReservationCreatedInput): Booking | null {
    const guestName = (payload.customerName || 'Guest').trim()
    const pax =
      typeof payload.partySize === 'number' && payload.partySize > 0 ? payload.partySize : 2
    const time = normalizeBookingTime(payload.time, this.clock)
    const matchedUnit = payload.tableId
      ? this.units.find((u) => u.id === payload.tableId)
      : undefined
    const assignedUnit = payload.tableId || `${matchedUnit?.kind ?? 'Table'} · assign`
    const phone = normalizePhone(payload.customerPhone || '')

    const numericId =
      typeof payload.reservationId === 'number' && Number.isFinite(payload.reservationId)
        ? payload.reservationId
        : undefined

    const existingIndex = this.bookings.findIndex(
      (b) =>
        (numericId !== undefined && b.id === numericId) ||
        (b.name.toLowerCase() === guestName.toLowerCase() &&
          b.time === time &&
          b.pax === pax &&
          (b.unit === assignedUnit || !payload.tableId))
    )

    if (existingIndex >= 0) {
      const existing = this.bookings[existingIndex]
      const updated: Booking = {
        ...existing,
        unit: payload.tableId || existing.unit,
      }
      this.bookings = this.bookings
        .map((b, idx) => (idx === existingIndex ? updated : b))
        .sort((a, b) => a.time.localeCompare(b.time))
      this.notify()
      return updated
    }

    const booking: Booking = {
      id: numericId ?? generateBookingId(this.bookings),
      name: guestName,
      phone,
      pax,
      kind: matchedUnit?.kind ?? 'Table',
      tableType: matchedUnit?.kind === 'Table' ? matchedUnit.tableType : 'any',
      time,
      note: payload.notes || '',
      unit: assignedUnit,
    }

    this.bookings = [...this.bookings, booking].sort((a, b) => a.time.localeCompare(b.time))
    this.notify()
    return booking
  }

  mergeUnits(unitIds: string[]): Unit | null {
    const uniqueIds = Array.from(new Set(unitIds))
    const unitsToMerge = this.units.filter((u) => !u.archived && uniqueIds.includes(u.id))
    if (unitsToMerge.length < 2) return null

    const mergedId = `Merge (${unitsToMerge.map((u) => u.id).join('+')})`
    const combinedCapacity = unitsToMerge.reduce((sum, u) => sum + u.capacity, 0)
    const combinedBill = unitsToMerge.reduce((sum, u) => sum + (u.bill || 0), 0)
    const avgX = Math.round(
      unitsToMerge.reduce((sum, u) => sum + u.x, 0) / unitsToMerge.length
    )
    const avgY = Math.round(
      unitsToMerge.reduce((sum, u) => sum + u.y, 0) / unitsToMerge.length
    )
    const activeSeatedOrPrep =
      unitsToMerge.find((u) => u.status === 'seated') ??
      unitsToMerge.find((u) => u.status === 'prep')

    const baseUnit = createFloorUnit('Table', this.units)
    const clampedPos = clampUnitPosition({ kind: 'Table' }, avgX, avgY)

    // Reassign bookings from merged source units to the merged unit
    this.bookings = this.bookings.map((b) =>
      uniqueIds.includes(b.unit) ? { ...b, unit: mergedId } : b
    )
    const reassignedBooking = this.bookings.find((b) => b.unit === mergedId)

    const mergedUnit: Unit = {
      ...baseUnit,
      kind: 'Table',
      tableType: 'long',
      id: mergedId,
      capacity: combinedCapacity,
      x: clampedPos.x,
      y: clampedPos.y,
      status: activeSeatedOrPrep?.status ?? (reassignedBooking ? 'prep' : 'available'),
      guest: activeSeatedOrPrep?.guest ?? reassignedBooking?.name,
      pax: activeSeatedOrPrep?.pax ?? reassignedBooking?.pax,
      time:
        activeSeatedOrPrep?.time ??
        (reassignedBooking ? formatDisplayTime(reassignedBooking.time) : undefined),
      note: activeSeatedOrPrep?.note ?? reassignedBooking?.note,
      ...(combinedBill > 0 ? { bill: combinedBill } : {}),
    }

    const updatedOriginalUnits = this.units.map((u) =>
      uniqueIds.includes(u.id)
        ? ({
            ...u,
            archived: true,
            status: 'available' as const,
            guest: undefined,
            pax: undefined,
            time: undefined,
            note: undefined,
            bill: undefined,
          } as Unit)
        : u
    )

    this.units = [...updatedOriginalUnits, mergedUnit]
    this.markDirty()
    this.notify()
    return mergedUnit
  }

  updateFloorUnits(units: Unit[]) {
    this.units = [...units]
    this.markDirty()
    this.notify()
  }

  updateCustomers(customers: CustomerProfile[]) {
    this.customers = [...customers]
    this.markDirty()
    this.notify()
  }

  updateCustomerProfile(phone: string, patch: Partial<CustomerProfile>) {
    const normalized = normalizePhone(phone)
    this.customers = this.customers.map((c) =>
      c.phone === normalized ? { ...c, ...patch } : c
    )
    this.markDirty()
    this.notify()
  }

  updateVisitTiers(tiers: VisitTier[]) {
    this.visitTiers = [...tiers]
    this.markDirty()
    this.notify()
  }

  updateOccasionTags(tags: OccasionTag[]) {
    this.occasionTags = [...tags]
    this.markDirty()
    this.notify()
  }

  // --- Synchronization & Persistence ---

  loadConfig(config: Partial<RestaurantConfig>) {
    if (config.floorItems) this.units = [...config.floorItems]
    if (config.customers) this.customers = [...config.customers]
    if (config.visitTiers) this.visitTiers = [...config.visitTiers]
    if (config.occasionTags) this.occasionTags = [...config.occasionTags]
    this.isDirty = false
    this.syncStatus = 'saved'
    this.notify()
  }

  private markDirty() {
    this.isDirty = true
    this.revision += 1
    this.scheduleSync()
  }

  private scheduleSync() {
    if (!this.syncAdapter) return

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      void this.flushSync()
    }, this.debounceMs)
  }

  async flushSync(): Promise<void> {
    if (!this.syncAdapter || !this.isDirty) return

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    const currentRevision = this.revision
    this.syncStatus = 'saving'
    this.notify()

    const payload: RestaurantConfig = {
      floorItems: this.units,
      customers: this.customers,
      visitTiers: this.visitTiers,
      occasionTags: this.occasionTags,
    }

    this.syncQueue = this.syncQueue
      .catch(() => undefined)
      .then(() => this.syncAdapter!(payload))

    try {
      await this.syncQueue
      if (this.revision === currentRevision) {
        this.isDirty = false
        this.syncStatus = 'saved'
        this.notify()
      }
    } catch {
      this.syncStatus = 'error'
      this.notify()
    }
  }
}

export function useDiningService(store: DiningSessionStore): DiningServiceSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
