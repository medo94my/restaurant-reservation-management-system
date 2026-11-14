import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import { Icon, type LiveAlertNotification } from './ui-helpers'

type DueBooking = {
  unit: string
  name: string
  mins: number
}

type Props = {
  liveAlerts: LiveAlertNotification[]
  dueBookings: DueBooking[]
  onDismissAlerts: () => void
}

export function LiveAlerts({ liveAlerts, dueBookings, onDismissAlerts }: Props) {
  if (liveAlerts.length === 0 && dueBookings.length === 0) return null

  const isOverstay = liveAlerts.length > 0 && liveAlerts[0].type === 'overstay'
  const title = isOverstay ? 'Dining overstay alert' : 'Table preparation due'
  const note = liveAlerts.length > 0
    ? ` — ${liveAlerts.map(a => a.message).join(' · ')}`
    : ` — ${dueBookings.map(b => `${b.unit} for ${b.name} in ${b.mins} min`).join(' · ')}. Wipe down, lay mezze cutlery, and set the table.`

  const countLabel = liveAlerts.length > 0
    ? `${liveAlerts.length} ACTIVE ALERT${liveAlerts.length > 1 ? 'S' : ''}`
    : `${dueBookings.length} UPCOMING`

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        background: isOverstay
          ? 'linear-gradient(105deg, #441c19, #291b1a)'
          : 'linear-gradient(105deg, #392d19, #27251d)',
        border: `1px solid ${isOverstay ? '#7d3830' : '#5d4b29'}`,
        borderRadius: '6px',
        p: { xs: 1.5, sm: 2 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        color: isOverstay ? '#f9d8d5' : '#e8d09a',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box
          sx={{
            color: isOverstay ? '#f28b7e' : '#e4c47d',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Icon name="notifications_active" size={22} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="span"
            sx={{
              fontWeight: 700,
              color: isOverstay ? '#ffb4aa' : '#f1d28b',
              fontSize: '0.875rem',
              display: 'inline',
              mr: 0.5,
            }}
          >
            {title}
          </Typography>
          <Typography
            component="span"
            sx={{
              color: isOverstay ? '#e8beb8' : '#c9bd9e',
              fontSize: '0.8125rem',
              display: 'inline',
            }}
          >
            {note}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Chip
          size="small"
          label={countLabel}
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: isOverstay ? '#ffb4aa' : '#edd28d',
            borderColor: isOverstay ? '#8d453d' : '#8d713f',
            backgroundColor: isOverstay ? 'rgba(94, 29, 25, 0.4)' : 'rgba(57, 50, 34, 0.4)',
            borderWidth: 1,
            borderStyle: 'solid',
            height: 26,
          }}
        />
        {liveAlerts.length > 0 && (
          <IconButton
            size="small"
            onClick={onDismissAlerts}
            title="Dismiss notification"
            aria-label="Dismiss notification"
            sx={{
              color: isOverstay ? '#e8beb8' : '#c9bd9e',
              width: 44,
              height: 44,
              minWidth: 44,
              minHeight: 44,
              '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.08)' },
              '&:focus-visible': { outline: '2px solid #d7b46a', outlineOffset: '2px' },
            }}
          >
            <Icon name="close" size={18} />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}
