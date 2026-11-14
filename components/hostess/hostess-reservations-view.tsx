'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import '@/app/dining-room.css'

import { useDiningStore } from '@/lib/dining-store'
import type { Reservation, ReservationStatus } from '@/lib/reservation-service'
import type { Booking, Unit } from '@/lib/restaurant-config'
import { HostessTopBar } from '@/components/hostess/hostess-top-bar'
import { LiveAlerts } from '@/components/live-alerts'
import { BookingModal } from '@/components/modals/booking-modal'
import { QuickTableModal } from '@/components/modals/quick-table-modal'
import { RunSheet } from '@/components/run-sheet'
import {
  DEFAULT_BOOKING_FORM,
  type BookingFormState,
  type LiveAlertNotification,
  type MatchedCustomer,
  fmtTime,
  formatServiceShift,
} from '@/components/ui-helpers'
import { useSession } from '@/lib/auth/client'

import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Tooltip,
  IconButton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import EditNoteIcon from '@mui/icons-material/EditNote'
import EventSeatIcon from '@mui/icons-material/EventSeat'

type BookingViewItem = Booking & {
  reservationId?: string
  reservationStatus?: ReservationStatus
}

function isoToTimeHHMM(isoString: string): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '19:00'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function timeHHMMToIso(timeStr: string, baseDate?: Date | null): string {
  const base = baseDate ? new Date(baseDate) : new Date()
  const match = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return base.toISOString()
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  base.setHours(hours, minutes, 0, 0)
  return base.toISOString()
}

function numericHashFromId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash) || 1
}

