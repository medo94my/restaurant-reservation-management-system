import React from 'react'
import { ResponsiveDrawer } from '../responsive-drawer'
import { Icon } from '../ui-helpers'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'

type Props = {
  isOpen: boolean
  pin: string
  pinError: boolean
  pinBusy: boolean
  onDigit: (digit: string) => void
  onClear: () => void
  onBackspace: () => void
  onUnlock: (pin: string) => void
  onClose: () => void
}

const SHOW_DEMO_AUTH =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true'

export function PinPadModal({
  isOpen,
  pin,
  pinError,
  pinBusy,
  onDigit,
  onClear,
  onBackspace,
  onUnlock,
  onClose,
}: Props) {
  return (
    <ResponsiveDrawer
      open={isOpen}
      onClose={onClose}
      eyebrow="Staff Authentication"
      title="Staff PIN unlock"
      subtitle={SHOW_DEMO_AUTH ? "Enter your 4-to-6 digit staff PIN to continue (e.g. 1111 for Head Hostess, 123456 for Dining Room Supervisor)." : "Enter your 4-to-6 digit staff PIN to continue."}
      aria-labelledby="pin-modal-title"
      width={420}
      actions={
        <Button
          variant="contained"
          fullWidth
          disabled={pin.length < 4 || pinBusy}
          onClick={() => onUnlock(pin)}
          startIcon={<Icon name="lock_open" size={18} />}
          sx={{ minHeight: 46 }}
        >
          {pinBusy ? 'Verifying PIN...' : `Unlock with PIN (${pin.length || 0}/6)`}
        </Button>
      }
    >
      <Box sx={{ py: 1 }}>
        <Box
          role="status"
          aria-live="polite"
          aria-label={`${pin.length} of 6 digits entered`}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            my: 2.5,
          }}
        >
          {Array.from({ length: 6 }, (_, i) => {
            const isFilled = i < pin.length
            return (
              <Box
                key={i}
                aria-hidden="true"
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '1.5px solid',
                  borderColor: isFilled ? '#d7b46a' : '#525950',
                  backgroundColor: isFilled ? '#d7b46a' : 'transparent',
                  boxShadow: isFilled ? '0 0 10px rgba(215, 180, 106, 0.45)' : 'none',
                  transition: 'all 0.18s ease-in-out',
                }}
              />
            )
          })}
        </Box>

        {pinError && (
          <Alert
            role="alert"
            severity="error"
            variant="outlined"
            sx={{
              mb: 2.5,
              backgroundColor: 'rgba(224, 125, 114, 0.1)',
              borderColor: 'rgba(224, 125, 114, 0.35)',
              color: '#f9d8d5',
              fontSize: '0.8125rem',
              borderRadius: '6px',
              '& .MuiAlert-icon': {
                color: '#e07d72',
              },
            }}
          >
            Incorrect PIN. Please try again.
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.5,
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map(key => (
            <Button
              key={key}
              variant="outlined"
              disabled={pinBusy}
              aria-label={
                key === 'clear' ? 'Clear PIN' : key === 'back' ? 'Backspace' : `Digit ${key}`
              }
              onClick={() => {
                if (key === 'clear') onClear()
                else if (key === 'back') onBackspace()
                else onDigit(key)
              }}
              sx={{
                height: 58,
                borderRadius: '4px',
                fontSize: key === 'clear' ? '0.8125rem' : '1.25rem',
                fontWeight: key === 'clear' ? 600 : 700,
                backgroundColor: '#1d211e',
                borderColor: '#343a35',
                color: key === 'clear' ? '#9da49a' : '#eee9df',
                '&:hover': {
                  backgroundColor: '#262c28',
                  borderColor: '#d7b46a',
                  color: '#d7b46a',
                },
                '&:active': {
                  backgroundColor: '#303832',
                },
                '&:focus-visible': {
                  outline: '2px solid #d7b46a',
                  outlineOffset: '2px',
                },
                transition: 'all 0.12s ease-in-out',
              }}
            >
              {key === 'clear' ? 'Clear' : key === 'back' ? <Icon name="backspace" size={22} /> : key}
            </Button>
          ))}
        </Box>

        {SHOW_DEMO_AUTH && (
<Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            color: '#a0a79d',
            mt: 2.5,
            fontSize: '0.75rem',
          }}
        >
          Head Hostess: <strong style={{ color: '#dfbf7c' }}>1111</strong> · Dining Room Supervisor:{' '}
          <strong style={{ color: '#dfbf7c' }}>123456</strong>
        </Typography>
)}
      </Box>
    </ResponsiveDrawer>
  )
}
