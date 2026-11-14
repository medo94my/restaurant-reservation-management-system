'use client'

import React, { useMemo, useState } from 'react'
import { normalizePhone } from '@/lib/phone'
import type { CustomerProfile, OccasionTag, VisitTier } from '@/lib/restaurant-config'
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  Chip,
  Avatar,
  Alert,
  Paper,
  InputAdornment,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'

type Props = {
  customers: CustomerProfile[]
  visitTiers: VisitTier[]
  occasionTags: OccasionTag[]
  onCustomersChange: (customers: CustomerProfile[]) => void
  onVisitTiersChange: (tiers: VisitTier[]) => void
  onOccasionTagsChange: (tags: OccasionTag[]) => void
}

const tagColors = ['#d69083', '#d7b46a', '#b4a0e0', '#8bb7a0', '#78a9c2', '#d38fae']

function getTier(visits: number, tiers: VisitTier[]) {
  return [...tiers].sort((left, right) => right.minVisits - left.minVisits).find((tier) => visits >= tier.minVisits) ?? tiers[0]
}

function makeTagId(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function GuestTagsManager({
  customers,
  visitTiers,
  occasionTags,
  onCustomersChange,
  onVisitTiersChange,
  onOccasionTagsChange,
}: Props) {
  const [search, setSearch] = useState('')
  const [tagLabel, setTagLabel] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestError, setGuestError] = useState('')

  const filteredCustomers = useMemo(() => {
    const trimmed = search.trim().toLowerCase()
    if (!trimmed) return customers
    const normalizedSearchPhone = normalizePhone(search)

    return customers.filter((customer) => {
      const nameMatch = customer.name.toLowerCase().includes(trimmed)
      const normalizedCustomerPhone = normalizePhone(customer.phone)
      const phoneMatch =
        (normalizedSearchPhone.length > 0 && normalizedCustomerPhone.includes(normalizedSearchPhone)) ||
        customer.phone.toLowerCase().includes(trimmed)
      return nameMatch || phoneMatch
    })
  }, [customers, search])

  const regularMinimum = visitTiers.find((tier) => tier.id === 'regular')?.minVisits ?? 5
  const loyalMinimum = visitTiers.find((tier) => tier.id === 'loyal')?.minVisits ?? 10

  const updateVisitTier = (id: string, patch: Partial<VisitTier>) => {
    onVisitTiersChange(visitTiers.map((tier) => tier.id === id ? { ...tier, ...patch } : tier))
  }

  const addOccasionTag = () => {
    const label = tagLabel.trim()
    const id = makeTagId(label)
    if (!label || !id || occasionTags.some((tag) => tag.id === id)) return
    onOccasionTagsChange([...occasionTags, { id, label, color: tagColors[occasionTags.length % tagColors.length] }])
    setTagLabel('')
  }

  const removeOccasionTag = (tagId: string) => {
    onOccasionTagsChange(occasionTags.filter((tag) => tag.id !== tagId))
    onCustomersChange(customers.map((customer) => ({ ...customer, occasionTags: customer.occasionTags.filter((id) => id !== tagId) })))
  }

  const addGuest = () => {
    const phone = normalizePhone(guestPhone)
    if (!guestName.trim() || phone.length < 7) {
      setGuestError('Add a guest name and a valid phone number.')
      return
    }
    if (customers.some((customer) => normalizePhone(customer.phone) === phone)) {
      setGuestError('A guest with this phone number already exists.')
      return
    }
    onCustomersChange([{ phone, name: guestName.trim(), visits: 0, note: '', occasionTags: [] }, ...customers])
    setGuestName('')
    setGuestPhone('')
    setGuestError('')
  }

  const updateCustomer = (phone: string, patch: Partial<CustomerProfile>) => {
    const targetPhone = normalizePhone(phone)
    onCustomersChange(
      customers.map((customer) =>
        normalizePhone(customer.phone) === targetPhone ? { ...customer, ...patch } : customer
      )
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 4 }}>
      {/* 1. Visit Tiers */}
      <Card
        variant="outlined"
        sx={{
          bgcolor: '#191e1a',
          borderColor: 'rgba(255, 255, 255, 0.07)',
          borderRadius: '6px',
          p: { xs: 2, sm: 2.5 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2.5 }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#d7b46a', letterSpacing: '0.12em', fontSize: '0.7rem', fontWeight: 600 }}>
              Guest segmentation
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600, color: '#f5f2eb', my: 0.5 }}>
              Visit tiers
            </Typography>
            <Typography variant="body2" sx={{ color: '#8e968b', fontSize: '0.85rem' }}>
              Set the visit count at which a guest becomes a regular or loyal guest.
            </Typography>
          </Box>
          <Chip
            label={`${customers.length} profiles`}
            size="small"
            sx={{
              bgcolor: 'rgba(215, 180, 106, 0.12)',
              color: '#d7b46a',
              border: '1px solid rgba(215, 180, 106, 0.3)',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          {visitTiers.map((tier) => (
            <Paper
              key={tier.id}
              variant="outlined"
              sx={{
                bgcolor: '#141815',
                borderColor: 'rgba(255, 255, 255, 0.06)',
                borderTop: `3px solid ${tier.color}`,
                borderRadius: '4px',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
              }}
            >
              <TextField
                size="small"
                value={tier.label}
                aria-label={`${tier.label} tier name`}
                onChange={(e) => updateVisitTier(tier.id, { label: e.target.value })}
                slotProps={{
                  input: {
                    sx: {
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: tier.color,
                      height: 32,
                    },
                  },
                }}
              />
              {tier.id === 'new' ? (
                <Typography variant="caption" sx={{ color: '#c4c9bf', py: 0.5 }}>
                  Starting tier · 0 visits
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    type="number"
                    aria-label={`${tier.label} starts at visits`}
                    value={tier.minVisits}
                    onChange={(e) =>
                      updateVisitTier(tier.id, {
                        minVisits:
                          tier.id === 'regular'
                            ? Math.min(Math.max(1, loyalMinimum - 1), Math.max(1, Number(e.target.value) || 0))
                            : Math.max(regularMinimum + 1, Number(e.target.value) || 0),
                      })
                    }
                    slotProps={{
                      htmlInput: {
                        min: tier.id === 'regular' ? 1 : regularMinimum + 1,
                        max: tier.id === 'regular' ? Math.max(1, loyalMinimum - 1) : 999,
                      },
                      input: {
                        sx: {
                          height: 32,
                          width: 80,
                          fontSize: '0.85rem',
                          color: '#eee9df',
                        },
                      },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#8e968b' }}>
                    visits
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" sx={{ color: '#8e968b', mt: 'auto' }}>
                {tier.id === 'new'
                  ? 'Getting to know us'
                  : tier.id === 'regular'
                    ? 'A familiar face'
                    : 'A cherished regular'}
              </Typography>
            </Paper>
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: '#7a8276', display: 'block', mt: 2 }}>
          Tier thresholds are applied to guest visit counts. Adjust them any time to fit your service style.
        </Typography>
      </Card>

      {/* 2. Occasion Tags */}
      <Card
        variant="outlined"
        sx={{
          bgcolor: '#191e1a',
          borderColor: 'rgba(255, 255, 255, 0.07)',
          borderRadius: '6px',
          p: { xs: 2, sm: 2.5 },
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" sx={{ color: '#d7b46a', letterSpacing: '0.12em', fontSize: '0.7rem', fontWeight: 600 }}>
            Personal touches
          </Typography>
          <Typography variant="h5" sx={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600, color: '#f5f2eb', my: 0.5 }}>
            Occasion tags
          </Typography>
          <Typography variant="body2" sx={{ color: '#8e968b', fontSize: '0.85rem' }}>
            Create tags such as birthdays, anniversaries, VIP, and VVIP, then assign them to guest profiles.
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            addOccasionTag()
          }}
          sx={{ display: 'flex', gap: 1, maxWidth: 480, mb: 2.5 }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="Add a tag, e.g. Graduation"
            value={tagLabel}
            onChange={(e) => setTagLabel(e.target.value)}
            slotProps={{
              input: {
                sx: { height: 38, fontSize: '0.85rem', bgcolor: '#141815', color: '#eee9df' },
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!tagLabel.trim()}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: '#d7b46a',
              color: '#1a1811',
              fontWeight: 600,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              px: 2,
              '&:hover': { bgcolor: '#e4c77e' },
            }}
          >
            Add tag
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }} aria-label="Occasion tag catalog">
          {occasionTags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.label}
              onDelete={() => removeOccasionTag(tag.id)}
              variant="outlined"
              sx={{
                color: tag.color,
                borderColor: `${tag.color}66`,
                bgcolor: `${tag.color}14`,
                fontWeight: 600,
                fontSize: '0.8rem',
                '& .MuiChip-deleteIcon': {
                  color: `${tag.color}aa`,
                  '&:hover': { color: tag.color },
                },
              }}
            />
          ))}
          {occasionTags.length === 0 && (
            <Typography variant="caption" sx={{ color: '#8e968b' }}>
              No occasion tags yet.
            </Typography>
          )}
        </Box>
      </Card>

      {/* 3. Guest Profiles */}
      <Card
        variant="outlined"
        sx={{
          bgcolor: '#191e1a',
          borderColor: 'rgba(255, 255, 255, 0.07)',
          borderRadius: '6px',
          p: { xs: 2, sm: 2.5 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box>
            <Typography variant="overline" sx={{ color: '#d7b46a', letterSpacing: '0.12em', fontSize: '0.7rem', fontWeight: 600 }}>
              Guest book
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600, color: '#f5f2eb', my: 0.5 }}>
              Guest profiles
            </Typography>
            <Typography variant="body2" sx={{ color: '#8e968b', fontSize: '0.85rem' }}>
              Update visit counts, notes, and the tags that help your team make each visit personal.
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#8e968b', fontSize: 18 }} />
                  </InputAdornment>
                ),
                sx: { height: 38, fontSize: '0.85rem', bgcolor: '#141815', color: '#eee9df', width: { xs: '100%', sm: 240 } },
              },
            }}
          />
        </Box>

        {/* Add Guest Form */}
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            addGuest()
          }}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr auto' },
            gap: 1,
            mb: 2,
          }}
        >
          <TextField
            size="small"
            placeholder="New guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            slotProps={{
              input: {
                sx: { height: 38, fontSize: '0.85rem', bgcolor: '#141815', color: '#eee9df' },
              },
            }}
          />
          <TextField
            size="small"
            placeholder="Phone number"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            slotProps={{
              input: {
                sx: { height: 38, fontSize: '0.85rem', bgcolor: '#141815', color: '#eee9df' },
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: '#d7b46a',
              color: '#1a1811',
              fontWeight: 600,
              textTransform: 'none',
              px: 2,
              '&:hover': { bgcolor: '#e4c77e' },
            }}
          >
            Add guest
          </Button>
        </Box>

        {guestError && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
            {guestError}
          </Alert>
        )}

        {/* Guest List */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredCustomers.map((customer) => {
            const tier = getTier(customer.visits, visitTiers)
            const initials = customer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()

            return (
              <Paper
                key={customer.phone}
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: '#141815',
                  borderColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px, 1.2fr) 90px 90px 1fr' },
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  {/* Identity */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: 'rgba(215, 180, 106, 0.15)',
                        color: '#d7b46a',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: '1px solid rgba(215, 180, 106, 0.3)',
                      }}
                    >
                      {initials}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ color: '#eee9df', fontWeight: 600 }}>
                        {customer.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>
                        {customer.phone}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Visits input */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <TextField
                      size="small"
                      type="number"
                      aria-label={`${customer.name} visit count`}
                      value={customer.visits}
                      onChange={(e) =>
                        updateCustomer(customer.phone, {
                          visits: Math.max(0, Math.min(9999, Number(e.target.value) || 0)),
                        })
                      }
                      slotProps={{
                        htmlInput: { min: 0, max: 9999 },
                        input: {
                          sx: { height: 32, fontSize: '0.8rem', bgcolor: '#191e1a', color: '#eee9df', width: 65 },
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#8e968b' }}>
                      visits
                    </Typography>
                  </Box>

                  {/* Tier Chip */}
                  <Chip
                    label={tier?.label ?? 'New'}
                    size="small"
                    sx={{
                      color: tier?.color,
                      borderColor: `${tier?.color}66`,
                      bgcolor: `${tier?.color}14`,
                      border: '1px solid',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                    }}
                  />

                  {/* Service Note */}
                  <TextField
                    size="small"
                    placeholder="Service note"
                    value={customer.note}
                    onChange={(e) => updateCustomer(customer.phone, { note: e.target.value })}
                    slotProps={{
                      input: {
                        sx: { height: 32, fontSize: '0.8rem', bgcolor: '#191e1a', color: '#eee9df' },
                      },
                    }}
                  />
                </Box>

                {/* Assigned Occasion Tags */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pl: { sm: 6 } }}>
                  {occasionTags.map((tag) => {
                    const active = customer.occasionTags.includes(tag.id)
                    return (
                      <Chip
                        key={tag.id}
                        label={tag.label}
                        size="small"
                        clickable
                        onClick={() =>
                          updateCustomer(customer.phone, {
                            occasionTags: active
                              ? customer.occasionTags.filter((id) => id !== tag.id)
                              : [...customer.occasionTags, tag.id],
                          })
                        }
                        sx={{
                          color: active ? tag.color : '#8e968b',
                          borderColor: active ? `${tag.color}88` : 'rgba(255, 255, 255, 0.1)',
                          bgcolor: active ? `${tag.color}1c` : 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid',
                          fontSize: '0.72rem',
                          fontWeight: active ? 600 : 400,
                          '&:hover': {
                            bgcolor: active ? `${tag.color}28` : 'rgba(255, 255, 255, 0.07)',
                          },
                        }}
                      />
                    )
                  })}
                  {occasionTags.length === 0 && (
                    <Typography variant="caption" sx={{ color: '#8e968b' }}>
                      Create a tag above to assign one.
                    </Typography>
                  )}
                </Box>
              </Paper>
            )
          })}

          {filteredCustomers.length === 0 && (
            <Typography variant="body2" sx={{ color: '#8e968b', py: 3, textAlign: 'center' }}>
              No guests match your search.
            </Typography>
          )}
        </Box>
      </Card>
    </Box>
  )
}