export function HostessReservationsView() {
  const router = useRouter()
  const { data: sessionData } = useSession()
  const currentStaff = sessionData?.user as { name?: string; role?: string; staffId?: string } | undefined

  // Global store data
  const units = useDiningStore((s) => s.units)
  const bookings = useDiningStore((s) => s.bookings)
  const customers = useDiningStore((s) => s.customers)
  const occasionTags = useDiningStore((s) => s.occasionTags)
  const now = useDiningStore((s) => s.clock)
  const covers = useDiningStore((s) => s.covers)
  const dueBookings = useDiningStore((s) => s.dueBookings)

  const toggleArrival = useDiningStore((s) => s.toggleArrival)
  const updateBooking = useDiningStore((s) => s.updateBooking)
  const updateUnit = useDiningStore((s) => s.updateUnit)
  const releaseTable = useDiningStore((s) => s.releaseTable)
  const bookTable = useDiningStore((s) => s.bookTable)

  // Local & API synced state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'seated' | 'pending'>('all')
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertNotification[]>([])
  const [apiReservations, setApiReservations] = useState<Reservation[]>([])
  const [bookingToReservationId, setBookingToReservationId] = useState<Record<number, string>>({})
  const [bookingStatusMap, setBookingStatusMap] = useState<Record<number, ReservationStatus>>({})
  const [seatedUnitBookingMap, setSeatedUnitBookingMap] = useState<Record<string, number | string>>({})

  // Modals state
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)
  const [isQuickOpen, setIsQuickOpen] = useState(false)
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [bookingForm, setBookingForm] = useState<BookingFormState>(DEFAULT_BOOKING_FORM)
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null)
  const [searchSource, setSearchSource] = useState<'phone' | 'name'>('phone')
  const [matchedCustomer, setMatchedCustomer] = useState<MatchedCustomer | null>(null)
  const [appliedCustomerId, setAppliedCustomerId] = useState<string | null>(null)

  const fetchReservationsFromApi = useCallback(async () => {
    try {
      const res = await fetch('/api/reservations', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { reservations?: Reservation[] }
      if (!Array.isArray(data.reservations)) return
      setApiReservations(data.reservations)
      setSeatedUnitBookingMap((prev) => {
        const next = { ...prev }
        for (const r of data.reservations!) {
          if (r.status === 'seated' && r.tableId) {
            next[r.tableId] = r.id
          }
        }
        return next
      })
    } catch {
      // Offline or unauthenticated fallback uses store state
    }
  }, [])

  useEffect(() => {
    void fetchReservationsFromApi()
  }, [fetchReservationsFromApi])

  // Merge store bookings with API reservations by ID mapping
  const mergedBookings = useMemo<BookingViewItem[]>(() => {
    const mappedStore: BookingViewItem[] = bookings.map((b) => {
      const linkedResId = bookingToReservationId[b.id]
      const linkedApi = linkedResId
        ? apiReservations.find((r) => r.id === linkedResId)
        : undefined
      return {
        ...b,
        reservationId: linkedResId,
        reservationStatus: linkedApi?.status ?? bookingStatusMap[b.id],
      }
    })

    const linkedIds = new Set(Object.values(bookingToReservationId))
    const extraApiBookings: BookingViewItem[] = apiReservations
      .filter(
        (r) =>
          !linkedIds.has(r.id) &&
          r.status !== 'cancelled' &&
          r.status !== 'completed' &&
          r.status !== 'no_show'
      )
      .map((r) => {
        const syntheticId = numericHashFromId(r.id)
        const unitObj = r.tableId ? units.find((u) => u.id === r.tableId) : undefined
        return {
          id: syntheticId,
          name: r.customerName || 'Guest',
          phone: r.customerPhone || '',
          pax: r.partySize,
          kind: unitObj?.kind ?? 'Table',
          tableType: unitObj?.kind === 'Table' ? unitObj.tableType : 'any',
          time: isoToTimeHHMM(r.reservationTime),
          note: r.notes || '',
          unit: r.tableId || 'Table · unassigned',
          arrived: r.status === 'confirmed' || r.status === 'seated',
          reservationId: r.id,
          reservationStatus: r.status,
        }
      })

    return [...mappedStore, ...extraApiBookings]
  }, [apiReservations, bookingStatusMap, bookingToReservationId, bookings, units])

  // Match seated state by reservation/booking ID and unit ID (never by guest === b.name)
  const isBookingSeated = useCallback(
    (b: BookingViewItem): boolean => {
      const assignedUnit = units.find((u) => u.id === b.unit && !u.archived)
      if (b.reservationStatus === 'seated' || bookingStatusMap[b.id] === 'seated') {
        return !assignedUnit || assignedUnit.status === 'seated'
      }
      if (!assignedUnit || assignedUnit.status !== 'seated') return false
      const ownerId = seatedUnitBookingMap[assignedUnit.id]
      if (ownerId !== undefined) {
        return ownerId === b.id || (b.reservationId !== undefined && ownerId === b.reservationId)
      }
      return false
    },
    [bookingStatusMap, seatedUnitBookingMap, units]
  )

  // Counts
  const arrivedCount = mergedBookings.filter((b) => b.arrived).length
  const seatedCount = units.filter((u) => !u.archived && u.status === 'seated').length
  const pendingCount = mergedBookings.filter((b) => !b.arrived && !isBookingSeated(b)).length
  const totalCovers = mergedBookings.reduce((sum, b) => sum + b.pax, 0)

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return [...mergedBookings]
      .sort((a, b) => a.time.localeCompare(b.time))
      .filter((b) => {
        const matchesSearch =
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.phone.includes(search) ||
          b.unit.toLowerCase().includes(search.toLowerCase()) ||
          (b.note && b.note.toLowerCase().includes(search.toLowerCase()))

        if (!matchesSearch) return false

        const isSeated = isBookingSeated(b)

        if (statusFilter === 'arrived') return Boolean(b.arrived) && !isSeated
        if (statusFilter === 'seated') return isSeated
        if (statusFilter === 'pending') return !b.arrived && !isSeated
        return true
      })
  }, [isBookingSeated, mergedBookings, search, statusFilter])

  // Open full booking modal
  const openNewBooking = (unitId?: string) => {
    setEditingBookingId(null)
    setBookingForm({
      ...DEFAULT_BOOKING_FORM,
      unitId: unitId || null,
      time: now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : DEFAULT_BOOKING_FORM.time,
    })
    setMatchedCustomer(null)
    setAppliedCustomerId(null)
    setIsBookingOpen(true)
  }

  // Edit existing booking
  const handleEditBooking = (b: BookingViewItem) => {
    setEditingBookingId(b.id)
    setBookingForm({
      guestName: b.name,
      phone: b.phone,
      pax: b.pax,
      kind: b.kind,
      tableType: b.tableType,
      time: b.time,
      note: b.note || '',
      unitId: b.unit.includes('unassigned') || b.unit.includes('assign') ? null : b.unit,
      occasionTags: b.occasionTags || [],
      customOccasion: b.customOccasion || '',
    })
    setMatchedCustomer(null)
    setAppliedCustomerId(null)
    setIsBookingOpen(true)
  }

  const ensureApiReservation = async (b: BookingViewItem, overrideTableId?: string | null): Promise<string | null> => {
    const existingResId = b.reservationId ?? bookingToReservationId[b.id]
    if (existingResId) return existingResId

    try {
      const unitId =
        overrideTableId !== undefined
          ? overrideTableId
          : b.unit.includes('unassigned') || b.unit.includes('assign')
            ? null
            : b.unit
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: appliedCustomerId || `cust-${b.phone.replace(/\D/g, '') || b.id}`,
          customerName: b.name,
          customerPhone: b.phone,
          partySize: b.pax,
          reservationTime: timeHHMMToIso(b.time, now),
          tableId: unitId,
          notes: b.note,
        }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { reservation?: Reservation }
      if (data.reservation?.id) {
        const resId = data.reservation.id
        setBookingToReservationId((prev) => ({ ...prev, [b.id]: resId }))
        setApiReservations((prev) => [...prev.filter((r) => r.id !== resId), data.reservation!])
        return resId
      }
    } catch {
      // Ignore network error
    }
    return null
  }

  const handleToggleArrivalSync = async (b: BookingViewItem) => {
    const nextArrived = !b.arrived
    toggleArrival(b.id)
    const nextStatus: ReservationStatus = nextArrived ? 'confirmed' : 'booked'
    setBookingStatusMap((prev) => ({ ...prev, [b.id]: nextStatus }))

    const resId = await ensureApiReservation(b)
    if (resId) {
      try {
        const resp = await fetch(`/api/reservations/${resId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: nextArrived ? 'confirm' : 'booked' }),
        })
        if (resp.ok) {
          const data = (await resp.json()) as { reservation?: Reservation }
          if (data.reservation) {
            setApiReservations((prev) =>
              prev.map((r) => (r.id === resId ? data.reservation! : r))
            )
          }
        }
      } catch {
        // Ignore network error
      }
    }
  }

  const handleSaveBooking = async () => {
    if (!bookingForm.guestName.trim()) return

    if (editingBookingId) {
      const existingItem = mergedBookings.find((b) => b.id === editingBookingId)
      updateBooking(editingBookingId, {
        name: bookingForm.guestName,
        phone: bookingForm.phone,
        pax: bookingForm.pax,
        kind: bookingForm.kind,
        tableType: bookingForm.tableType,
        time: bookingForm.time,
        note: bookingForm.note,
        unitId: bookingForm.unitId || undefined,
        occasionTags: bookingForm.occasionTags,
        customOccasion: bookingForm.customOccasion,
      })

      const resId =
        existingItem?.reservationId ?? bookingToReservationId[editingBookingId] ?? null
      if (resId) {
        try {
          const resp = await fetch(`/api/reservations/${resId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              customerName: bookingForm.guestName.trim(),
              customerPhone: bookingForm.phone.trim(),
              partySize: bookingForm.pax,
              reservationTime: timeHHMMToIso(bookingForm.time, now),
              tableId: bookingForm.unitId || null,
              notes: bookingForm.note,
            }),
          })
          if (resp.ok) {
            const data = (await resp.json()) as { reservation?: Reservation }
            if (data.reservation) {
              setApiReservations((prev) =>
                prev.map((r) => (r.id === resId ? data.reservation! : r))
              )
            }
          }
        } catch {
          // Ignore network error
        }
      } else if (existingItem) {
        await ensureApiReservation(
          {
            ...existingItem,
            name: bookingForm.guestName.trim(),
            phone: bookingForm.phone.trim(),
            pax: bookingForm.pax,
            time: bookingForm.time,
            note: bookingForm.note,
            unit: bookingForm.unitId || `${bookingForm.kind} · unassigned`,
          },
          bookingForm.unitId || null
        )
      }
    } else {
      const createdBooking = bookTable({
        name: bookingForm.guestName,
        phone: bookingForm.phone,
        pax: bookingForm.pax,
        kind: bookingForm.kind,
        tableType: bookingForm.tableType,
        time: bookingForm.time,
        note: bookingForm.note,
        unitId: bookingForm.unitId || undefined,
        occasionTags: bookingForm.occasionTags,
        customOccasion: bookingForm.customOccasion,
      })

      try {
        const resp = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId:
              appliedCustomerId ||
              matchedCustomer?.id ||
              `cust-${bookingForm.phone.replace(/\D/g, '') || Date.now()}`,
            customerName: bookingForm.guestName.trim(),
            customerPhone: bookingForm.phone.trim(),
            partySize: bookingForm.pax,
            reservationTime: timeHHMMToIso(bookingForm.time, now),
            tableId: bookingForm.unitId || null,
            notes: bookingForm.note,
          }),
        })
        if (resp.ok) {
          const data = (await resp.json()) as { reservation?: Reservation }
          if (data.reservation) {
            const resObj = data.reservation
            if (createdBooking) {
              setBookingToReservationId((prev) => ({ ...prev, [createdBooking.id]: resObj.id }))
              setBookingStatusMap((prev) => ({ ...prev, [createdBooking.id]: resObj.status }))
            }
            setApiReservations((prev) => [...prev.filter((r) => r.id !== resObj.id), resObj])
          }
        }
      } catch {
        // Ignore network error
      }
    }

    setIsBookingOpen(false)
  }

  // 1-Tap Seat Reservation (never overwrites an already-seated unit; matches by reservation/unit ID)
  const handleSeatReservationDirect = async (booking: BookingViewItem) => {
    if (isBookingSeated(booking)) return

    const assignedUnit = units.find((u) => u.id === booking.unit && !u.archived)
    let targetUnit: Unit | undefined

    if (assignedUnit) {
      if (assignedUnit.status === 'seated' || assignedUnit.status === 'blocked') {
        setLiveAlerts((prev) => [
          {
            id: `seat-conflict-${Date.now()}`,
            type: 'prep_due',
            title: `${assignedUnit.id} Unavailable`,
            message: `${assignedUnit.id} is already ${assignedUnit.status}. Please assign ${booking.name} to an available unit.`,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 4),
        ])
        handleEditBooking(booking)
        return
      }
      targetUnit = assignedUnit
    } else {
      targetUnit = units.find(
        (u) => !u.archived && u.status === 'available' && u.capacity >= booking.pax
      )
      if (!targetUnit) {
        handleEditBooking(booking)
        return
      }
      updateBooking(booking.id, { unitId: targetUnit.id })
    }

    if (!booking.arrived) {
      toggleArrival(booking.id)
    }

    const bookingKey = booking.reservationId ?? booking.id
    setSeatedUnitBookingMap((prev) => ({ ...prev, [targetUnit!.id]: bookingKey }))
    setBookingStatusMap((prev) => ({ ...prev, [booking.id]: 'seated' }))

    updateUnit(targetUnit.id, {
      status: 'seated',
      guest: booking.name,
      pax: booking.pax,
      time: booking.time,
      note: booking.note,
    })

    const resId = await ensureApiReservation(booking, targetUnit.id)
    if (resId) {
      try {
        const resp = await fetch(`/api/reservations/${resId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'seat',
            tableId: targetUnit.id,
          }),
        })
        if (resp.ok) {
          const data = (await resp.json()) as { reservation?: Reservation }
          if (data.reservation) {
            setSeatedUnitBookingMap((prev) => ({
              ...prev,
              [targetUnit!.id]: data.reservation!.id,
            }))
            setApiReservations((prev) =>
              prev.map((r) => (r.id === resId ? data.reservation! : r))
            )
          }
        }
      } catch {
        // Ignore network error
      }
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0d0f0e', display: 'flex', flexDirection: 'column' }}>
      <HostessTopBar
        now={now}
        onOpenNewBooking={() => openNewBooking()}
        onPrintRunSheet={() => window.print()}
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
        <LiveAlerts
          liveAlerts={liveAlerts}
          dueBookings={dueBookings}
          onDismissAlerts={() => setLiveAlerts([])}
        />

        {/* Back Button & Page Header */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              component={Link}
              href="/hostess"
              size="small"
              startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
              sx={{
                color: '#d7b46a',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                px: 1.5,
                py: 0.5,
                borderRadius: '6px',
                bgcolor: 'rgba(215, 180, 106, 0.1)',
                border: '1px solid rgba(215, 180, 106, 0.25)',
                minHeight: 36,
                '&:hover': {
                  bgcolor: 'rgba(215, 180, 106, 0.2)',
                },
              }}
            >
              Back to Dining Room Floor Stand
            </Button>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'flex-end' },
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="overline"
                suppressHydrationWarning
                sx={{
                  color: '#d7b46a',
                  letterSpacing: '0.12em',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                {formatServiceShift(now)} · ARRIVALS DESK
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontWeight: 600,
                  color: '#f5f2eb',
                  mt: 0.25,
                }}
              >
                Arrivals &amp; Reservations
              </Typography>
              <Typography variant="body2" sx={{ color: '#8e968b', mt: 0.5 }}>
                Manage tonight&apos;s guest arrivals, seating assignments, and physical run sheet.
              </Typography>
            </Box>

            {/* Shift Stat Pills */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {[
                { label: 'Bookings', value: mergedBookings.length },
                { label: 'Arrived', value: arrivedCount, color: '#4ade80' },
                { label: 'Seated', value: seatedCount, color: '#a5b4fc' },
                { label: 'Total Covers', value: `${totalCovers} guests` },
              ].map((item) => (
                <Paper
                  key={item.label}
                  variant="outlined"
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: '6px',
                    bgcolor: '#161a17',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#8e968b', fontSize: '0.7rem', display: 'block' }}>
                    {item.label}
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: item.color || '#f5f2eb', fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {item.value}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Filter & Action Controls Bar */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: '#141815',
            borderColor: 'rgba(215, 180, 106, 0.2)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', lg: 'center' },
            gap: 2,
          }}
        >
          {/* Left: Search & Filter Pills */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search guest, phone, table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#8e968b', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  sx: {
                    bgcolor: '#101211',
                    color: '#f5f2eb',
                    fontSize: '0.85rem',
                    minWidth: { xs: '100%', sm: 260 },
                  },
                },
              }}
            />

            {/* Status Pills */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${mergedBookings.length})` },
                { id: 'arrived', label: `Arrived (${arrivedCount})`, dot: '#4ade80' },
                { id: 'seated', label: `Seated (${seatedCount})`, dot: '#a5b4fc' },
                { id: 'pending', label: `Pending (${pendingCount})`, dot: '#9ca3af' },
              ].map((f) => {
                const isSelected = statusFilter === f.id
                return (
                  <Button
                    key={f.id}
                    size="small"
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => setStatusFilter(f.id as any)}
                    sx={{
                      minHeight: 34,
                      px: 1.5,
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      textTransform: 'none',
                      borderRadius: '20px',
                      bgcolor: isSelected ? 'rgba(215, 180, 106, 0.2)' : '#101211',
                      borderColor: isSelected ? '#d7b46a' : 'rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#f5f2eb' : '#9da49a',
                      '&:hover': {
                        bgcolor: 'rgba(215, 180, 106, 0.25)',
                        borderColor: '#d7b46a',
                      },
                    }}
                  >
                    {f.dot && (
                      <Box
                        component="span"
                        sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: f.dot, mr: 0.75 }}
                      />
                    )}
                    {f.label}
                  </Button>
                )
              })}
            </Box>
          </Box>

          {/* Right: Actions */}
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => window.print()}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
              sx={{
                color: '#d7b46a',
                borderColor: 'rgba(215, 180, 106, 0.35)',
                fontWeight: 600,
                fontSize: '0.82rem',
                textTransform: 'none',
                minHeight: 38,
                px: 2,
                borderRadius: '6px',
                '&:hover': { bgcolor: 'rgba(215, 180, 106, 0.12)', borderColor: '#d7b46a' },
              }}
            >
              Print Run Sheet
            </Button>

            <Button
              variant="contained"
              size="small"
              onClick={() => openNewBooking()}
              startIcon={<AddIcon sx={{ fontSize: 18 }} />}
              sx={{
                bgcolor: '#d7b46a',
                color: '#1a1811',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'none',
                minHeight: 38,
                px: 2,
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(215, 180, 106, 0.25)',
                '&:hover': { bgcolor: '#e4c77e' },
              }}
            >
              + New Reservation / Walk-In
            </Button>
          </Box>
        </Paper>

        {/* Interactive Reservation Records Table */}
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            bgcolor: '#141714',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            overflowX: 'auto',
          }}
        >
          <Table size="medium" aria-label="Interactive arrivals and reservations list">
            <TableHead>
              <TableRow sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', bgcolor: '#101311' }}>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  TIME
                </TableCell>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  GUEST &amp; PHONE
                </TableCell>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  PARTY
                </TableCell>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  TABLE ASSIGNMENT
                </TableCell>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  OCCASIONS &amp; NOTES
                </TableCell>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  ARRIVAL
                </TableCell>
                <TableCell align="right" sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  ACTIONS
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: '#8e968b' }}>
                    <Typography variant="body2">No reservations found matching your criteria.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings.map((b) => {
                  const assignedUnit = units.find((u) => u.id === b.unit && !u.archived)
                  const isSeated = isBookingSeated(b)
                  const isTableAvailable = assignedUnit?.status === 'available'
                  const isUnitOccupiedByOther =
                    !isSeated &&
                    Boolean(assignedUnit) &&
                    (assignedUnit?.status === 'seated' || assignedUnit?.status === 'blocked')

                  return (
                    <TableRow
                      key={b.reservationId ?? b.id}
                      hover
                      sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'rgba(215, 180, 106, 0.04) !important',
                        },
                      }}
                      onClick={() => handleEditBooking(b)}
                    >
                      {/* Time */}
                      <TableCell sx={{ color: '#f5f2eb', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                        {fmtTime(b.time)}
                      </TableCell>

                      {/* Guest & Phone */}
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#f5f2eb', fontWeight: 700 }}>
                          {b.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#8e968b', display: 'block', mt: 0.25 }}>
                          {b.phone}
                        </Typography>
                      </TableCell>

                      {/* Party */}
                      <TableCell>
                        <Chip
                          size="small"
                          label={`${b.pax} pax`}
                          sx={{
                            fontWeight: 700,
                            bgcolor: 'rgba(255, 255, 255, 0.08)',
                            color: '#eee9df',
                            fontSize: '0.75rem',
                          }}
                        />
                      </TableCell>

                      {/* Table Assignment */}
                      <TableCell>
                        {assignedUnit ? (
                          <Chip
                            size="small"
                            label={`${assignedUnit.id} (${assignedUnit.capacity}s)`}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              color: isSeated ? '#a5b4fc' : isTableAvailable ? '#4ade80' : '#fbbf24',
                              bgcolor: isSeated
                                ? 'rgba(129, 140, 248, 0.12)'
                                : isTableAvailable
                                  ? 'rgba(74, 222, 128, 0.12)'
                                  : 'rgba(251, 191, 36, 0.12)',
                              border: `1px solid ${
                                isSeated
                                  ? 'rgba(129, 140, 248, 0.3)'
                                  : isTableAvailable
                                    ? 'rgba(74, 222, 128, 0.3)'
                                    : 'rgba(251, 191, 36, 0.3)'
                              }`,
                            }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="Unassigned"
                            sx={{
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              color: '#9da49a',
                              fontSize: '0.72rem',
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Occasions & Notes */}
                      <TableCell sx={{ maxWidth: 220 }}>
                        {b.occasionTags && b.occasionTags.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                            {b.occasionTags.map((tag) => (
                              <Chip
                                key={tag}
                                size="small"
                                label={tag}
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  bgcolor: 'rgba(215, 180, 106, 0.15)',
                                  color: '#d7b46a',
                                  border: '1px solid rgba(215, 180, 106, 0.25)',
                                }}
                              />
                            ))}
                          </Box>
                        )}
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ color: '#8e968b', display: 'block', maxWidth: 200 }}
                        >
                          {b.note || 'No notes'}
                        </Typography>
                      </TableCell>

                      {/* Arrival Toggle */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Box
                          component="label"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: b.arrived ? '#4ade80' : '#8e968b',
                            minHeight: 44,
                            px: 1,
                            py: 0.5,
                            borderRadius: '4px',
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
                          }}
                        >
                          <Checkbox
                            checked={!!b.arrived}
                            onChange={() => void handleToggleArrivalSync(b)}
                            size="small"
                            slotProps={{
                              input: { 'aria-label': `Toggle arrival for ${b.name}` },
                            }}
                            sx={{
                              color: 'rgba(215, 180, 106, 0.4)',
                              '&.Mui-checked': { color: '#4ade80' },
                              p: 0.5,
                            }}
                          />
                          <span style={{ fontWeight: b.arrived ? 700 : 500 }}>
                            {b.arrived ? 'Arrived' : 'Booked'}
                          </span>
                        </Box>
                      </TableCell>

                      {/* Quick Actions */}
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                          {isSeated ? (
                            <Chip
                              size="small"
                              label="Seated on Floor"
                              sx={{
                                height: 26,
                                bgcolor: 'rgba(129, 140, 248, 0.15)',
                                color: '#c7d2fe',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            />
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => void handleSeatReservationDirect(b)}
                              startIcon={<FlashOnIcon sx={{ fontSize: 16 }} />}
                              sx={{
                                bgcolor: isUnitOccupiedByOther ? '#382a1e' : '#223828',
                                color: isUnitOccupiedByOther ? '#fbbf24' : '#4ade80',
                                border: `1px solid ${
                                  isUnitOccupiedByOther
                                    ? 'rgba(251, 191, 36, 0.35)'
                                    : 'rgba(74, 222, 128, 0.35)'
                                }`,
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                textTransform: 'none',
                                minHeight: 32,
                                px: 1.5,
                                borderRadius: '4px',
                                '&:hover': { bgcolor: isUnitOccupiedByOther ? '#473626' : '#2b4733' },
                              }}
                            >
                              {isUnitOccupiedByOther
                                ? `Reassign (${assignedUnit?.id} Busy)`
                                : assignedUnit
                                  ? `Seat ${assignedUnit.id}`
                                  : 'Seat Party'}
                            </Button>
                          )}

                          <Tooltip title="Edit reservation details">
                            <IconButton
                              size="small"
                              onClick={() => handleEditBooking(b)}
                              aria-label={`Edit booking for ${b.name}`}
                              sx={{ color: '#8e968b', '&:hover': { color: '#d7b46a' } }}
                            >
                              <EditNoteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Printable Run Sheet Section for Kitchen Briefing */}
        <Box sx={{ display: 'none', '@media print': { display: 'block' } }}>
          <RunSheet now={now} bookings={mergedBookings} />
        </Box>
      </Box>

      {/* Booking Form Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        bookingForm={bookingForm}
        matchedCustomer={matchedCustomer}
        appliedCustomerId={appliedCustomerId}
        occasionTags={occasionTags}
        shownUnits={units}
        editingBookingId={editingBookingId}
        onFormChange={setBookingForm}
        onSearchSourceChange={setSearchSource}
        onApplyProfile={(matched) => {
          setBookingForm((prev) => ({
            ...prev,
            guestName: matched.name,
            phone: matched.phone,
            note: matched.note ? (prev.note ? `${prev.note} · ${matched.note}` : matched.note) : prev.note,
            occasionTags: Array.from(new Set([...prev.occasionTags, ...(matched.occasionTags || [])])),
          }))
          setAppliedCustomerId(matched.id)
        }}
        onSave={() => void handleSaveBooking()}
        onClose={() => setIsBookingOpen(false)}
        onSeatNow={() => {
          if (editingBookingId) {
            const b = mergedBookings.find((item) => item.id === editingBookingId)
            if (b) void handleSeatReservationDirect(b)
          }
          setIsBookingOpen(false)
        }}
        onReleaseTable={() => {
          if (bookingForm.unitId) {
            const releasedUnitId = bookingForm.unitId
            releaseTable(releasedUnitId)
            setSeatedUnitBookingMap((prev) => {
              const next = { ...prev }
              delete next[releasedUnitId]
              return next
            })
            if (editingBookingId) {
              const existingItem = mergedBookings.find((b) => b.id === editingBookingId)
              const resId = existingItem?.reservationId ?? bookingToReservationId[editingBookingId]
              if (resId) {
                void fetch(`/api/reservations/${resId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'update', tableId: null }),
                }).catch(() => null)
              }
            }
          }
          setIsBookingOpen(false)
        }}
      />
    </Box>
  )
}
