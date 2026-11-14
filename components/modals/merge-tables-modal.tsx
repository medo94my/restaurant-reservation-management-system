import React from 'react'
import type { Unit } from '@/lib/restaurant-config'
import { ResponsiveDrawer } from '../responsive-drawer'
import { Icon } from '../ui-helpers'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'

type Props = {
  isOpen?: boolean
  units: Unit[]
  mergeSet: string[]
  onToggleUnit: (id: string) => void
  onClose: () => void
  onConfirmMerge: () => void
}

export function MergeTablesModal({
  isOpen = true,
  units,
  mergeSet,
  onToggleUnit,
  onClose,
  onConfirmMerge,
}: Props) {
  const tableUnits = units.filter(u => u.kind === 'Table' && !u.archived)

  const combinedCapacity = mergeSet.reduce((acc, id) => {
    const found = units.find(u => u.id === id)
    return acc + (found?.capacity || 0)
  }, 0)

  return (
    <ResponsiveDrawer
      open={Boolean(isOpen)}
      onClose={onClose}
      eyebrow="Dining Room Floor"
      title="Combine tables"
      subtitle="Choose adjacent dining tables to link together for this service."
      aria-labelledby="merge-modal-title"
      width={420}
      actions={
        <>
          <Button variant="outlined" onClick={onClose} sx={{ minHeight: 44 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={mergeSet.length < 2}
            onClick={onConfirmMerge}
            startIcon={<Icon name="link" size={18} />}
            sx={{ minHeight: 44 }}
          >
            Link selected ({mergeSet.length})
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 1 }}>
        <Box>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: '#c4c9bf',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 1.5,
              fontSize: '0.75rem',
            }}
          >
            Available Dining Room Tables ({tableUnits.length})
          </Typography>
          <Box
            role="group"
            aria-label="Available dining tables for linking"
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}
          >
            {tableUnits.map(u => {
              const isSelected = mergeSet.includes(u.id)
              return (
                <Chip
                  key={u.id}
                  clickable
                  variant="outlined"
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`Table ${u.id}, ${u.capacity} seats, ${isSelected ? 'selected' : 'not selected'}`}
                  onClick={() => onToggleUnit(u.id)}
                  icon={
                    isSelected ? (
                      <Icon name="check_circle" size={18} />
                    ) : (
                      <Icon name="table_restaurant" size={18} />
                    )
                  }
                  label={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <span style={{ fontWeight: 600 }}>{u.id}</span>
                      <span style={{ opacity: 0.75, fontSize: '0.75rem' }}>· {u.capacity}p</span>
                    </Box>
                  }
                  sx={{
                    minHeight: 44,
                    height: 44,
                    px: 1,
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    backgroundColor: isSelected ? 'rgba(215, 180, 106, 0.16)' : '#1a1e1b',
                    borderColor: isSelected ? '#d7b46a' : '#343a35',
                    color: isSelected ? '#f1dfba' : '#c7ccc3',
                    '& .MuiChip-icon': {
                      color: isSelected ? '#d7b46a' : '#9da49a',
                    },
                    '&:hover': {
                      backgroundColor: isSelected ? 'rgba(215, 180, 106, 0.24)' : '#232824',
                      borderColor: isSelected ? '#d7b46a' : '#4b534a',
                    },
                    '&:focus-visible': {
                      outline: '2px solid #d7b46a',
                      outlineOffset: '2px',
                    },
                    transition: 'all 0.15s ease-in-out',
                  }}
                />
              )
            })}
          </Box>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: '6px',
            backgroundColor:
              mergeSet.length >= 2 ? 'rgba(215, 180, 106, 0.06)' : 'rgba(255, 255, 255, 0.02)',
            borderColor: mergeSet.length >= 2 ? 'rgba(215, 180, 106, 0.3)' : '#343a35',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Icon
              name={mergeSet.length >= 2 ? 'link' : 'info'}
              size={18}
              className={mergeSet.length >= 2 ? 'gold' : ''}
            />
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, color: mergeSet.length >= 2 ? '#dfc37f' : '#b0b6ad' }}
            >
              {mergeSet.length >= 2
                ? `Linked Configuration (${mergeSet.join(' + ')})`
                : 'Select at least 2 tables'}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#a0a79d', fontSize: '0.8125rem' }}>
            {mergeSet.length >= 2
              ? `Combining ${mergeSet.length} tables provides a total party capacity of ${combinedCapacity} guests for this seating session.`
              : 'Choose two or more adjacent dining tables on the floor plan to bridge them into a continuous party section.'}
          </Typography>
        </Paper>
      </Box>
    </ResponsiveDrawer>
  )
}
