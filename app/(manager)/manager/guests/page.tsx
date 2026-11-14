'use client'

import React from 'react'
import { Box, Typography } from '@mui/material'
import { GuestTagsManager } from '@/components/guest-tags-manager'
import { useDiningStore } from '@/lib/dining-store'
import { useBranding } from '@/components/shared/branding-context'

export default function ManagerGuestsPage() {
  const { branding } = useBranding()
  const customers = useDiningStore((s) => s.customers)
  const visitTiers = useDiningStore((s) => s.visitTiers)
  const occasionTags = useDiningStore((s) => s.occasionTags)

  const updateCustomers = useDiningStore((s) => s.updateCustomers)
  const updateVisitTiers = useDiningStore((s) => s.updateVisitTiers)
  const updateOccasionTags = useDiningStore((s) => s.updateOccasionTags)

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
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
          Guest CRM, VIP Tiers & Tags
        </Typography>
        <Typography variant="body2" sx={{ color: '#9da49a' }}>
          Configure guest profiles, loyalty visit thresholds, permanent dietary notes, and occasion tags.
        </Typography>
      </Box>

      <GuestTagsManager
        customers={customers}
        visitTiers={visitTiers}
        occasionTags={occasionTags}
        onCustomersChange={updateCustomers}
        onVisitTiersChange={updateVisitTiers}
        onOccasionTagsChange={updateOccasionTags}
      />
    </Box>
  )
}
