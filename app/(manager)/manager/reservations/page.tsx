'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Button,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useDiningStore } from '@/lib/dining-store'
import type { Reservation, ReservationStatus } from '@/lib/reservation-service'
import type { Booking } from '@/lib/restaurant-config'
import { useBranding } from '@/components/shared/branding-context'

type ManagerBookingItem = Booking & {
  reservationId?: string
  reservationStatus?: ReservationStatus
}

function isoToTimeHHMM(isoString: string): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '19:00'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function timeHHMMToIso(timeStr: string): string {
  const base = new Date()
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

export default function ManagerReservationsPage() {
  const { branding } = useBranding()
  const bookings = useDiningStore((s) => s.bookings)
  const toggleArrival = useDiningStore((s) => s.toggleArrival)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'pending'>('all')
  const [apiReservations, setApiReservations] = useState<Reservation[]>([])
  const [bookingToReservationId, setBookingToReservationId] = useState<Record<number, string>>({})

  const fetchReservations = useCallback(async () => {
    try {
      const res = await fetch('/api/reservations', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { reservations?: Reservation[] }
      if (Array.isArray(data.reservations)) {
        setApiReservations(data.reservations)
      }
    } catch {
      // Offline fallback uses store bookings
    }
  }, [])

  useEffect(() => {
    void fetchReservations()
  }, [fetchReservations])

  const mergedBookings = useMemo<ManagerBookingItem[]>(() => {
    const mappedStore: ManagerBookingItem[] = bookings.map((b) => {
      const linkedId = bookingToReservationId[b.id]
      const linkedApi = linkedId ? apiReservations.find((r) => r.id === linkedId) : undefined
      return {
        ...b,
        reservationId: linkedId,
        reservationStatus: linkedApi?.status,
      }
    })

    const linkedSet = new Set(Object.values(bookingToReservationId))
    const extraApi: ManagerBookingItem[] = apiReservations
      .filter((r) => !linkedSet.has(r.id) && r.status !== 'cancelled' && r.status !== 'no_show')
      .map((r) => ({
        id: numericHashFromId(r.id),
        name: r.customerName || 'Guest',
        phone: r.customerPhone || '',
        pax: r.partySize,
        kind: 'Table',
        tableType: 'any',
        time: isoToTimeHHMM(r.reservationTime),
        note: r.notes || '',
        unit: r.tableId || 'Table · unassigned',
        arrived: r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed',
        reservationId: r.id,
        reservationStatus: r.status,
      }))

    return [...mappedStore, ...extraApi]
  }, [apiReservations, bookingToReservationId, bookings])

  const handleToggleArrival = async (b: ManagerBookingItem) => {
    const nextArrived = !b.arrived
    toggleArrival(b.id)

    let resId = b.reservationId ?? bookingToReservationId[b.id]
    if (!resId) {
      try {
        const createRes = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: `cust-${b.phone.replace(/\D/g, '') || b.id}`,
            customerName: b.name,
            customerPhone: b.phone,
            partySize: b.pax,
            reservationTime: timeHHMMToIso(b.time),
            tableId: b.unit.includes('unassigned') || b.unit.includes('assign') ? null : b.unit,
            notes: b.note,
          }),
        })
        if (createRes.ok) {
          const created = (await createRes.json()) as { reservation?: Reservation }
          if (created.reservation?.id) {
            resId = created.reservation.id
            setBookingToReservationId((prev) => ({ ...prev, [b.id]: resId! }))
            setApiReservations((prev) => [...prev.filter((r) => r.id !== resId), created.reservation!])
          }
        }
      } catch {
        // Ignore network error
      }
    }

    if (resId) {
      try {
        const resp = await fetch(`/api/reservations/${resId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: nextArrived ? 'confirm' : 'booked' }),
        })
        if (resp.ok) {
          const updated = (await resp.json()) as { reservation?: Reservation }
          if (updated.reservation) {
            setApiReservations((prev) =>
              prev.map((r) => (r.id === resId ? updated.reservation! : r))
            )
          }
        }
      } catch {
        // Ignore network error
      }
    }
  }

  const filteredBookings = mergedBookings.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.phone.includes(search) ||
      b.unit.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false

    if (statusFilter === 'arrived') return b.arrived
    if (statusFilter === 'pending') return !b.arrived
    return true
  })

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: `var(--brand-font, ${branding.fontFamily || 'Cinzel'}), serif`,
              color: '#eee9df',
              fontWeight: 700,
              letterSpacing: 1,
              mb: 0.5,
            }}
          >
            Master Reservations
          </Typography>
          <Typography variant="body2" sx={{ color: '#9da49a' }}>
            Full reservation run list, guest arrival tracking, and floor assignments.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search guest, phone, table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              htmlInput: {
                'aria-label': 'Search reservations by guest name, phone, or table',
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#889186', fontSize: 18 }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: 260 }}
          />

          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'arrived' | 'pending')}
            inputProps={{
              'aria-label': 'Filter reservations by status',
            }}
            sx={{ width: 140 }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="arrived">Arrived</MenuItem>
          </Select>
        </Box>
      </Box>

      <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table aria-label="Master reservations table">
              <TableHead sx={{ bgcolor: '#202421' }}>
                <TableRow>
                  <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                    TIME
                  </TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                    GUEST NAME
                  </TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                    PHONE
                  </TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                    PAX
                  </TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                    ASSIGNED UNIT
                  </TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                    NOTES & PREFERENCES
                  </TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                    STATUS
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}
                  >
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#889186' }}>
                      No reservations found matching current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((b) => (
                    <TableRow
                      key={b.reservationId ?? b.id}
                      sx={{
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' },
                        borderColor: '#2b302c',
                      }}
                    >
                      <TableCell
                        sx={{
                          color: branding.primaryColor || '#d7b46a',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}
                      >
                        {b.time}
                      </TableCell>
                      <TableCell sx={{ color: '#eee9df', fontWeight: 600 }}>{b.name}</TableCell>
                      <TableCell sx={{ color: '#889186', fontSize: '0.85rem' }}>
                        {b.phone || '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#b0b6ad' }}>{b.pax} guests</TableCell>
                      <TableCell sx={{ color: '#eee9df', fontWeight: 500 }}>{b.unit}</TableCell>
                      <TableCell sx={{ color: '#889186', fontSize: '0.82rem', maxWidth: 220 }}>
                        {b.note || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={b.arrived ? 'ARRIVED' : 'CONFIRMED'}
                          sx={{
                            height: 22,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            bgcolor: b.arrived
                              ? 'rgba(124, 179, 130, 0.15)'
                              : 'rgba(215, 180, 106, 0.15)',
                            color: b.arrived ? '#7cb382' : branding.primaryColor || '#d7b46a',
                            border: `1px solid ${
                              b.arrived
                                ? 'rgba(124, 179, 130, 0.3)'
                                : 'rgba(215, 180, 106, 0.3)'
                            }`,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => void handleToggleArrival(b)}
                          sx={{
                            borderColor: b.arrived ? '#7cb382' : '#444c45',
                            color: b.arrived ? '#7cb382' : '#eee9df',
                            textTransform: 'none',
                            fontSize: '0.78rem',
                            py: 0.25,
                            px: 1.25,
                          }}
                        >
                          {b.arrived ? 'Mark Pending' : 'Mark Arrived'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
