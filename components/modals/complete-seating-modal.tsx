import React from 'react'
import type { Unit } from '@/lib/restaurant-config'
import { ResponsiveDrawer } from '../responsive-drawer'
import { Icon } from '../ui-helpers'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Typography from '@mui/material/Typography'

type Props = {
  open?: boolean
  selected: Unit | null
  bill: string
  onBillChange: (val: string) => void
  onClose: () => void
  onComplete: () => void
}

export function CompleteSeatingModal({
  open,
  selected,
  bill,
  onBillChange,
  onClose,
  onComplete,
}: Props) {
  return (
    <ResponsiveDrawer
      open={open !== undefined ? open && Boolean(selected) : Boolean(selected)}
      onClose={onClose}
      eyebrow="Table Service · Close Check"
      title={selected ? selected.id : 'Complete Seating'}
      subtitle={
        selected
          ? `${selected.guest || 'Walk-in party'} · ${selected.pax || 2} guests · ${selected.time || 'Current service'}`
          : undefined
      }
      aria-labelledby="complete-modal-title"
      width={420}
      actions={
        <>
          <Button variant="outlined" onClick={onClose} sx={{ minHeight: 44 }}>
            Keep seated
          </Button>
          <Button
            variant="contained"
            onClick={onComplete}
            startIcon={<Icon name="check" size={18} />}
            sx={{ minHeight: 44 }}
          >
            Complete / clear
          </Button>
        </>
      }
    >
      <Box sx={{ py: 1 }}>
        <Typography
          component="label"
          htmlFor="bill-amount-input"
          variant="body2"
          sx={{ color: '#c7ccc3', fontWeight: 600, mb: 1.5, fontSize: '0.8125rem', display: 'block' }}
        >
          Total bill amount <span style={{ color: '#a0a79d', fontWeight: 400 }}>(optional)</span>
        </Typography>

        <TextField
          id="bill-amount-input"
          type="number"
          fullWidth
          placeholder="0.00"
          value={bill}
          onChange={e => onBillChange(e.target.value)}
          slotProps={{
            htmlInput: {
              min: 0,
              step: '0.01',
              inputMode: 'decimal',
              'aria-label': 'Total bill amount in dollars',
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <span style={{ color: '#d7b46a', fontWeight: 700, fontSize: 18 }} aria-hidden="true">$</span>
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#141715',
              fontSize: '1.125rem',
              fontWeight: 600,
            },
          }}
        />

        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: '6px',
            backgroundColor: 'rgba(215, 180, 106, 0.05)',
            border: '1px solid rgba(215, 180, 106, 0.15)',
          }}
        >
          <Typography variant="body2" sx={{ color: '#e8d5aa', fontSize: '0.8125rem' }}>
            Completing this table will free up <strong>{selected?.id}</strong> on the live floor plan, record the spend under the guest CRM profile, and advance loyalty visit count.
          </Typography>
        </Box>
      </Box>
    </ResponsiveDrawer>
  )
}
