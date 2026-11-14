'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import '@/app/dining-room.css'

import { useDiningStore } from '@/lib/dining-store'
import type { CustomerProfile, RestaurantConfig, Unit } from '@/lib/restaurant-config'

import { HostessTopBar } from '@/components/hostess/hostess-top-bar'
import { LiveAlerts } from '@/components/live-alerts'
import { HostFloor } from '@/components/host-floor'
import { QuickTableModal } from '@/components/modals/quick-table-modal'
import { BookingModal } from '@/components/modals/booking-modal'
import { CompleteSeatingModal } from '@/components/modals/complete-seating-modal'
import { MergeTablesModal } from '@/components/modals/merge-tables-modal'
import {
  DEFAULT_BOOKING_FORM,
  type BookingFormState,
  type LiveAlertNotification,
  type MatchedCustomer,
} from '@/components/ui-helpers'
import { useSession } from '@/lib/auth/client'

type RestaurantConfigResponse = {
  config: (Omit<RestaurantConfig, 'customers'> & { customers?: CustomerProfile[] }) | null
}

function buildReservationIsoTime(timeStr: string, referenceDate: Date | null): string {
  const base = referenceDate ? new Date(referenceDate) : new Date()
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      base.setHours(hours, minutes, 0, 0)
      return base.toISOString()
    }
  }
  return base.toISOString()
}

async function resolveOrCreateCustomerId(params: {
  appliedCustomerId?: string | null
  name: string
  phone?: string
  note?: string
  occasionTags?: string[]
}): Promise<string> {
  const { appliedCustomerId, name, phone, note, occasionTags } = params
  const normalizedDigits = (phone || '').replace(/\D/g, '')

  // If appliedCustomerId is already a resolved backend customer ID (not raw phone digits), reuse it
  if (appliedCustomerId && appliedCustomerId !== normalizedDigits && appliedCustomerId !== phone) {
    return appliedCustomerId
  }

  const searchQuery = normalizedDigits || name.trim()
  if (searchQuery) {
    const searchRes = await fetch(
      `/api/customers?search=${encodeURIComponent(searchQuery)}`,
      { cache: 'no-store' }
    )
    if (!searchRes.ok) {
      const errBody = (await searchRes.json().catch(() => null)) as { error?: string } | null
      throw new Error(errBody?.error || `Customer lookup failed (${searchRes.status}).`)
    }
    const searchData = (await searchRes.json()) as {
      customers?: Array<{ id: string; name: string; phone: string }>
    }
    const found = (searchData.customers || []).find((c) => {
      const cDigits = (c.phone || '').replace(/\D/g, '')
      if (normalizedDigits && cDigits && cDigits.endsWith(normalizedDigits.slice(-4))) {
        return true
      }
      return c.name.trim().toLowerCase() === name.trim().toLowerCase()
    })
    if (found?.id) {
      return found.id
    }
  }

  const createPhone =
    normalizedDigits.length >= 7
      ? normalizedDigits
      : `961${String(Date.now()).slice(-8)}`

  const createRes = await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim() || 'Guest',
      phone: createPhone,
      note: note || '',
      occasionTags: occasionTags || [],
    }),
  })

  if (createRes.status === 409 && createPhone) {
    const retryRes = await fetch(
      `/api/customers?search=${encodeURIComponent(createPhone)}`,
      { cache: 'no-store' }
    )
    if (retryRes.ok) {
      const retryData = (await retryRes.json()) as {
        customers?: Array<{ id: string }>
      }
      if (retryData.customers?.[0]?.id) {
        return retryData.customers[0].id
      }
    }
  }

  if (!createRes.ok) {
    const errBody = (await createRes.json().catch(() => null)) as { error?: string } | null
    throw new Error(errBody?.error || `Unable to create customer record (${createRes.status}).`)
  }

  const createdData = (await createRes.json()) as { customer?: { id: string } }
  if (!createdData.customer?.id) {
    throw new Error('Customer creation response did not include a customer ID.')
  }
  return createdData.customer.id
}

async function fetchRestaurantConfig(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load restaurant settings.')
  return response.json() as Promise<RestaurantConfigResponse>
}

async function putRestaurantConfig(url: string, { arg }: { arg: RestaurantConfig }) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  })
  if (!response.ok) throw new Error('Unable to save restaurant settings.')
  return response.json() as Promise<{ ok: true }>
}

