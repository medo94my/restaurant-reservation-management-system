import { create } from 'zustand'
import { clampUnitPosition, createFloorUnit } from './floor-layout.ts'
import {
  generateBookingId,
  type RemoteReservationCreatedInput,
} from './dining-service.ts'
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

export { generateBookingId, type RemoteReservationCreatedInput }

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

export type DueBooking = Booking & { mins: number }

export interface DiningState {
  // State
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

  // Actions
  setClock: (date: Date) => void
  tick: (date?: Date) => void
  findCustomer: (phone: string) => CustomerProfile | undefined
  resolveGuestTier: (visits: number) => VisitTier
  bookTable: (request: NewBookingRequest) => Booking | null
  updateBooking: (bookingId: number, patch: Partial<NewBookingRequest> & { customOccasion?: string }) => Booking | null
  releaseTable: (unitId: string) => void
  seatPrepUnit: (unitId: string) => void
  toggleArrival: (bookingId: number) => void
  completeSeating: (unitId: string, bill?: number) => void
  updateUnit: (unitId: string, patch: Partial<Unit>, options?: { sync?: boolean }) => void
  applyRemoteUnitUpdate: (
    unitId: string,
    patch: Omit<Partial<Unit>, 'status'> & { status?: TableStatus | 'occupied' }
  ) => void
  applyRemoteReservationCreated: (payload: RemoteReservationCreatedInput) => Booking | null
  mergeUnits: (unitIds: string[]) => Unit | null
  updateFloorUnits: (units: Unit[]) => void
  updateCustomers: (customers: CustomerProfile[]) => void
  updateCustomerProfile: (phone: string, patch: Partial<CustomerProfile>) => void
  updateVisitTiers: (tiers: VisitTier[]) => void
  updateOccasionTags: (tags: OccasionTag[]) => void
  loadConfig: (config: Partial<RestaurantConfig>) => void
  setSyncAdapter: (adapter: WorkspaceSyncAdapter) => void
  flushSync: () => Promise<void>
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

function computeDerived(units: Unit[], bookings: Booking[], clock: Date) {
  const currentMinutes = clock.getHours() * 60 + clock.getMinutes()
  const dueBookings: DueBooking[] = bookings
    .map((b) => ({ ...b, mins: calculateMinutesUntil(b.time, currentMinutes) }))
    .filter((b) => b.mins >= 15 && b.mins <= 30 && !b.arrived)

  const revenue = units.reduce((sum, unit) => sum + (unit.bill || 0), 0)
  const covers =
    bookings.reduce((sum, b) => sum + b.pax, 0) +
    units.filter((u) => u.status === 'seated').reduce((sum, u) => sum + (u.pax || 0), 0)

  return { dueBookings, revenue, covers }
}

function getInitialBookings(now: Date): Booking[] {
  const arrival = new Date(now.getTime() + 20 * 60 * 1000)
  const arrivalTime = `${String(arrival.getHours()).padStart(2, '0')}:${String(arrival.getMinutes()).padStart(2, '0')}`
  return [
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

const DEBOUNCE_MS = 650

export const createDiningStore = (initialNow: Date = new Date(), debounceMs: number = DEBOUNCE_MS) => {
  const initialUnits = [...DEFAULT_FLOOR_ITEMS]
  const initialBookings = getInitialBookings(initialNow)
  const initialCustomers = [...DEFAULT_CUSTOMERS]
  const initialVisitTiers = [...DEFAULT_VISIT_TIERS]
  const initialOccasionTags = [...DEFAULT_OCCASION_TAGS]
  const initialDerived = computeDerived(initialUnits, initialBookings, initialNow)

  // Instance-scoped sync queue, debounce timer, and revision tracking
  let activeSyncAdapter: WorkspaceSyncAdapter | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let syncQueue = Promise.resolve<unknown>(undefined)
  let revision = 0
  const completedBookingIds = new Set<number>()

  const flushSyncOperation = async (
    getState: () => DiningState,
    setState: (partial: Partial<DiningState>) => void
  ): Promise<void> => {
    if (!activeSyncAdapter || !getState().isDirty) return

    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    const currentRevision = revision
    setState({ syncStatus: 'saving' })

    const state = getState()
    const payload: RestaurantConfig = {
      floorItems: state.units,
      customers: state.customers,
      visitTiers: state.visitTiers,
      occasionTags: state.occasionTags,
    }

    syncQueue = syncQueue
      .catch(() => undefined)
      .then(() => activeSyncAdapter!(payload))

    try {
      await syncQueue
      if (revision === currentRevision) {
        setState({ isDirty: false, syncStatus: 'saved' })
      }
    } catch {
      setState({ syncStatus: 'error' })
    }
  }

  const scheduleSync = (
    getState: () => DiningState,
    setState: (partial: Partial<DiningState>) => void
  ) => {
    if (!activeSyncAdapter) return

    revision += 1
    setState({ isDirty: true })

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      void flushSyncOperation(getState, setState)
    }, debounceMs)
  }

  return create<DiningState>((set, get) => ({
    units: initialUnits,
    bookings: initialBookings,
    customers: initialCustomers,
    visitTiers: initialVisitTiers,
    occasionTags: initialOccasionTags,
    clock: initialNow,
    dueBookings: initialDerived.dueBookings,
    revenue: initialDerived.revenue,
    covers: initialDerived.covers,
    syncStatus: 'saved',
    isDirty: false,

    setClock: (date: Date) => {
      const derived = computeDerived(get().units, get().bookings, date)
      set({ clock: date, ...derived })
    },

    tick: (date?: Date) => {
      const clock = date ?? new Date()
      const derived = computeDerived(get().units, get().bookings, clock)
      set({ clock, ...derived })
    },

    findCustomer: (phone: string): CustomerProfile | undefined => {
      const normalized = normalizePhone(phone)
      if (!normalized) return undefined
      return get().customers.find((c) => c.phone === normalized)
    },

    resolveGuestTier: (visits: number): VisitTier => {
      return (
        [...get().visitTiers]
          .sort((a, b) => b.minVisits - a.minVisits)
          .find((tier) => visits >= tier.minVisits) ?? get().visitTiers[0]
      )
    },

    bookTable: (request: NewBookingRequest): Booking | null => {
      const phone = normalizePhone(request.phone)
      const guestName = request.name.trim()
      if (!guestName || phone.length < 7) return null

      const visibleUnits = get().units.filter((u) => !u.archived)
      const chosenUnit = request.unitId
        ? visibleUnits.find((u) => u.id === request.unitId && u.status === 'available')
        : undefined

      if (request.unitId && (!chosenUnit || request.pax > chosenUnit.capacity)) {
        return null
      }

      const matchedUnit =
        chosenUnit ??
        visibleUnits.find(
          (u) =>
            u.kind === request.kind &&
            u.status === 'available' &&
            request.pax <= u.capacity &&
            (request.tableType === 'any' || u.kind !== 'Table' || u.tableType === request.tableType)
        )

      const assignedUnitId = matchedUnit?.id ?? `${request.kind} · assign`

      const booking: Booking = {
        id: generateBookingId(get().bookings),
        name: guestName,
        phone,
        pax: request.pax,
        kind: matchedUnit?.kind ?? request.kind,
        tableType: matchedUnit?.kind === 'Table' ? request.tableType : 'any',
        time: request.time,
        note: request.note || '',
        unit: assignedUnitId,
      }

      const updatedBookings = [...get().bookings, booking].sort((a, b) =>
        a.time.localeCompare(b.time)
      )

      // CRM updates
      const existing = get().findCustomer(phone)
      const requestedTags = request.occasionTags ?? []
      let updatedCustomers: CustomerProfile[]

      if (existing) {
        const mergedTags = Array.from(new Set([...existing.occasionTags, ...requestedTags]))
        updatedCustomers = get().customers.map((c) =>
          c.phone === phone
            ? { ...c, name: guestName, note: request.note || c.note, occasionTags: mergedTags }
            : c
        )
      } else {
        updatedCustomers = [
          {
            phone,
            name: guestName,
            visits: 0,
            note: request.note || '',
            occasionTags: requestedTags,
          },
          ...get().customers,
        ]
      }

      let updatedUnits = get().units
      if (matchedUnit) {
        updatedUnits = updatedUnits.map((u) =>
          u.id === matchedUnit.id
            ? ({
                ...u,
                status: 'prep',
                guest: booking.name,
                pax: booking.pax,
                time: formatDisplayTime(booking.time),
                note: booking.note,
              } as Unit)
            : u
        )
      }

      const derived = computeDerived(updatedUnits, updatedBookings, get().clock)

      set({
        units: updatedUnits,
        bookings: updatedBookings,
        customers: updatedCustomers,
        ...derived,
      })

      scheduleSync(get, set)
      return booking
    },

    updateBooking: (
      bookingId: number,
      patch: Partial<NewBookingRequest> & { customOccasion?: string }
    ): Booking | null => {
      const existing = get().bookings.find((b) => b.id === bookingId)
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

      const updatedBookings = get()
        .bookings.map((b) => (b.id === bookingId ? updatedBooking : b))
        .sort((a, b) => a.time.localeCompare(b.time))

      // Update unit if assigned
      let updatedUnits = get().units
      if (existing.unit) {
        updatedUnits = updatedUnits.map((u) =>
          u.id === existing.unit
            ? ({
                ...u,
                guest: updatedBooking.name,
                pax: updatedBooking.pax,
                time: formatDisplayTime(updatedBooking.time),
                note: updatedBooking.note,
              } as Unit)
            : u
        )
      }

      // Update customer CRM profile
      const cust = get().findCustomer(nextPhone)
      let updatedCustomers = get().customers
      if (cust) {
        const mergedTags = nextTags
          ? Array.from(new Set([...cust.occasionTags, ...nextTags]))
          : cust.occasionTags
        updatedCustomers = updatedCustomers.map((c) =>
          c.phone === nextPhone
            ? { ...c, name: nextName, note: nextNote || c.note, occasionTags: mergedTags }
            : c
        )
      }

      const derived = computeDerived(updatedUnits, updatedBookings, get().clock)
      set({
        bookings: updatedBookings,
        units: updatedUnits,
        customers: updatedCustomers,
        ...derived,
      })

      scheduleSync(get, set)
      return updatedBooking
    },

    releaseTable: (unitId: string) => {
      const updatedUnits = get().units.map((u) =>
        u.id === unitId
          ? ({
              ...u,
              status: 'available' as const,
              guest: undefined,
              pax: undefined,
              time: undefined,
              note: undefined,
            } as Unit)
          : u
      )
      // Disassociate active bookings assigned to this unit
      const updatedBookings = get().bookings.map((b) =>
        b.unit === unitId ? { ...b, unit: `${b.kind} · unassigned` } : b
      )

      const derived = computeDerived(updatedUnits, updatedBookings, get().clock)
      set({
        units: updatedUnits,
        bookings: updatedBookings,
        ...derived,
      })
      scheduleSync(get, set)
    },

    seatPrepUnit: (unitId: string) => {
      const updatedUnits = get().units.map((u) =>
        u.id === unitId && u.status === 'prep'
          ? ({
              ...u,
              status: 'seated' as const,
            } as Unit)
          : u
      )
      const derived = computeDerived(updatedUnits, get().bookings, get().clock)
      set({ units: updatedUnits, ...derived })
      scheduleSync(get, set)
    },

    toggleArrival: (bookingId: number) => {
      const updatedBookings = get().bookings.map((b) =>
        b.id === bookingId ? { ...b, arrived: !b.arrived } : b
      )
      const derived = computeDerived(get().units, updatedBookings, get().clock)
      set({ bookings: updatedBookings, ...derived })
    },

    completeSeating: (unitId: string, bill?: number) => {
      const target = get().units.find((u) => u.id === unitId)
      if (!target) return

      const validBill =
        typeof bill === 'number' && Number.isFinite(bill) && bill >= 0 ? bill : undefined
      const addedBill = validBill ?? 0

      const completedBooking =
        [...get().bookings]
          .reverse()
          .find(
            (b) =>
              b.unit === unitId &&
              !completedBookingIds.has(b.id) &&
              (!target.guest || b.name.toLowerCase() === target.guest.toLowerCase())
          ) ??
        [...get().bookings]
          .reverse()
          .find((b) => b.unit === unitId && !completedBookingIds.has(b.id))

      const guestProfile = completedBooking
        ? get().findCustomer(completedBooking.phone)
        : target.guest
          ? get().customers.find((c) => c.name.toLowerCase() === target.guest!.toLowerCase())
          : undefined

      if (completedBooking) {
        completedBookingIds.add(completedBooking.id)
      }

      let updatedCustomers = get().customers
      if (guestProfile) {
        updatedCustomers = updatedCustomers.map((c) => {
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

      const updatedUnits = get().units.map((u) =>
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

      const derived = computeDerived(updatedUnits, get().bookings, get().clock)
      set({
        units: updatedUnits,
        customers: updatedCustomers,
        ...derived,
      })

      scheduleSync(get, set)
    },

    updateUnit: (unitId: string, patch: Partial<Unit>, options?: { sync?: boolean }) => {
      const updatedUnits = get().units.map((u) =>
        u.id === unitId ? ({ ...u, ...patch } as Unit) : u
      )
      const derived = computeDerived(updatedUnits, get().bookings, get().clock)
      set({ units: updatedUnits, ...derived })
      if (options?.sync !== false) {
        scheduleSync(get, set)
      }
    },

    applyRemoteUnitUpdate: (
      unitId: string,
      patch: Omit<Partial<Unit>, 'status'> & { status?: TableStatus | 'occupied' }
    ) => {
      const normalizedStatus: TableStatus | undefined =
        patch.status === 'occupied'
          ? 'seated'
          : patch.status === 'available' ||
              patch.status === 'seated' ||
              patch.status === 'prep' ||
              patch.status === 'blocked'
            ? patch.status
            : undefined

      const updatedUnits = get().units.map((u) => {
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
      const derived = computeDerived(updatedUnits, get().bookings, get().clock)
      set({ units: updatedUnits, ...derived })
    },

    applyRemoteReservationCreated: (payload: RemoteReservationCreatedInput): Booking | null => {
      const guestName = (payload.customerName || 'Guest').trim()
      const pax =
        typeof payload.partySize === 'number' && payload.partySize > 0 ? payload.partySize : 2
      const time = normalizeBookingTime(payload.time, get().clock)
      const matchedUnit = payload.tableId
        ? get().units.find((u) => u.id === payload.tableId)
        : undefined
      const assignedUnit = payload.tableId || `${matchedUnit?.kind ?? 'Table'} · assign`
      const phone = normalizePhone(payload.customerPhone || '')

      const numericId =
        typeof payload.reservationId === 'number' && Number.isFinite(payload.reservationId)
          ? payload.reservationId
          : undefined

      const currentBookings = get().bookings
      const existingIndex = currentBookings.findIndex(
        (b) =>
          (numericId !== undefined && b.id === numericId) ||
          (b.name.toLowerCase() === guestName.toLowerCase() &&
            b.time === time &&
            b.pax === pax &&
            (b.unit === assignedUnit || !payload.tableId))
      )

      if (existingIndex >= 0) {
        const existing = currentBookings[existingIndex]
        const updated: Booking = {
          ...existing,
          unit: payload.tableId || existing.unit,
        }
        const updatedBookings = currentBookings
          .map((b, idx) => (idx === existingIndex ? updated : b))
          .sort((a, b) => a.time.localeCompare(b.time))
        const derived = computeDerived(get().units, updatedBookings, get().clock)
        set({ bookings: updatedBookings, ...derived })
        return updated
      }

      const booking: Booking = {
        id: numericId ?? generateBookingId(currentBookings),
        name: guestName,
        phone,
        pax,
        kind: matchedUnit?.kind ?? 'Table',
        tableType: matchedUnit?.kind === 'Table' ? matchedUnit.tableType : 'any',
        time,
        note: payload.notes || '',
        unit: assignedUnit,
      }

      const updatedBookings = [...currentBookings, booking].sort((a, b) =>
        a.time.localeCompare(b.time)
      )
      const derived = computeDerived(get().units, updatedBookings, get().clock)
      set({ bookings: updatedBookings, ...derived })
      return booking
    },

    mergeUnits: (unitIds: string[]): Unit | null => {
      const uniqueIds = Array.from(new Set(unitIds))
      const currentUnits = get().units
      const unitsToMerge = currentUnits.filter((u) => !u.archived && uniqueIds.includes(u.id))
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

      const baseUnit = createFloorUnit('Table', currentUnits)
      const clampedPos = clampUnitPosition({ kind: 'Table' }, avgX, avgY)

      // Reassign bookings from merged source units to the merged unit
      const updatedBookings = get().bookings.map((b) =>
        uniqueIds.includes(b.unit) ? { ...b, unit: mergedId } : b
      )
      const reassignedBooking = updatedBookings.find((b) => b.unit === mergedId)

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

      const updatedOriginalUnits = currentUnits.map((u) =>
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

      const nextUnits = [...updatedOriginalUnits, mergedUnit]
      const derived = computeDerived(nextUnits, updatedBookings, get().clock)
      set({
        units: nextUnits,
        bookings: updatedBookings,
        ...derived,
      })
      scheduleSync(get, set)
      return mergedUnit
    },

    updateFloorUnits: (units: Unit[]) => {
      const derived = computeDerived(units, get().bookings, get().clock)
      set({ units: [...units], ...derived })
      scheduleSync(get, set)
    },

    updateCustomers: (customers: CustomerProfile[]) => {
      set({ customers: [...customers] })
      scheduleSync(get, set)
    },

    updateCustomerProfile: (phone: string, patch: Partial<CustomerProfile>) => {
      const normalized = normalizePhone(phone)
      const updated = get().customers.map((c) =>
        c.phone === normalized ? { ...c, ...patch } : c
      )
      set({ customers: updated })
      scheduleSync(get, set)
    },

    updateVisitTiers: (tiers: VisitTier[]) => {
      set({ visitTiers: [...tiers] })
      scheduleSync(get, set)
    },

    updateOccasionTags: (tags: OccasionTag[]) => {
      set({ occasionTags: [...tags] })
      scheduleSync(get, set)
    },

    loadConfig: (config: Partial<RestaurantConfig>) => {
      const updatedUnits = config.floorItems ? [...config.floorItems] : get().units
      const updatedCustomers = config.customers ? [...config.customers] : get().customers
      const updatedVisitTiers = config.visitTiers ? [...config.visitTiers] : get().visitTiers
      const updatedOccasionTags = config.occasionTags ? [...config.occasionTags] : get().occasionTags
      const derived = computeDerived(updatedUnits, get().bookings, get().clock)

      set({
        units: updatedUnits,
        customers: updatedCustomers,
        visitTiers: updatedVisitTiers,
        occasionTags: updatedOccasionTags,
        isDirty: false,
        syncStatus: 'saved',
        ...derived,
      })
    },

    setSyncAdapter: (adapter: WorkspaceSyncAdapter) => {
      activeSyncAdapter = adapter
    },

    flushSync: async () => {
      await flushSyncOperation(get, set)
    },
  }))
}

export const useDiningStore = createDiningStore()
