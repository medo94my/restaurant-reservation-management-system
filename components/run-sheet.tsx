'use client'

import React from 'react'
import type { Booking } from '@/lib/restaurant-config'
import { formatDateFull, fmtTime } from './ui-helpers'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material'

type Props = {
  now: Date | null
  bookings: Booking[]
}

function parseTimeToMinutes(timeStr: string): number {
  const trimmed = (timeStr || '').trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return 0
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

export function RunSheet({ now, bookings }: Props) {
  const sortedBookings = [...bookings].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
  )

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontWeight: 600,
            color: '#f5f2eb',
          }}
        >
          Saffron &amp; Cedar — Today&apos;s Run Sheet
        </Typography>
        <Typography variant="body2" suppressHydrationWarning sx={{ color: '#d7b46a', mt: 0.5 }}>
          Beirut · {formatDateFull(now)}
        </Typography>
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          bgcolor: '#191e1a',
          borderColor: 'rgba(255, 255, 255, 0.07)',
          borderRadius: '6px',
          overflowX: 'auto',
        }}
      >
        <Table size="small" aria-label="Today's reservation run sheet">
          <TableHead>
            <TableRow sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>TIME</TableCell>
              <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>GUEST NAME</TableCell>
              <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>PHONE</TableCell>
              <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>PAX</TableCell>
              <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>SEATING TYPE &amp; UNIT</TableCell>
              <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>SPECIAL NOTES</TableCell>
              <TableCell sx={{ color: '#8e968b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textAlign: 'center' }}>ARRIVED</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedBookings.map((b) => (
              <TableRow
                key={b.id}
                hover
                sx={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02) !important' },
                }}
              >
                <TableCell sx={{ color: '#d7b46a', fontWeight: 600, fontSize: '0.85rem' }}>
                  {fmtTime(b.time)}
                </TableCell>
                <TableCell sx={{ color: '#eee9df', fontWeight: 500, fontSize: '0.85rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <span>{b.name}</span>
                    {b.customOccasion && (
                      <Chip
                        size="small"
                        label={b.customOccasion}
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          bgcolor: 'rgba(215, 180, 106, 0.15)',
                          color: '#ebd29b',
                          border: '1px solid rgba(215, 180, 106, 0.3)',
                        }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.85rem' }}>
                  {b.phone}
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${b.pax} pax`}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      bgcolor: 'rgba(255, 255, 255, 0.06)',
                      color: '#eee9df',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#c4c9bf', fontSize: '0.85rem' }}>
                  {b.kind} · {b.unit}
                </TableCell>
                <TableCell sx={{ color: '#8e968b', fontSize: '0.82rem', fontStyle: b.note ? 'normal' : 'italic' }}>
                  {b.note || '—'}
                </TableCell>
                <TableCell sx={{ textAlign: 'center' }}>
                  <Chip
                    label={b.arrived ? 'ARRIVED' : 'PENDING'}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: b.arrived ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                      color: b.arrived ? '#4ade80' : '#8e968b',
                      border: `1px solid ${b.arrived ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
