import React from 'react'
import type { Booking, OccasionTag, Unit } from '@/lib/restaurant-config'
import { ResponsiveDrawer } from '../responsive-drawer'
import {
  Icon,
  fmtTime,
  formatLoyaltyTier,
  formatDietaryFlag,
  type BookingFormState,
  type MatchedCustomer,
} from '../ui-helpers'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'

type Props = {
  isOpen: boolean
  bookingForm: BookingFormState
  matchedCustomer: MatchedCustomer | null
  appliedCustomerId: string | null
  occasionTags: OccasionTag[]
  shownUnits?: Unit[]
  editingBookingId?: number | string | null
  onFormChange: React.Dispatch<React.SetStateAction<BookingFormState>>
  onSearchSourceChange: (source: 'phone' | 'name') => void
  onApplyProfile: (customer: MatchedCustomer) => void
  onSave: () => void
  onClose: () => void
  onSeatNow?: () => void
  onReleaseTable?: () => void
}

export function BookingModal({
  isOpen,
  bookingForm,
  matchedCustomer,
  appliedCustomerId,
  occasionTags,
  shownUnits,
  editingBookingId,
  onFormChange,
  onSearchSourceChange,
  onApplyProfile,
  onSave,
  onClose,
  onSeatNow,
  onReleaseTable,
}: Props) {
  const isFormValid =
    bookingForm.guestName.trim().length > 0 &&
    bookingForm.phone.replace(/\D/g, '').length >= 7

  const isEditing = Boolean(editingBookingId)
  const assignableUnits = React.useMemo(
    () =>
      (shownUnits ?? []).filter(
        (u) => !u.archived && (u.status === 'available' || u.id === bookingForm.unitId)
      ),
    [shownUnits, bookingForm.unitId]
  )

  // Ensure "Others" tag exists in occasion options
  const displayOccasions: OccasionTag[] = React.useMemo(() => {
    const hasOther = occasionTags.some(t => t.id === 'other' || t.id === 'others')
    if (hasOther) return occasionTags
    return [...occasionTags, { id: 'other', label: 'Others', color: '#c9a875' }]
  }, [occasionTags])

  const isOtherSelected =
    bookingForm.occasionTags.includes('other') || bookingForm.occasionTags.includes('others')

  return (
    <ResponsiveDrawer
      open={isOpen}
      onClose={onClose}
      eyebrow={
        isEditing
          ? `${bookingForm.unitId ? `${bookingForm.unitId} · ` : ''}Edit reservation`
          : 'Host stand · New reservation'
      }
      title={isEditing ? 'Update party details.' : 'Welcome them well.'}
      subtitle={
        isEditing
          ? 'Modify party size, arrival time, occasion or reservation notes.'
          : 'Lookup by phone or guest name auto-fills returning profile preferences.'
      }
      aria-labelledby="booking-modal-title"
      width={500}
      actions={
        <Box sx={{ display: 'flex', gap: 1, width: '100%', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onClose} sx={{ minHeight: 44 }}>
            Cancel
          </Button>

          {isEditing && onReleaseTable && (
            <Button
              variant="outlined"
              color="error"
              onClick={onReleaseTable}
              startIcon={<Icon name="cancel" size={18} />}
              sx={{ minHeight: 44 }}
            >
              Release table
            </Button>
          )}

          {isEditing && onSeatNow && (
            <Button
              variant="outlined"
              onClick={onSeatNow}
              startIcon={<Icon name="check_circle" size={18} />}
              sx={{
                minHeight: 44,
                borderColor: '#d7b46a',
                color: '#d7b46a',
                '&:hover': {
                  borderColor: '#eed29b',
                  backgroundColor: 'rgba(215, 180, 106, 0.1)',
                },
              }}
            >
              Seat now
            </Button>
          )}

          <Button
            variant="contained"
            onClick={onSave}
            disabled={!isFormValid}
            startIcon={<Icon name={isEditing ? 'save' : 'event_available'} size={18} />}
            sx={{ minHeight: 44 }}
          >
            {isEditing ? 'Save changes' : 'Save reservation'}
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, py: 1 }}>
        {/* Returning Guest Card (When Matched) */}
        {matchedCustomer && (
          <Card
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: '6px',
              borderColor: '#7c6535',
              background: 'linear-gradient(135deg, #272218 0%, #1e201b 100%)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 1.5,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: '#f3e8d2', fontSize: '0.9375rem', lineHeight: 1.2 }}
                  >
                    {matchedCustomer.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${formatLoyaltyTier(matchedCustomer.loyaltyTier)} · ${matchedCustomer.visitCount ?? matchedCustomer.visits ?? 0} visits`}
                    sx={{
                      height: 22,
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      backgroundColor:
                        matchedCustomer.loyaltyTier === 'vip'
                          ? '#443217'
                          : matchedCustomer.loyaltyTier === 'loyal'
                          ? '#273a2a'
                          : '#243026',
                      borderColor:
                        matchedCustomer.loyaltyTier === 'vip'
                          ? '#9a7536'
                          : matchedCustomer.loyaltyTier === 'loyal'
                          ? '#548259'
                          : '#45664b',
                      color:
                        matchedCustomer.loyaltyTier === 'vip'
                          ? '#fad88f'
                          : '#b2e2b7',
                      borderWidth: 1,
                      borderStyle: 'solid',
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#a0a89d', display: 'block' }}>
                  {matchedCustomer.phone}
                </Typography>
              </Box>

              <Button
                size="small"
                variant="outlined"
                onClick={() => onApplyProfile(matchedCustomer)}
                startIcon={
                  appliedCustomerId === matchedCustomer.id ? (
                    <Icon name="check" size={16} />
                  ) : undefined
                }
                sx={{
                  minHeight: 44,
                  py: 1,
                  px: 2,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  borderColor: appliedCustomerId === matchedCustomer.id ? '#d7b46a' : '#4e564d',
                  color: appliedCustomerId === matchedCustomer.id ? '#dfc37f' : '#eee9df',
                  backgroundColor:
                    appliedCustomerId === matchedCustomer.id
                      ? 'rgba(215, 180, 106, 0.12)'
                      : 'transparent',
                  '&:hover': {
                    borderColor: '#d7b46a',
                    backgroundColor: 'rgba(215, 180, 106, 0.18)',
                  },
                }}
              >
                {appliedCustomerId === matchedCustomer.id ? 'Auto-filled' : 'Confirm details'}
              </Button>
            </Box>

            {matchedCustomer.dietaryFlags && matchedCustomer.dietaryFlags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                {matchedCustomer.dietaryFlags.map(flag => (
                  <Chip
                    key={flag}
                    size="small"
                    variant="outlined"
                    icon={<Icon name="restaurant_menu" size={13} />}
                    label={formatDietaryFlag(flag)}
                    sx={{
                      height: 22,
                      fontSize: '0.6875rem',
                      color: '#eed29b',
                      borderColor: 'rgba(215, 180, 106, 0.35)',
                      backgroundColor: 'rgba(215, 180, 106, 0.08)',
                      '& .MuiChip-icon': {
                        color: '#d7b46a',
                      },
                    }}
                  />
                ))}
              </Box>
            )}

            {(matchedCustomer.seatingPreferences ||
              matchedCustomer.permanentNotes ||
              matchedCustomer.note) && (
              <Box sx={{ mt: 1.25, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Typography variant="caption" sx={{ color: '#d0d8cc', fontSize: '0.75rem' }}>
                  <strong style={{ color: '#dfbf7c' }}>Preferences: </strong>
                  {[
                    matchedCustomer.seatingPreferences,
                    matchedCustomer.permanentNotes || matchedCustomer.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            )}
          </Card>
        )}

        {/* Guest Contact & Name Fields */}
        <TextField
          id="phone"
          label="Guest phone number"
          type="tel"
          fullWidth
          slotProps={{
            htmlInput: { inputMode: 'tel' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Icon name="phone" size={18} />
                </InputAdornment>
              ),
            },
          }}
          placeholder="+961 70 123 456"
          value={bookingForm.phone}
          onChange={e => {
            const val = e.target.value
            onSearchSourceChange('phone')
            onFormChange(prev => ({ ...prev, phone: val }))
          }}
        />

        <TextField
          id="guest-name"
          label="Guest name"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Icon name="person" size={18} />
                </InputAdornment>
              ),
            },
          }}
          placeholder="Full name"
          value={bookingForm.guestName}
          onChange={e => {
            const val = e.target.value
            onSearchSourceChange('name')
            onFormChange(prev => ({ ...prev, guestName: val }))
          }}
        />

        {/* Party Size & Arrival Time */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField
            id="booking-pax"
            label="Party size (Guests)"
            type="number"
            fullWidth
            value={bookingForm.pax}
            onChange={e => {
              const val = parseInt(e.target.value, 10)
              onFormChange(prev => ({
                ...prev,
                pax: Number.isNaN(val) ? 1 : Math.max(1, Math.min(50, val)),
              }))
            }}
            slotProps={{
              htmlInput: { min: 1, max: 50, step: 1 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon name="group" size={18} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <FormControl fullWidth>
            <InputLabel id="booking-time-label">Arrival time</InputLabel>
            <Select
              labelId="booking-time-label"
              id="booking-time"
              value={bookingForm.time}
              label="Arrival time"
              onChange={e => onFormChange(prev => ({ ...prev, time: e.target.value }))}
            >
              {Array.from({ length: 33 }, (_, i) => {
                const total = (10 * 60 + i * 30) % (24 * 60)
                const h = Math.floor(total / 60)
                const m = total % 60
                const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                return (
                  <MenuItem value={val} key={val}>
                    {fmtTime(val)}
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>
        </Box>

        {shownUnits && shownUnits.length > 0 && (
          <FormControl fullWidth>
            <InputLabel id="booking-unit-label">Floor unit assignment</InputLabel>
            <Select
              labelId="booking-unit-label"
              id="booking-unit"
              value={bookingForm.unitId ?? ''}
              label="Floor unit assignment"
              onChange={(e) =>
                onFormChange((prev) => ({
                  ...prev,
                  unitId: e.target.value ? String(e.target.value) : null,
                }))
              }
            >
              <MenuItem value="">Assign on arrival (Unassigned)</MenuItem>
              {assignableUnits.map((u) => (
                <MenuItem value={u.id} key={u.id}>
                  {u.id} ({u.capacity} seats · {u.status})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Occasion Tags with "Others" */}
        <Box>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: '#c4c9bf',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              mb: 1,
              fontSize: '0.75rem',
            }}
          >
            Occasion tags
          </Typography>
          <Box
            role="group"
            aria-label="Select occasion tags"
            sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}
          >
            {displayOccasions.map(tag => {
              const isSelected = bookingForm.occasionTags.includes(tag.id)
              return (
                <Chip
                  key={tag.id}
                  clickable
                  role="button"
                  variant="outlined"
                  aria-pressed={isSelected}
                  icon={
                    isSelected ? (
                      <Icon name="check" size={16} />
                    ) : (
                      <Icon name="celebration" size={16} />
                    )
                  }
                  label={tag.label}
                  onClick={() =>
                    onFormChange(prev => ({
                      ...prev,
                      occasionTags: prev.occasionTags.includes(tag.id)
                        ? prev.occasionTags.filter(id => id !== tag.id)
                        : [...prev.occasionTags, tag.id],
                    }))
                  }
                  sx={{
                    minHeight: 40,
                    height: 40,
                    px: 0.5,
                    borderRadius: '4px',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    backgroundColor: isSelected ? 'rgba(215, 180, 106, 0.16)' : '#1b1f1c',
                    borderColor: isSelected ? '#d7b46a' : '#343a35',
                    color: isSelected ? '#f1dfba' : '#c4c9bf',
                    '& .MuiChip-icon': {
                      color: isSelected ? '#d7b46a' : '#9da49a',
                    },
                    '&:hover': {
                      backgroundColor: isSelected ? 'rgba(215, 180, 106, 0.24)' : '#252b26',
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

          {/* Custom Occasion Text Area when "Others" is chosen */}
          {isOtherSelected && (
            <TextField
              id="custom-occasion"
              label="Specify custom occasion"
              placeholder="e.g. Graduation dinner, Business closing, Engagement party"
              fullWidth
              value={bookingForm.customOccasion || ''}
              onChange={e => onFormChange(prev => ({ ...prev, customOccasion: e.target.value }))}
              sx={{ mt: 1.5 }}
            />
          )}
        </Box>

        {/* Standalone Un-resizable Notes */}
        <Box>
          <TextField
            id="booking-notes"
            label="Reservation notes & special preferences"
            placeholder="e.g. Quiet corner table, champagne on arrival, allergy notifications..."
            multiline
            rows={3}
            fullWidth
            value={bookingForm.note}
            onChange={e => onFormChange(prev => ({ ...prev, note: e.target.value }))}
            sx={{
              '& .MuiInputBase-root': {
                alignItems: 'flex-start',
              },
              '& textarea': {
                resize: 'none',
                lineHeight: 1.5,
              },
            }}
          />
        </Box>
      </Box>
    </ResponsiveDrawer>
  )
}
