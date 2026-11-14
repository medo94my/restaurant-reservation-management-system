'use client'

import React from 'react'
import Link from 'next/link'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardActionArea,
  Chip,
  Paper,
  Button,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AddIcon from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import MapIcon from '@mui/icons-material/Map'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import type { Booking, Unit } from '@/lib/restaurant-config'
import { EditableFloorPlan } from './editable-floor-plan'
import { Icon, fmtTime, formatServiceShift } from './ui-helpers'

type DueBooking = {
  unit: string
  name: string
  mins: number
}

type Props = {
  now: Date | null
  units: Unit[]
  bookings: Booking[]
  covers: number
  revenue: number
  activeTab: 'floor' | 'bookings'
  stats: boolean
  dueBookings: DueBooking[]
  sections: Unit['kind'][]
  onSelectUnit: (unit: Unit) => void
  onToggleTab: (tab: 'floor' | 'bookings') => void
  onToggleStats: () => void
  onToggleArrival: (bookingId: number) => void
  onOpenNewBooking: () => void
  onOpenMergeTables?: () => void
}

const statusColors: Record<Unit['status'], { text: string; bg: string; border: string }> = {
  available: { text: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)', border: 'rgba(74, 222, 128, 0.25)' },
  seated: { text: '#a5b4fc', bg: 'rgba(129, 140, 248, 0.12)', border: 'rgba(129, 140, 248, 0.3)' },
  prep: { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' },
  blocked: { text: '#9ca3af', bg: 'rgba(156, 163, 175, 0.1)', border: 'rgba(156, 163, 175, 0.2)' },
}

export function HostFloor({
  now,
  units,
  bookings,
  covers,
  revenue,
  activeTab,
  stats,
  dueBookings,
  sections,
  onSelectUnit,
  onToggleTab,
  onToggleStats,
  onToggleArrival,
  onOpenNewBooking,
  onOpenMergeTables,
}: Props) {
  const [layoutView, setLayoutView] = React.useState<'canvas' | 'grid'>('canvas')
  const [statusFilter, setStatusFilter] = React.useState<Unit['status'] | 'all'>('all')
  const shownUnits = units.filter(u => !u.archived)
  const sortedBookings = [...bookings].sort((a, b) => a.time.localeCompare(b.time))

  const availableCount = shownUnits.filter((u) => u.status === 'available').length
  const seatedCount = shownUnits.filter((u) => u.status === 'seated').length
  const prepCount = shownUnits.filter((u) => u.status === 'prep').length

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          gap: 2,
          mb: 3,
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
            {formatServiceShift(now)}
          </Typography>
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontWeight: 600,
              color: '#f5f2eb',
              mt: 0.5,
            }}
          >
            The floor
          </Typography>
          <Typography variant="body2" sx={{ color: '#8e968b', mt: 0.5 }}>
            A clear view of every seat, every arrival.
          </Typography>
        </Box>

        {/* Header Stat Pills */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {[
            { label: 'Bookings', value: bookings.length, icon: 'event_seat' },
            { label: 'Covers', value: covers, icon: 'groups' },
            { label: 'Revenue', value: `$${revenue.toLocaleString()}`, icon: 'payments' },
          ].map((item) => (
            <Paper
              key={item.label}
              variant="outlined"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 2,
                py: 1,
                borderRadius: '6px',
                bgcolor: '#191e1a',
                borderColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <Box sx={{ color: '#d7b46a', display: 'flex', alignItems: 'center' }}>
                <Icon name={item.icon} size={20} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#8e968b', fontSize: '0.7rem', display: 'block' }}>
                  {item.label}
                </Typography>
                <Typography variant="subtitle2" sx={{ color: '#f5f2eb', fontWeight: 700, lineHeight: 1.2 }}>
                  {item.value}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>

      {/* Tabs & View Switcher */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, val) => onToggleTab(val)}
          sx={{
            minHeight: 48,
            '& .MuiTabs-indicator': {
              backgroundColor: '#d7b46a',
              height: 2,
            },
          }}
        >
          <Tab
            component={Link}
            href="/hostess"
            value="floor"
            icon={<Icon name="grid_view" size={18} />}
            iconPosition="start"
            label="Dining Room Floor"
            sx={{
              minHeight: 48,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#8e968b',
              '&.Mui-selected': { color: '#d7b46a' },
              '&:hover': { color: '#eee9df' },
            }}
          />
          <Tab
            component={Link}
            href="/hostess/reservations"
            value="bookings"
            icon={<Icon name="calendar_month" size={18} />}
            iconPosition="start"
            label={`Arrivals & Bookings (${bookings.length})`}
            sx={{
              minHeight: 48,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#8e968b',
              '&.Mui-selected': { color: '#d7b46a' },
              '&:hover': { color: '#eee9df' },
            }}
          />
        </Tabs>

        {activeTab === 'floor' && (
          <ToggleButtonGroup
            size="small"
            value={layoutView}
            exclusive
            onChange={(_, next) => {
              if (next) setLayoutView(next)
            }}
            sx={{
              bgcolor: '#191e1a',
              borderRadius: '6px',
              '& .MuiToggleButton-root': {
                color: '#8e968b',
                borderColor: 'rgba(215, 180, 106, 0.25)',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                py: 0.6,
                px: 1.5,
                '&.Mui-selected': {
                  color: '#1a1811',
                  bgcolor: '#d7b46a',
                  '&:hover': {
                    bgcolor: '#e4c77e',
                  },
                },
              },
            }}
          >
            <ToggleButton value="canvas">
              <MapIcon sx={{ fontSize: 16, mr: 0.75 }} />
              Floor Canvas
            </ToggleButton>
            <ToggleButton value="grid">
              <ViewModuleIcon sx={{ fontSize: 16, mr: 0.75 }} />
              Card Grid
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {activeTab === 'floor' ? (
        <>
          {/* Quick Status Filter & Quick Walk-In Action */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2.5,
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            {/* Status Filter Pills */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography
                variant="caption"
                sx={{
                  color: '#8e968b',
                  fontWeight: 700,
                  mr: 0.5,
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  letterSpacing: '0.08em',
                }}
              >
                Filter:
              </Typography>
              {[
                { id: 'all', label: `All (${shownUnits.length})`, dot: '#d7b46a' },
                { id: 'available', label: `Available (${availableCount})`, dot: '#4ade80' },
                { id: 'seated', label: `Seated (${seatedCount})`, dot: '#a5b4fc' },
                { id: 'prep', label: `Needs Turn (${prepCount})`, dot: '#fbbf24' },
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
                      bgcolor: isSelected ? 'rgba(215, 180, 106, 0.18)' : '#161a17',
                      borderColor: isSelected ? '#d7b46a' : 'rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#f5f2eb' : '#9da49a',
                      '&:hover': {
                        bgcolor: 'rgba(215, 180, 106, 0.25)',
                        borderColor: '#d7b46a',
                      },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: f.dot, mr: 1, display: 'inline-block' }}
                    />
                    {f.label}
                  </Button>
                )
              })}
            </Box>

            {/* Primary Fast Walk-In Action & Merge Tables */}
            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
              {onOpenMergeTables && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onOpenMergeTables}
                  startIcon={<Icon name="link" size={18} />}
                  sx={{
                    borderColor: 'rgba(215, 180, 106, 0.4)',
                    color: '#d7b46a',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    minHeight: 38,
                    px: 1.75,
                    borderRadius: '6px',
                    '&:hover': { borderColor: '#d7b46a', bgcolor: 'rgba(215, 180, 106, 0.1)' },
                  }}
                >
                  Combine Tables
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                onClick={onOpenNewBooking}
                startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                sx={{
                  bgcolor: '#d7b46a',
                  color: '#1a1811',
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: '0.85rem',
                  minHeight: 38,
                  px: 2,
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(215, 180, 106, 0.25)',
                  '&:hover': { bgcolor: '#e4c77e' },
                }}
              >
                + Quick Walk-In Seating
              </Button>
            </Box>
          </Box>

          {layoutView === 'canvas' ? (
            <Box sx={{ mb: 4 }}>
              <EditableFloorPlan
                items={shownUnits}
                editable={false}
                statusFilter={statusFilter}
                onActivate={onSelectUnit}
              />
            </Box>
          ) : (
            sections.map((section) => {
            const inSection = shownUnits.filter(
              (u) => u.kind === section && (statusFilter === 'all' || u.status === statusFilter)
            )
            if (inSection.length === 0) return null

            const seatedCount = inSection.filter((u) => u.status === 'seated').length
            const freeCount = inSection.filter((u) => u.status === 'available').length

            return (
              <Box key={section} sx={{ mb: 4 }}>
                {/* Section Head */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon
                      name={
                        section === 'Table'
                          ? 'table_restaurant'
                          : section === 'Couch'
                            ? 'weekend'
                            : 'meeting_room'
                      }
                      size={20}
                    />
                    <Typography variant="subtitle1" sx={{ color: '#f5f2eb', fontWeight: 600 }}>
                      {section === 'Table'
                        ? 'Dining Tables'
                        : section === 'Couch'
                          ? 'Lounge Couches'
                          : 'Private Dining Rooms'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8e968b', ml: 1 }}>
                      {seatedCount} seated · {freeCount} free
                    </Typography>
                  </Box>
                  <Chip
                    label={`${inSection.length} spaces`}
                    size="small"
                    sx={{ height: 22, fontSize: '0.72rem', bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#c4c9bf' }}
                  />
                </Box>

                {/* Units Grid */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(3, 1fr)',
                      md: 'repeat(4, 1fr)',
                      lg: 'repeat(6, 1fr)',
                    },
                    gap: 1.5,
                  }}
                >
                  {inSection.map((unit) => {
                    const statusMeta = statusColors[unit.status]
                    const dueBooking = dueBookings.find((b) => b.unit === unit.id)

                    return (
                      <Card
                        key={unit.id}
                        variant="outlined"
                        sx={{
                          bgcolor: '#191e1a',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '6px',
                          transition: 'border-color 0.15s, transform 0.15s',
                          '&:hover': {
                            borderColor: 'rgba(215, 180, 106, 0.4)',
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <CardActionArea
                          onClick={() => onSelectUnit(unit)}
                          aria-label={`Table ${unit.id}, ${unit.capacity} seats, status: ${unit.status}${unit.guest ? `, guest: ${unit.guest}, ${unit.pax} guests` : ''}`}
                          sx={{
                            p: 2,
                            height: '100%',
                            minHeight: 110,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            justifyContent: 'space-between',
                            gap: 1.25,
                            '&:focus-visible': {
                              outline: '2px solid #d7b46a',
                              outlineOffset: '2px',
                            },
                          }}
                        >
                          {/* Top Row: Unit ID & Capacity */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle2" sx={{ color: '#f5f2eb', fontWeight: 700 }}>
                              {unit.id}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#9da49a', fontSize: '0.72rem' }}>
                              {unit.capacity} seats
                            </Typography>
                          </Box>

                          {/* Status Chip */}
                          <Chip
                            label={unit.status}
                            size="small"
                            sx={{
                              height: 24,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              bgcolor: statusMeta.bg,
                              color: statusMeta.text,
                              border: `1px solid ${statusMeta.border}`,
                              width: 'fit-content',
                            }}
                          />

                          {/* Seated Guest Info */}
                          {unit.guest && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#eee9df' }}>
                              <Typography variant="caption" noWrap sx={{ fontWeight: 600, color: '#dfbf7c' }}>
                                {unit.guest}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#9da49a' }}>
                                {unit.pax} pax
                              </Typography>
                            </Box>
                          )}

                          {/* Prep Alert Badge */}
                          {unit.status === 'prep' && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#fbbf24',
                                fontSize: '0.7rem',
                                bgcolor: 'rgba(251, 191, 36, 0.12)',
                                p: '3px 8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(251, 191, 36, 0.3)',
                                fontWeight: 600,
                              }}
                            >
                              Prep · Due in {dueBooking?.mins ?? 20}m
                            </Typography>
                          )}
                        </CardActionArea>
                      </Card>
                    )
                  })}
                </Box>
              </Box>
            )
          }))}

          {/* Lower Row: Next Arrivals & Tonight at a Glance */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
              mt: 2,
            }}
          >
            {/* Next Arrivals */}
            <Card
              variant="outlined"
              sx={{
                bgcolor: '#191e1a',
                borderColor: 'rgba(255, 255, 255, 0.07)',
                borderRadius: '6px',
                p: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#f5f2eb', fontWeight: 600 }}>
                  Next arrivals
                </Typography>
                <Button
                  size="small"
                  onClick={() => onToggleTab('bookings')}
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    color: '#d7b46a',
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    minHeight: 44,
                    px: 1.5,
                    '&:focus-visible': { outline: '2px solid #d7b46a', outlineOffset: '2px' },
                  }}
                >
                  View all
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {sortedBookings.slice(0, 4).map((b) => (
                  <Box
                    key={b.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      py: 1,
                      px: 1.5,
                      borderRadius: '4px',
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" sx={{ color: '#d7b46a', fontWeight: 600, minWidth: 45 }}>
                        {fmtTime(b.time)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#eee9df', fontWeight: 500 }}>
                        {b.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9da49a' }}>
                        {b.pax} pax · {b.unit}
                      </Typography>
                    </Box>
                    <Chip
                      label={b.arrived ? 'ARRIVED' : 'BOOKED'}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: b.arrived ? 'rgba(74, 222, 128, 0.12)' : 'rgba(215, 180, 106, 0.12)',
                        color: b.arrived ? '#4ade80' : '#d7b46a',
                        border: `1px solid ${b.arrived ? 'rgba(74, 222, 128, 0.3)' : 'rgba(215, 180, 106, 0.3)'}`,
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Card>

            {/* Tonight at a Glance */}
            <Card
              variant="outlined"
              sx={{
                bgcolor: '#191e1a',
                borderColor: 'rgba(255, 255, 255, 0.07)',
                borderRadius: '6px',
                p: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#f5f2eb', fontWeight: 600 }}>
                  Tonight at a glance
                </Typography>
                <IconButton
                  size="small"
                  onClick={onToggleStats}
                  aria-label={stats ? 'Hide statistics' : 'Show statistics'}
                  sx={{
                    color: '#9da49a',
                    minWidth: 44,
                    minHeight: 44,
                    '&:hover': { color: '#eee9df' },
                    '&:focus-visible': { outline: '2px solid #d7b46a', outlineOffset: '2px' },
                  }}
                >
                  {stats ? <VisibilityOffIcon sx={{ fontSize: 19 }} /> : <VisibilityIcon sx={{ fontSize: 19 }} />}
                </IconButton>
              </Box>

              {stats && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 1.25,
                    mb: 2.5,
                  }}
                >
                  {[
                    { label: 'Reservations today', value: bookings.length, sub: 'Across all areas' },
                    { label: 'Total covers', value: covers, sub: 'Booked + seated' },
                    { label: 'Daily revenue', value: `$${revenue.toLocaleString()}`, sub: 'Completed checks' },
                    {
                      label: 'Avg. per guest',
                      value: `$${covers ? Math.round(revenue / covers) : 0}`,
                      sub: 'Revenue ÷ covers',
                    },
                  ].map((s) => (
                    <Paper
                      key={s.label}
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        bgcolor: '#141815',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#9da49a', fontSize: '0.72rem' }}>
                        {s.label}
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#f5f2eb', fontWeight: 700, fontSize: '1.1rem' }}>
                        {s.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9da49a', fontSize: '0.68rem' }}>
                        {s.sub}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}

              {/* Area Progress Bars */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {sections.map((s) => {
                  const total = shownUnits.filter((u) => u.kind === s).length
                  const used = shownUnits.filter((u) => u.kind === s && u.status !== 'available').length
                  const fillPercent = total ? (used / total) * 100 : 0
                  const label = s === 'Room' ? 'Rooms' : s === 'Couch' ? 'Couches' : 'Tables'

                  return (
                    <Box key={s}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '0.8rem' }}>
                        <Typography variant="caption" sx={{ color: '#c4c9bf' }}>{label}</Typography>
                        <Typography variant="caption" sx={{ color: '#d7b46a', fontWeight: 600 }}>
                          {used}/{total} ({Math.round(fillPercent)}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={fillPercent}
                        sx={{
                          height: 6,
                          borderRadius: '3px',
                          bgcolor: 'rgba(255, 255, 255, 0.08)',
                          '& .MuiLinearProgress-bar': { bgcolor: '#d7b46a', borderRadius: '3px' },
                        }}
                      />
                    </Box>
                  )
                })}
              </Box>
            </Card>
          </Box>
        </>
      ) : (
        /* Arrivals Tab: Table */
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#f5f2eb', fontWeight: 600 }}>
              Today&apos;s reservations
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={onOpenNewBooking}
              startIcon={<AddIcon sx={{ fontSize: 18 }} />}
              sx={{
                bgcolor: '#d7b46a',
                color: '#1a1811',
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 44,
                px: 2,
                '&:hover': { bgcolor: '#e4c77e' },
                '&:focus-visible': { outline: '2px solid #d7b46a', outlineOffset: '2px' },
              }}
            >
              New booking
            </Button>
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
            <Table size="small" aria-label="Today's reservations table">
              <TableHead>
                <TableRow sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <TableCell sx={{ color: '#9da49a', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em' }}>TIME</TableCell>
                  <TableCell sx={{ color: '#9da49a', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em' }}>GUEST</TableCell>
                  <TableCell sx={{ color: '#9da49a', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em' }}>PAX</TableCell>
                  <TableCell sx={{ color: '#9da49a', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em' }}>SEATING / UNIT</TableCell>
                  <TableCell sx={{ color: '#9da49a', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em' }}>STATUS</TableCell>
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
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#eee9df', fontWeight: 500 }}>
                        {b.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9da49a' }}>
                        {b.phone} · {b.note || 'No special notes'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${b.pax} pax`}
                        size="small"
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(255, 255, 255, 0.06)',
                          color: '#eee9df',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#c4c9bf', fontSize: '0.85rem' }}>
                      {b.kind} · {b.unit}
                    </TableCell>
                    <TableCell>
                      <Box
                        component="label"
                        htmlFor={`host-arrival-${b.id}`}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.75,
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          color: b.arrived ? '#4ade80' : '#c4c9bf',
                          minHeight: 44,
                          minWidth: 44,
                          px: 1,
                          py: 0.5,
                          borderRadius: '4px',
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.04)',
                          },
                        }}
                      >
                        <Checkbox
                          id={`host-arrival-${b.id}`}
                          checked={!!b.arrived}
                          onChange={() => onToggleArrival(b.id)}
                          slotProps={{
                            input: {
                              'aria-label': `Toggle arrival for ${b.name}, ${b.pax} guests at ${fmtTime(b.time)}`,
                            },
                          }}
                          size="small"
                          sx={{
                            color: 'rgba(215, 180, 106, 0.5)',
                            '&.Mui-checked': { color: '#4ade80' },
                            p: 0.75,
                          }}
                        />
                        <span>{b.arrived ? 'Arrived' : 'Booked'}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )
}
