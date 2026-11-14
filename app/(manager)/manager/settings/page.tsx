'use client'

import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
  Chip,
  Button,
} from '@mui/material'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { useDiningStore } from '@/lib/dining-store'
import { useBranding } from '@/components/shared/branding-context'
import type { RestaurantConfig } from '@/lib/restaurant-config'

type ExtendedRestaurantConfig = RestaurantConfig & {
  lunchStart?: string
  lunchEnd?: string
  dinnerStart?: string
  dinnerEnd?: string
  turnTimeSmallMin?: number
  turnTimeLargeMin?: number
}

const DEFAULT_SETTINGS = {
  lunchStart: '12:00 PM',
  lunchEnd: '04:30 PM',
  dinnerStart: '06:30 PM',
  dinnerEnd: '11:30 PM',
  turnTimeSmallMin: '90',
  turnTimeLargeMin: '120',
}

export default function ManagerSettingsPage() {
  const { branding } = useBranding()
  const units = useDiningStore((s) => s.units)
  const customers = useDiningStore((s) => s.customers)
  const visitTiers = useDiningStore((s) => s.visitTiers)
  const occasionTags = useDiningStore((s) => s.occasionTags)
  const syncStatus = useDiningStore((s) => s.syncStatus)

  const [loadedConfig, setLoadedConfig] = useState<ExtendedRestaurantConfig | null>(null)
  const [lunchStart, setLunchStart] = useState(DEFAULT_SETTINGS.lunchStart)
  const [lunchEnd, setLunchEnd] = useState(DEFAULT_SETTINGS.lunchEnd)
  const [dinnerStart, setDinnerStart] = useState(DEFAULT_SETTINGS.dinnerStart)
  const [dinnerEnd, setDinnerEnd] = useState(DEFAULT_SETTINGS.dinnerEnd)
  const [turnTimeSmallMin, setTurnTimeSmallMin] = useState(DEFAULT_SETTINGS.turnTimeSmallMin)
  const [turnTimeLargeMin, setTurnTimeLargeMin] = useState(DEFAULT_SETTINGS.turnTimeLargeMin)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadSettings() {
      try {
        const res = await fetch('/api/restaurant-config', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { config?: ExtendedRestaurantConfig | null }
        if (cancelled || !data?.config) return
        const cfg = data.config
        setLoadedConfig(cfg)
        if (typeof cfg.lunchStart === 'string' && cfg.lunchStart.trim()) setLunchStart(cfg.lunchStart)
        if (typeof cfg.lunchEnd === 'string' && cfg.lunchEnd.trim()) setLunchEnd(cfg.lunchEnd)
        if (typeof cfg.dinnerStart === 'string' && cfg.dinnerStart.trim()) setDinnerStart(cfg.dinnerStart)
        if (typeof cfg.dinnerEnd === 'string' && cfg.dinnerEnd.trim()) setDinnerEnd(cfg.dinnerEnd)
        if (typeof cfg.turnTimeSmallMin === 'number' && cfg.turnTimeSmallMin > 0) {
          setTurnTimeSmallMin(String(cfg.turnTimeSmallMin))
        }
        if (typeof cfg.turnTimeLargeMin === 'number' && cfg.turnTimeLargeMin > 0) {
          setTurnTimeLargeMin(String(cfg.turnTimeLargeMin))
        }
      } catch {
        // Fall back to default settings if config cannot be fetched
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadSettings()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveMessage(null)

    const smallMin = Number(turnTimeSmallMin)
    const largeMin = Number(turnTimeLargeMin)

    if (!lunchStart.trim() || !lunchEnd.trim() || !dinnerStart.trim() || !dinnerEnd.trim()) {
      setSaveMessage({ type: 'error', text: 'All service shift start and end times are required.' })
      return
    }
    if (!Number.isInteger(smallMin) || smallMin <= 0 || !Number.isInteger(largeMin) || largeMin <= 0) {
      setSaveMessage({ type: 'error', text: 'Turn times must be positive whole numbers in minutes.' })
      return
    }

    setSaving(true)
    try {
      const payload: ExtendedRestaurantConfig = {
        visitTiers: loadedConfig?.visitTiers ?? visitTiers,
        occasionTags: loadedConfig?.occasionTags ?? occasionTags,
        customers: loadedConfig?.customers ?? customers,
        floorItems: loadedConfig?.floorItems ?? units,
        lunchStart: lunchStart.trim(),
        lunchEnd: lunchEnd.trim(),
        dinnerStart: dinnerStart.trim(),
        dinnerEnd: dinnerEnd.trim(),
        turnTimeSmallMin: smallMin,
        turnTimeLargeMin: largeMin,
      }

      const res = await fetch('/api/restaurant-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errData?.error || 'Unable to save restaurant settings.')
      }

      setLoadedConfig(payload)
      setSaveMessage({ type: 'success', text: 'Restaurant operating rules saved successfully.' })
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save restaurant settings.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
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
          Restaurant Settings & Operating Rules
        </Typography>
        <Typography variant="body2" sx={{ color: '#9da49a' }}>
          Configure turn times, service shifts, reservation policies, and data synchronization.
        </Typography>
      </Box>

      <Card
        component="form"
        onSubmit={handleSave}
        sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3, mb: 3 }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 2 }}>
            Service Shifts & Timing
          </Typography>

          {saveMessage && (
            <Alert
              severity={saveMessage.type}
              onClose={() => setSaveMessage(null)}
              sx={{ mb: 2.5 }}
            >
              {saveMessage.text}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Lunch Service Start"
                value={lunchStart}
                onChange={(e) => setLunchStart(e.target.value)}
                disabled={loading || saving}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Lunch Service End"
                value={lunchEnd}
                onChange={(e) => setLunchEnd(e.target.value)}
                disabled={loading || saving}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Dinner Service Start"
                value={dinnerStart}
                onChange={(e) => setDinnerStart(e.target.value)}
                disabled={loading || saving}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Dinner Service End"
                value={dinnerEnd}
                onChange={(e) => setDinnerEnd(e.target.value)}
                disabled={loading || saving}
                sx={{ mb: 2 }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5, borderColor: '#2b302c' }} />

          <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 2 }}>
            Turn Time Policies
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Turn Time: Parties ≤ 4 (Minutes)"
                value={turnTimeSmallMin}
                onChange={(e) => setTurnTimeSmallMin(e.target.value)}
                disabled={loading || saving}
                type="number"
                slotProps={{ htmlInput: { min: 1 } }}
                helperText="Standard turn time for small and medium tables"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Turn Time: Parties > 4 (Minutes)"
                value={turnTimeLargeMin}
                onChange={(e) => setTurnTimeLargeMin(e.target.value)}
                disabled={loading || saving}
                type="number"
                slotProps={{ htmlInput: { min: 1 } }}
                helperText="Extended turn time for large tables and banquets"
              />
            </Grid>
          </Grid>

          <Stack direction="row" sx={{ mt: 3, justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              sx={{
                bgcolor: branding.primaryColor || '#d7b46a',
                color: '#171a18',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                '&:hover': {
                  bgcolor: branding.secondaryColor || '#bfa15f',
                },
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600 }}>
                System & Database Synchronization
              </Typography>
              <Typography variant="caption" sx={{ color: '#889186', display: 'block', mt: 0.5 }}>
                PostgreSQL persistence with Drizzle ORM and real-time SSE stream.
              </Typography>
            </Box>
            <Chip
              icon={<CheckCircleOutlinedIcon sx={{ fontSize: 16 }} />}
              label={`Status: ${syncStatus.toUpperCase()}`}
              color={syncStatus === 'saved' ? 'success' : 'default'}
              sx={{ fontWeight: 700, fontSize: '0.72rem' }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