export function HostessView() {
  const router = useRouter()
  const { data: sessionData } = useSession()
  const currentStaff = sessionData?.user as { name?: string; role?: string; staffId?: string } | undefined

  const { data: configData, isLoading: configLoading } = useSWR(
    '/api/restaurant-config',
    fetchRestaurantConfig
  )
  const { trigger: saveConfig } = useSWRMutation('/api/restaurant-config', putRestaurantConfig)

  const units = useDiningStore((s) => s.units)
  const bookings = useDiningStore((s) => s.bookings)
  const customers = useDiningStore((s) => s.customers)
  const occasionTags = useDiningStore((s) => s.occasionTags)
  const now = useDiningStore((s) => s.clock)
  const dueBookings = useDiningStore((s) => s.dueBookings)
  const revenue = useDiningStore((s) => s.revenue)
  const covers = useDiningStore((s) => s.covers)

  const tick = useDiningStore((s) => s.tick)
  const loadConfig = useDiningStore((s) => s.loadConfig)
  const setSyncAdapter = useDiningStore((s) => s.setSyncAdapter)
  const bookTable = useDiningStore((s) => s.bookTable)
  const updateBooking = useDiningStore((s) => s.updateBooking)
  const releaseTable = useDiningStore((s) => s.releaseTable)
  const seatPrepUnit = useDiningStore((s) => s.seatPrepUnit)
  const completeSeating = useDiningStore((s) => s.completeSeating)
  const updateUnit = useDiningStore((s) => s.updateUnit)
  const applyRemoteUnitUpdate = useDiningStore((s) => s.applyRemoteUnitUpdate)
  const applyRemoteReservationCreated = useDiningStore((s) => s.applyRemoteReservationCreated)
  const mergeUnits = useDiningStore((s) => s.mergeUnits)
  const toggleArrival = useDiningStore((s) => s.toggleArrival)

  // Configure sync adapter with SWR mutation
  useEffect(() => {
    setSyncAdapter(async (payload) => {
      if (
        currentStaff?.role &&
        currentStaff.role !== 'manager' &&
        currentStaff.role !== 'admin'
      ) {
        return
      }
      await saveConfig(payload, { populateCache: false, revalidate: false })
    })
  }, [currentStaff?.role, saveConfig, setSyncAdapter])

  // Modals & Navigation Tabs: store selectedUnitId rather than a stale Unit snapshot
  const [modal, setModal] = useState<'quick' | 'booking' | 'complete' | 'merge' | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const selected = useMemo(
    () => (selectedUnitId ? units.find((u) => u.id === selectedUnitId) ?? null : null),
    [units, selectedUnitId]
  )
  const [bill, setBill] = useState('')
  const [stats, setStats] = useState(false)
  const [mergeSet, setMergeSet] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  // Booking Form State
  const [bookingForm, setBookingForm] = useState<BookingFormState>(DEFAULT_BOOKING_FORM)
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null)
  const [searchSource, setSearchSource] = useState<'phone' | 'name'>('phone')
  const [matchedCustomer, setMatchedCustomer] = useState<MatchedCustomer | null>(null)
  const [appliedCustomerId, setAppliedCustomerId] = useState<string | null>(null)

  // Live SSE Notifications State
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertNotification[]>([])

  const appliedConfig = useRef(false)
  const alertCounterRef = useRef(0)
  const reservationIdMapRef = useRef(new Map<number, string | number>())

  const nextAlertId = useCallback(() => {
    alertCounterRef.current += 1
    return `alert-${Date.now()}-${alertCounterRef.current}`
  }, [])

  const surfaceOperationError = useCallback(
    (title: string, error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'An unexpected operation error occurred.'
      setActionError(`${title}: ${message}`)
      const alertItem: LiveAlertNotification = {
        id: nextAlertId(),
        type: 'overstay',
        title,
        message,
        timestamp: Date.now(),
      }
      setLiveAlerts((prev) => [alertItem, ...prev.slice(0, 4)])
    },
    [nextAlertId]
  )

  // Periodic store clock ticker
  useEffect(() => {
    tick(new Date())
    const timer = window.setInterval(() => tick(), 30_000)
    return () => window.clearInterval(timer)
  }, [tick])

  // Sync initial configuration
  useEffect(() => {
    if (configLoading || appliedConfig.current) return
    appliedConfig.current = true
    if (configData?.config) {
      loadConfig(configData.config)
    }
  }, [configData, configLoading, loadConfig])

  // Realtime SSE Event Stream Subscription
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    let eventSource: EventSource | null = null
    try {
      eventSource = new EventSource('/api/live-floor/stream')

      eventSource.addEventListener('floor:unit_updated', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as {
            unitId?: string
            status?: string
            guest?: string
            pax?: number
            bill?: number
          }
          if (payload?.unitId) {
            applyRemoteUnitUpdate(payload.unitId, {
              status: (payload.status as Unit['status'] | 'occupied') || undefined,
              guest: payload.guest,
              pax: payload.pax,
              bill: payload.bill,
            })
          }
        } catch {
          // Ignore malformed SSE payload
        }
      })

      eventSource.addEventListener('reservation:created', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as {
            reservationId?: string | number
            customerName?: string
            customerPhone?: string
            partySize?: number
            time?: string
            tableId?: string
            notes?: string
          }
          applyRemoteReservationCreated(payload)
          const newAlert: LiveAlertNotification = {
            id: nextAlertId(),
            type: 'prep_due',
            title: 'New Reservation',
            message: `${payload.customerName || 'Guest'} (${payload.partySize || 2} pax) booked for ${payload.time || 'tonight'}${payload.tableId ? ` at ${payload.tableId}` : ''}`,
            timestamp: Date.now(),
          }
          setLiveAlerts((prev) => [newAlert, ...prev.slice(0, 4)])
        } catch {
          // Ignore malformed SSE payload
        }
      })
    } catch {
      // EventSource not supported or blocked
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [applyRemoteReservationCreated, applyRemoteUnitUpdate, nextAlertId])

  // Customer phone / name lookup helper
  useEffect(() => {
    const rawTerm = searchSource === 'phone' ? bookingForm.phone : bookingForm.guestName
    const term = rawTerm.trim().toLowerCase()
    if (!term || term.length < 2) {
      setMatchedCustomer(null)
      return
    }

    const digitsOnly = searchSource === 'phone' ? term.replace(/\D/g, '') : ''

    const found = customers.find((c) => {
      if (searchSource === 'phone') {
        const cDigits = c.phone.replace(/\D/g, '')
        return (digitsOnly.length > 0 && cDigits.includes(digitsOnly)) || c.phone.toLowerCase().includes(term)
      }
      return c.name.toLowerCase().includes(term)
    })

    if (!found) {
      setMatchedCustomer(null)
      return
    }

    const foundWithId = found as CustomerProfile & { id?: string }
    setMatchedCustomer({
      id: foundWithId.id || found.phone,
      name: found.name,
      phone: found.phone,
      note: found.note,
      visits: found.visits,
      occasionTags: found.occasionTags,
    })
  }, [bookingForm.phone, bookingForm.guestName, searchSource, customers])

  const applyMatchedCustomer = (matched: MatchedCustomer) => {
    setBookingForm((prev) => ({
      ...prev,
      guestName: matched.name,
      phone: matched.phone,
      note: matched.note
        ? prev.note
          ? `${prev.note} · ${matched.note}`
          : matched.note
        : prev.note,
      occasionTags: Array.from(new Set([...prev.occasionTags, ...(matched.occasionTags || [])])),
    }))
    setAppliedCustomerId(matched.id)
  }

  // Open booking modal (or edit existing booking assigned to a non-available unit)
  const openNewBooking = (unitId?: string) => {
    if (unitId) {
      const targetUnit = units.find((u) => u.id === unitId)
      const existingBooking =
        targetUnit && targetUnit.status !== 'available'
          ? bookings.find((b) => b.unit === unitId)
          : undefined

      if (existingBooking) {
        setEditingBookingId(existingBooking.id)
        setBookingForm({
          guestName: existingBooking.name,
          phone: existingBooking.phone,
          pax: existingBooking.pax,
          kind: existingBooking.kind,
          tableType: existingBooking.tableType,
          time: existingBooking.time,
          note: existingBooking.note || '',
          unitId: existingBooking.unit,
          occasionTags: existingBooking.occasionTags || [],
          customOccasion: existingBooking.customOccasion || '',
        })
        setMatchedCustomer(null)
        setAppliedCustomerId(null)
        setModal('booking')
        return
      }
    }

    setEditingBookingId(null)
    setBookingForm({
      ...DEFAULT_BOOKING_FORM,
      unitId: unitId || null,
      time: now
        ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        : DEFAULT_BOOKING_FORM.time,
    })
    setMatchedCustomer(null)
    setAppliedCustomerId(null)
    setModal('booking')
  }

  // Handle table selection: opens fast 1-tap Hostess Quick Action Sheet
  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnitId(unit.id)
    setModal('quick')
  }

  const handleQuickSeatWalkIn = async (unitId: string, pax: number, guestName?: string) => {
    const formattedTime = now
      ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Current Service'
    const name = guestName || 'Walk-in Guest'

    updateUnit(unitId, {
      status: 'seated',
      guest: name,
      pax,
      time: formattedTime,
    })

    try {
      const customerId = await resolveOrCreateCustomerId({ name })
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          customerName: name,
          partySize: pax,
          reservationTime: new Date().toISOString(),
          tableId: unitId,
          notes: 'Walk-in seated from floor stand',
        }),
      })

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errBody?.error || `Failed to persist walk-in (${response.status}).`)
      }
    } catch (error) {
      surfaceOperationError('Walk-in reservation sync failed', error)
    }
  }

  const handleSeatReservationFromQuick = (bookingId: number, unitId: string) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return
    updateBooking(bookingId, { unitId })
    if (!booking.arrived) {
      toggleArrival(bookingId)
    }
    updateUnit(unitId, {
      status: 'seated',
      guest: booking.name,
      pax: booking.pax,
      time: booking.time,
      note: booking.note,
    })
  }

  const handleMarkReadyFromQuick = (unitId: string) => {
    releaseTable(unitId)
  }

  const handleSaveBooking = async () => {
    const trimmedName = bookingForm.guestName.trim()
    if (!trimmedName) {
      surfaceOperationError('Validation Error', new Error('Guest name is required.'))
      return
    }

    const currentEditingId = editingBookingId
    const formSnapshot = { ...bookingForm, guestName: trimmedName }
    let localBookingId: number | null = currentEditingId

    if (currentEditingId) {
      const updated = updateBooking(currentEditingId, {
        name: formSnapshot.guestName,
        phone: formSnapshot.phone,
        pax: formSnapshot.pax,
        kind: formSnapshot.kind,
        tableType: formSnapshot.tableType,
        time: formSnapshot.time,
        note: formSnapshot.note,
        unitId: formSnapshot.unitId || undefined,
        occasionTags: formSnapshot.occasionTags,
        customOccasion: formSnapshot.customOccasion,
      })
      if (!updated) {
        surfaceOperationError('Booking Update Failed', new Error('Target booking was not found.'))
        return
      }
    } else {
      const created = bookTable({
        name: formSnapshot.guestName,
        phone: formSnapshot.phone,
        pax: formSnapshot.pax,
        kind: formSnapshot.kind,
        tableType: formSnapshot.tableType,
        time: formSnapshot.time,
        note: formSnapshot.note,
        unitId: formSnapshot.unitId || undefined,
        occasionTags: formSnapshot.occasionTags,
        customOccasion: formSnapshot.customOccasion,
      })
      if (!created) {
        surfaceOperationError(
          'Booking Validation Failed',
          new Error('Please provide a valid phone number (7+ digits) and available unit.')
        )
        return
      }
      localBookingId = created.id
    }

    setModal(null)

    try {
      const customerId = await resolveOrCreateCustomerId({
        appliedCustomerId,
        name: formSnapshot.guestName,
        phone: formSnapshot.phone,
        note: formSnapshot.note,
        occasionTags: formSnapshot.occasionTags,
      })

      const reservationTimeIso = buildReservationIsoTime(formSnapshot.time, now)

      if (currentEditingId) {
        const remoteId = reservationIdMapRef.current.get(currentEditingId) ?? currentEditingId
        const response = await fetch(
          `/api/reservations/${encodeURIComponent(String(remoteId))}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'confirm',
              customerId,
              customerName: formSnapshot.guestName,
              customerPhone: formSnapshot.phone,
              partySize: formSnapshot.pax,
              reservationTime: reservationTimeIso,
              tableId: formSnapshot.unitId || undefined,
              notes: formSnapshot.note,
            }),
          }
        )
        if (!response.ok) {
          const errBody = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(
            errBody?.error || `Failed to update reservation (${response.status}).`
          )
        }
      } else {
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            customerName: formSnapshot.guestName,
            customerPhone: formSnapshot.phone,
            partySize: formSnapshot.pax,
            reservationTime: reservationTimeIso,
            tableId: formSnapshot.unitId || undefined,
            notes: formSnapshot.note,
          }),
        })
        if (!response.ok) {
          const errBody = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(
            errBody?.error || `Failed to create reservation (${response.status}).`
          )
        }
        const data = (await response.json().catch(() => null)) as {
          reservation?: { id?: string | number }
        } | null
        if (localBookingId !== null && data?.reservation?.id !== undefined) {
          reservationIdMapRef.current.set(localBookingId, data.reservation.id)
        }
      }
    } catch (error) {
      surfaceOperationError(
        currentEditingId ? 'Reservation update failed' : 'Reservation save failed',
        error
      )
    }
  }

  const handleSeatPrep = (unitId: string) => {
    seatPrepUnit(unitId)
    setModal(null)
  }

  const handleRelease = (unitId: string) => {
    releaseTable(unitId)
    setModal(null)
  }

  const handleCompleteSeatingSubmit = () => {
    if (!selectedUnitId) return
    completeSeating(selectedUnitId, bill ? Number(bill) : 0)
    setModal(null)
    setSelectedUnitId(null)
    setBill('')
  }

  const handleToggleMergeUnit = (unitId: string) => {
    setMergeSet((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    )
  }

  const handleConfirmMerge = () => {
    if (mergeSet.length < 2) return
    const merged = mergeUnits(mergeSet)
    if (!merged) {
      surfaceOperationError('Merge Failed', new Error('Select at least 2 active tables to merge.'))
      return
    }
    setMergeSet([])
    setModal(null)
  }

  const sections: Unit['kind'][] = ['Table', 'Couch', 'Room']

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0d0f0e', display: 'flex', flexDirection: 'column' }}>
      <HostessTopBar
        now={now}
        onOpenNewBooking={() => openNewBooking()}
        userName={currentStaff?.name || 'Head Hostess'}
        userRole={currentStaff?.role?.toUpperCase() || 'HOST'}
      />

      <Box
        component="main"
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 1680,
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4, xl: 6 },
          py: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        {actionError && (
          <Alert
            severity="error"
            onClose={() => setActionError(null)}
            sx={{
              bgcolor: 'rgba(239, 68, 68, 0.14)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            {actionError}
          </Alert>
        )}

        <LiveAlerts
          liveAlerts={liveAlerts}
          dueBookings={dueBookings}
          onDismissAlerts={() => setLiveAlerts([])}
        />

        <HostFloor
          now={now}
          units={units}
          bookings={bookings}
          covers={covers}
          revenue={revenue}
          activeTab="floor"
          stats={stats}
          dueBookings={dueBookings}
          sections={sections}
          onSelectUnit={handleSelectUnit}
          onToggleTab={(tab) => {
            if (tab === 'bookings') router.push('/hostess/reservations')
          }}
          onToggleStats={() => setStats(!stats)}
          onToggleArrival={toggleArrival}
          onOpenNewBooking={() => openNewBooking()}
          onOpenMergeTables={() => setModal('merge')}
        />
      </Box>

      {/* Hostess Fast 1-Tap Action Sheet */}
      <QuickTableModal
        open={modal === 'quick'}
        selectedUnitId={selectedUnitId}
        units={units}
        selected={selected}
        bookings={bookings}
        onClose={() => setModal(null)}
        onQuickSeatWalkIn={handleQuickSeatWalkIn}
        onSeatReservation={handleSeatReservationFromQuick}
        onQuickRelease={handleRelease}
        onCompleteWithBill={(unitId, billVal) => {
          completeSeating(unitId, billVal)
          setModal(null)
          setSelectedUnitId(null)
        }}
        onMarkReady={handleMarkReadyFromQuick}
        onOpenFullBooking={(unitId) => openNewBooking(unitId)}
      />

      {/* Booking / In-Prep Edit Drawer */}
      <BookingModal
        isOpen={modal === 'booking'}
        bookingForm={bookingForm}
        matchedCustomer={matchedCustomer}
        appliedCustomerId={appliedCustomerId}
        occasionTags={occasionTags}
        shownUnits={units}
        editingBookingId={editingBookingId}
        onFormChange={setBookingForm}
        onSearchSourceChange={setSearchSource}
        onApplyProfile={applyMatchedCustomer}
        onSave={handleSaveBooking}
        onClose={() => setModal(null)}
        onSeatNow={() => selectedUnitId && handleSeatPrep(selectedUnitId)}
        onReleaseTable={() => selectedUnitId && handleRelease(selectedUnitId)}
      />

      {/* Complete Seating / Bill Modal */}
      <CompleteSeatingModal
        open={modal === 'complete'}
        selected={selected}
        bill={bill}
        onBillChange={setBill}
        onClose={() => setModal(null)}
        onComplete={handleCompleteSeatingSubmit}
      />

      {/* Merge Tables Modal */}
      <MergeTablesModal
        isOpen={modal === 'merge'}
        units={units}
        mergeSet={mergeSet}
        onToggleUnit={handleToggleMergeUnit}
        onClose={() => setModal(null)}
        onConfirmMerge={handleConfirmMerge}
      />
    </Box>
  )
}
