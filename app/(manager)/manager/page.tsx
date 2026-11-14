'use client'

import React from 'react'
import Link from 'next/link'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined'
import EventSeatOutlinedIcon from '@mui/icons-material/EventSeatOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import ViewQuiltOutlinedIcon from '@mui/icons-material/ViewQuiltOutlined'
import LoyaltyOutlinedIcon from '@mui/icons-material/LoyaltyOutlined'
import { useDiningStore } from '@/lib/dining-store'
import { useBranding } from '@/components/shared/branding-context'

function parseTimeToMinutes(timeStr: string): number {
  const trimmed = timeStr.trim().toUpperCase()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/)
  if (!match) return Number.MAX_SAFE_INTEGER

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const period = match[3]

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return Number.MAX_SAFE_INTEGER
  }

  if (period === 'AM') {
    if (hours === 12) hours = 0
  } else if (period === 'PM') {
    if (hours !== 12) hours += 12
  }

  return hours * 60 + minutes
}

export default function ManagerOverviewPage() {
  const { branding } = useBranding()
  const units = useDiningStore((s) => s.units)
  const bookings = useDiningStore((s) => s.bookings)
  const covers = useDiningStore((s) => s.covers)
  const revenue = useDiningStore((s) => s.revenue)
  const dueBookings = useDiningStore((s) => s.dueBookings)

  const shownUnits = units.filter((u) => !u.archived)
  const seatedCount = shownUnits.filter((u) => u.status === 'seated' || u.status === 'prep').length
  const availableCount = shownUnits.filter((u) => u.status === 'available').length
  const blockedCount = shownUnits.filter((u) => u.status === 'blocked').length
  const totalUnits = shownUnits.length
  const occupancyPercent = totalUnits > 0 ? Math.round((seatedCount / totalUnits) * 100) : 0

  const sortedBookings = [...bookings].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
  )

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
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
          Executive Operations Overview
        </Typography>
        <Typography variant="body2" sx={{ color: '#9da49a' }}>
          Real-time dining room performance, floor utilization, and service metrics for {branding.restaurantName}.
        </Typography>
      </Box>

      {/* KPI Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#889186', fontWeight: 600, letterSpacing: 0.5 }}>
                COVERS SEATED
              </Typography>
              <Typography variant="h4" sx={{ color: '#eee9df', fontWeight: 700, my: 0.5 }}>
                {covers}
              </Typography>
              <Typography variant="caption" sx={{ color: '#7cb382' }}>
                Active guests in dining room
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#889186', fontWeight: 600, letterSpacing: 0.5 }}>
                TOTAL REVENUE
              </Typography>
              <Typography variant="h4" sx={{ color: branding.primaryColor || '#d7b46a', fontWeight: 700, my: 0.5 }}>
                ${revenue.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9da49a' }}>
                Completed service checks
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#889186', fontWeight: 600, letterSpacing: 0.5 }}>
                BOOKINGS TODAY
              </Typography>
              <Typography variant="h4" sx={{ color: '#eee9df', fontWeight: 700, my: 0.5 }}>
                {bookings.length}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9da49a' }}>
                {dueBookings.length} upcoming arrivals
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#889186', fontWeight: 600, letterSpacing: 0.5 }}>
                FLOOR OCCUPANCY
              </Typography>
              <Typography variant="h4" sx={{ color: '#eee9df', fontWeight: 700, my: 0.5 }}>
                {occupancyPercent}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#7cb382' }}>
                {seatedCount} of {totalUnits} units active
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Utilization & Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 2 }}>
                Floor Unit Allocation
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: '#b0b6ad' }}>
                    Seated / In Prep: {seatedCount} units
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#b0b6ad' }}>
                    Available: {availableCount} units
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={occupancyPercent}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: '#252b27',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: branding.primaryColor || '#d7b46a',
                      borderRadius: 5,
                    },
                  }}
                />
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ p: 2, bgcolor: '#202421', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#7cb382', fontWeight: 700 }}>
                      {seatedCount}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#889186' }}>
                      Seated / Prep
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ p: 2, bgcolor: '#202421', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#eee9df', fontWeight: 700 }}>
                      {availableCount}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#889186' }}>
                      Available
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ p: 2, bgcolor: '#202421', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#e07d72', fontWeight: 700 }}>
                      {blockedCount}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#889186' }}>
                      Blocked
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 2 }}>
                Management Shortcuts
              </Typography>

              <Stack spacing={1.5}>
                <Button
                  component={Link}
                  href="/manager/branding"
                  variant="outlined"
                  fullWidth
                  startIcon={<PaletteOutlinedIcon sx={{ color: branding.primaryColor || '#d7b46a' }} />}
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  sx={{
                    justifyContent: 'space-between',
                    borderColor: '#343a35',
                    color: '#eee9df',
                    py: 1.25,
                    borderRadius: 2,
                    textTransform: 'none',
                    '&:hover': { borderColor: branding.primaryColor || '#d7b46a' },
                  }}
                >
                  Configure Restaurant Branding
                </Button>

                <Button
                  component={Link}
                  href="/manager/staff"
                  variant="outlined"
                  fullWidth
                  startIcon={<PeopleAltOutlinedIcon sx={{ color: '#7cb382' }} />}
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  sx={{
                    justifyContent: 'space-between',
                    borderColor: '#343a35',
                    color: '#eee9df',
                    py: 1.25,
                    borderRadius: 2,
                    textTransform: 'none',
                    '&:hover': { borderColor: '#7cb382' },
                  }}
                >
                  Staff Accounts & Access Control
                </Button>

                <Button
                  component={Link}
                  href="/manager/floor-plan"
                  variant="outlined"
                  fullWidth
                  startIcon={<ViewQuiltOutlinedIcon sx={{ color: '#9da49a' }} />}
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  sx={{
                    justifyContent: 'space-between',
                    borderColor: '#343a35',
                    color: '#eee9df',
                    py: 1.25,
                    borderRadius: 2,
                    textTransform: 'none',
                    '&:hover': { borderColor: '#9da49a' },
                  }}
                >
                  Edit Floor Plan & Table Layout
                </Button>

                <Button
                  component={Link}
                  href="/manager/guests"
                  variant="outlined"
                  fullWidth
                  startIcon={<LoyaltyOutlinedIcon sx={{ color: '#b4a0e0' }} />}
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  sx={{
                    justifyContent: 'space-between',
                    borderColor: '#343a35',
                    color: '#eee9df',
                    py: 1.25,
                    borderRadius: 2,
                    textTransform: 'none',
                    '&:hover': { borderColor: '#b4a0e0' },
                  }}
                >
                  Guest CRM & VIP Tiers
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Upcoming Arrivals Summary */}
      <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600 }}>
              Today's Upcoming Arrivals
            </Typography>
            <Button
              component={Link}
              href="/manager/reservations"
              size="small"
              endIcon={<ArrowForwardIcon fontSize="small" />}
              sx={{ color: branding.primaryColor || '#d7b46a', textTransform: 'none' }}
            >
              View All ({bookings.length})
            </Button>
          </Box>

          <TableContainer>
            <Table size="small" aria-label="Today's reservations overview">
              <TableHead sx={{ bgcolor: '#202421' }}>
                <TableRow>
                  <TableCell sx={{ color: '#889186', fontWeight: 600 }}>TIME</TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600 }}>GUEST</TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600 }}>PAX</TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600 }}>TABLE / UNIT</TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600 }}>NOTES & OCCASIONS</TableCell>
                  <TableCell sx={{ color: '#889186', fontWeight: 600 }}>STATUS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBookings.slice(0, 6).map((b) => (
                  <TableRow key={b.id} sx={{ borderColor: '#2b302c' }}>
                    <TableCell sx={{ color: branding.primaryColor || '#d7b46a', fontWeight: 700 }}>
                      {b.time}
                    </TableCell>
                    <TableCell sx={{ color: '#eee9df', fontWeight: 600 }}>{b.name}</TableCell>
                    <TableCell sx={{ color: '#b0b6ad' }}>{b.pax} guests</TableCell>
                    <TableCell sx={{ color: '#b0b6ad' }}>{b.unit}</TableCell>
                    <TableCell sx={{ color: '#889186', fontSize: '0.82rem' }}>
                      {b.note || '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={b.arrived ? 'Arrived' : 'Booked'}
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          bgcolor: b.arrived ? 'rgba(124, 179, 130, 0.15)' : 'rgba(215, 180, 106, 0.12)',
                          color: b.arrived ? '#7cb382' : branding.primaryColor || '#d7b46a',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
