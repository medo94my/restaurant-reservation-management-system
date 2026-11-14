'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useDiningStore } from '@/lib/dining-store'
import type { Booking, Unit } from '@/lib/restaurant-config'
import { ResponsiveDrawer } from '../responsive-drawer'
import { Icon, fmtTime } from '../ui-helpers'
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Paper,
  Divider,
  InputAdornment,
} from '@mui/material'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import EditNoteIcon from '@mui/icons-material/EditNote'

type Props = {
  open: boolean
  selectedUnitId?: string | null
  units?: Unit[]
  selected?: Unit | null
  bookings: Booking[]
  onClose: () => void
  onQuickSeatWalkIn: (unitId: string, pax: number, guestName?: string) => void
  onSeatReservation: (bookingId: number, unitId: string) => void
  onQuickRelease: (unitId: string) => void
  onCompleteWithBill: (unitId: string, bill: number) => void
  onMarkReady: (unitId: string) => void
  onOpenFullBooking: (unitId: string) => void
}

const statusBadgeMeta: Record<Unit['status'], { label: string; color: string; bg: string; border: string }> = {
  available: { label: 'Available · Ready to Seat', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.3)' },
  seated: { label: 'Seated · In Service', color: '#a5b4fc', bg: 'rgba(129, 140, 248, 0.14)', border: 'rgba(129, 140, 248, 0.35)' },
  prep: { label: 'Needs Prep / Turn', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(251, 191, 36, 0.35)' },
  blocked: { label: 'Blocked / Out of Service', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.12)', border: 'rgba(156, 163, 175, 0.25)' },
}

export function QuickTableModal({
  open,
  selectedUnitId,
  units,
  selected: selectedProp,
  bookings,
  onClose,
  onQuickSeatWalkIn,
  onSeatReservation,
  onQuickRelease,
  onCompleteWithBill,
  onMarkReady,
  onOpenFullBooking,
}: Props) {
  const storeUnits = useDiningStore((s) => s.units)
  const resolvedUnitId = selectedUnitId ?? selectedProp?.id ?? null

  const selected = useMemo(() => {
    if (!resolvedUnitId) return null
    const pool = units ?? storeUnits
    return pool.find((u) => u.id === resolvedUnitId) ?? selectedProp ?? null
  }, [resolvedUnitId, units, storeUnits, selectedProp])

  const [walkInPax, setWalkInPax] = useState<number>(2)
  const [walkInName, setWalkInName] = useState<string>('')
  const [billAmount, setBillAmount] = useState<string>('')

  // Reset local form inputs only when the selected unit ID changes or modal re-opens
  useEffect(() => {
    if (selected && open) {
      setWalkInPax(Math.min(selected.capacity, Math.max(1, selected.capacity > 2 ? 2 : selected.capacity)))
      setWalkInName('')
      setBillAmount('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUnitId, open])

  if (!selected) return null

  const statusMeta = statusBadgeMeta[selected.status] || statusBadgeMeta.available

  // Find reservations that are assigned to this unit OR unassigned and due
  const relevantBookings = bookings.filter(
    (b) => b.unit === selected.id || b.unit.includes('unassigned')
  )

  const handleSeatWalkInSubmit = () => {
    onQuickSeatWalkIn(selected.id, walkInPax, walkInName.trim() || undefined)
    onClose()
  }

  const handleBillSubmit = () => {
    onCompleteWithBill(selected.id, billAmount ? Number(billAmount) : 0)
    onClose()
  }

  return (
    <ResponsiveDrawer
      open={open}
      onClose={onClose}
      eyebrow={`${selected.kind.toUpperCase()} · ${selected.capacity} SEATS`}
      title={`Table ${selected.id}`}
      subtitle={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Chip
            size="small"
            label={statusMeta.label}
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: statusMeta.color,
              bgcolor: statusMeta.bg,
              border: `1px solid ${statusMeta.border}`,
            }}
          />
        </Box>
      }
      aria-labelledby="quick-table-title"
      width={460}
    >
      <Box sx={{ py: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* =================================================================== */}
        {/* CASE 1: AVAILABLE TABLE */}
        {/* =================================================================== */}
        {selected.status === 'available' && (
          <>
            {/* Quick Walk-In Seating Card */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                bgcolor: '#161b17',
                borderColor: 'rgba(215, 180, 106, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FlashOnIcon sx={{ color: '#d7b46a', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ color: '#f5f2eb', fontWeight: 700, fontSize: '0.9rem' }}>
                  Quick Seat Walk-In
                </Typography>
              </Box>

              {/* Party Size Selector */}
              <Box>
                <Typography variant="caption" sx={{ color: '#9da49a', fontWeight: 600, display: 'block', mb: 1 }}>
                  Party Size (Capacity: {selected.capacity})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5, 6, 8].map((size) => {
                    const isSelected = walkInPax === size
                    const isOverCapacity = size > selected.capacity
                    return (
                      <Button
                        key={size}
                        size="small"
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => setWalkInPax(size)}
                        aria-label={`Select party size ${size} guests`}
                        sx={{
                          minWidth: 42,
                          height: 42,
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          borderRadius: '6px',
                          bgcolor: isSelected ? '#d7b46a' : 'transparent',
                          color: isSelected ? '#1a1811' : isOverCapacity ? '#f87171' : '#eee9df',
                          borderColor: isSelected
                            ? '#d7b46a'
                            : isOverCapacity
                              ? 'rgba(248, 113, 113, 0.4)'
                              : 'rgba(255, 255, 255, 0.12)',
                          '&:hover': {
                            bgcolor: isSelected ? '#e4c77e' : 'rgba(215, 180, 106, 0.1)',
                          },
                        }}
                      >
                        {size}
                      </Button>
                    )
                  })}
                </Box>
                {walkInPax > selected.capacity && (
                  <Typography variant="caption" sx={{ color: '#f87171', display: 'block', mt: 0.5, fontSize: '0.72rem' }}>
                    Note: Party of {walkInPax} exceeds table capacity ({selected.capacity}).
                  </Typography>
                )}
              </Box>

              {/* Optional Guest Name */}
              <TextField
                size="small"
                label="Guest / Party Name (Optional)"
                placeholder="Walk-in Guest"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                slotProps={{
                  input: {
                    sx: {
                      color: '#f5f2eb',
                      bgcolor: '#111412',
                      fontSize: '0.875rem',
                    },
                  },
                  inputLabel: { sx: { color: '#8e968b', fontSize: '0.825rem' } },
                }}
              />

              {/* 1-Tap Seat Button */}
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleSeatWalkInSubmit}
                startIcon={<FlashOnIcon />}
                sx={{
                  bgcolor: '#d7b46a',
                  color: '#1a1811',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'none',
                  minHeight: 46,
                  borderRadius: '6px',
                  boxShadow: '0 4px 14px rgba(215, 180, 106, 0.25)',
                  '&:hover': {
                    bgcolor: '#e4c77e',
                  },
                }}
              >
                Seat {walkInPax} {walkInPax === 1 ? 'Guest' : 'Guests'} at Table {selected.id}
              </Button>
            </Paper>

            {/* Seat from Today's Upcoming Arrivals */}
            {relevantBookings.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ color: '#8e968b', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                  Seat From Pending Arrivals
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {relevantBookings.map((b) => (
                    <Paper
                      key={b.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: '#181d19',
                        borderColor: b.unit === selected.id ? 'rgba(215, 180, 106, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ color: '#f5f2eb', fontWeight: 700 }}>
                            {b.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${b.pax} pax`}
                            sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#eee9df' }}
                          />
                          {b.arrived && (
                            <Chip
                              size="small"
                              label="Arrived"
                              sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(74, 222, 128, 0.15)', color: '#4ade80' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: '#8e968b', display: 'block', mt: 0.25 }}>
                          {fmtTime(b.time)} {b.note ? `· ${b.note}` : ''}
                        </Typography>
                      </Box>

                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          onSeatReservation(b.id, selected.id)
                          onClose()
                        }}
                        startIcon={<CheckCircleOutlinedIcon sx={{ fontSize: 16 }} />}
                        sx={{
                          bgcolor: '#253528',
                          color: '#4ade80',
                          border: '1px solid rgba(74, 222, 128, 0.3)',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          minHeight: 36,
                          minWidth: 100,
                          '&:hover': { bgcolor: '#2e4332' },
                        }}
                      >
                        Seat Here
                      </Button>
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            {/* Link to Full Advanced Booking */}
            <Button
              variant="text"
              onClick={() => {
                onClose()
                onOpenFullBooking(selected.id)
              }}
              startIcon={<EditNoteIcon />}
              sx={{
                color: '#d7b46a',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                justifyContent: 'flex-start',
                p: 0,
                minHeight: 40,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Open Full Reservation Form (Phone, Occasions, CRM Lookup) →
            </Button>
          </>
        )}

        {/* =================================================================== */}
        {/* CASE 2: SEATED TABLE */}
        {/* =================================================================== */}
        {selected.status === 'seated' && (
          <>
            {/* Seated Guest Card */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: '#191b22',
                borderColor: 'rgba(129, 140, 248, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="h6" sx={{ color: '#f5f2eb', fontWeight: 700, fontSize: '1.05rem' }}>
                    {selected.guest || 'Seated Party'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#a5b4fc', fontWeight: 600, mt: 0.25 }}>
                    {selected.pax || selected.capacity} Guests · Table {selected.id}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={selected.time ? `Seated at ${selected.time}` : 'Active Service'}
                  sx={{
                    bgcolor: 'rgba(129, 140, 248, 0.15)',
                    color: '#c7d2fe',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                />
              </Box>

              {selected.note && (
                <Box sx={{ p: 1.25, bgcolor: 'rgba(0, 0, 0, 0.25)', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <Typography variant="caption" sx={{ color: '#d7b46a', fontWeight: 600, display: 'block' }}>
                    Dietary / Occasion Note:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#eee9df', fontSize: '0.8rem', mt: 0.25 }}>
                    {selected.note}
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Primary Fast Action: Clear & Release Table */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => {
                onQuickRelease(selected.id)
                onClose()
              }}
              startIcon={<CheckCircleOutlinedIcon />}
              sx={{
                bgcolor: '#223828',
                color: '#4ade80',
                border: '1px solid rgba(74, 222, 128, 0.4)',
                fontWeight: 700,
                fontSize: '0.9rem',
                textTransform: 'none',
                minHeight: 46,
                borderRadius: '6px',
                '&:hover': {
                  bgcolor: '#2a4732',
                },
              }}
            >
              Clear & Reset Table {selected.id} (Ready for Next Guest)
            </Button>

            {/* Optional Bill Close */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: '#161917',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ color: '#9da49a', fontWeight: 600 }}>
                Record Final Check / Receipt (Optional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  size="small"
                  placeholder="0.00"
                  type="number"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start" sx={{ color: '#d7b46a' }}>$</InputAdornment>,
                      sx: { color: '#f5f2eb', bgcolor: '#111412', fontSize: '0.875rem' },
                    },
                  }}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleBillSubmit}
                  startIcon={<ReceiptLongIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    color: '#d7b46a',
                    borderColor: 'rgba(215, 180, 106, 0.4)',
                    textTransform: 'none',
                    fontWeight: 700,
                    minHeight: 40,
                    whiteSpace: 'nowrap',
                    '&:hover': { borderColor: '#d7b46a', bgcolor: 'rgba(215, 180, 106, 0.1)' },
                  }}
                >
                  Save Bill & Free
                </Button>
              </Box>
            </Paper>

            <Button
              variant="text"
              onClick={() => {
                onClose()
                onOpenFullBooking(selected.id)
              }}
              startIcon={<EditNoteIcon />}
              sx={{
                color: '#8e968b',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                justifyContent: 'flex-start',
                p: 0,
                minHeight: 36,
                '&:hover': { color: '#d7b46a', textDecoration: 'underline' },
              }}
            >
              Edit Reservation Details →
            </Button>
          </>
        )}

        {/* =================================================================== */}
        {/* CASE 3: PREP / TURN TABLE */}
        {/* =================================================================== */}
        {selected.status === 'prep' && (
          <>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: '#1f1c16',
                borderColor: 'rgba(251, 191, 36, 0.35)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Typography variant="subtitle2" sx={{ color: '#f5f2eb', fontWeight: 700 }}>
                Table In Turnaround / Prep
              </Typography>
              <Typography variant="body2" sx={{ color: '#e5bd60', fontSize: '0.85rem' }}>
                Table is flagged for incoming reservation setup or cleaning.
              </Typography>
            </Paper>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => {
                onMarkReady(selected.id)
                onClose()
              }}
              startIcon={<CleaningServicesIcon />}
              sx={{
                bgcolor: '#223828',
                color: '#4ade80',
                border: '1px solid rgba(74, 222, 128, 0.4)',
                fontWeight: 700,
                fontSize: '0.9rem',
                textTransform: 'none',
                minHeight: 46,
                borderRadius: '6px',
                '&:hover': { bgcolor: '#2a4732' },
              }}
            >
              Mark Clean & Available Now
            </Button>

            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={() => {
                onClose()
                onOpenFullBooking(selected.id)
              }}
              startIcon={<PersonAddAlt1Icon />}
              sx={{
                color: '#d7b46a',
                borderColor: 'rgba(215, 180, 106, 0.4)',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'none',
                minHeight: 42,
                borderRadius: '6px',
                '&:hover': { borderColor: '#d7b46a', bgcolor: 'rgba(215, 180, 106, 0.1)' },
              }}
            >
              Assign or Seat Due Arrival →
            </Button>
          </>
        )}

        {/* =================================================================== */}
        {/* CASE 4: BLOCKED TABLE */}
        {/* =================================================================== */}
        {selected.status === 'blocked' && (
          <>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: '#191a19',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
              }}
            >
              <Typography variant="body2" sx={{ color: '#9da49a' }}>
                This table is currently blocked / reserved for offline maintenance or VIP block.
              </Typography>
            </Paper>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => {
                onQuickRelease(selected.id)
                onClose()
              }}
              startIcon={<CheckCircleOutlinedIcon />}
              sx={{
                bgcolor: '#d7b46a',
                color: '#1a1811',
                fontWeight: 700,
                textTransform: 'none',
                minHeight: 46,
                borderRadius: '6px',
                '&:hover': { bgcolor: '#e4c77e' },
              }}
            >
              Unblock & Make Table Available
            </Button>
          </>
        )}
      </Box>
    </ResponsiveDrawer>
  )
}
