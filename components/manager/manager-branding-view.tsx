'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Stack,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import { useBranding, type RestaurantBrandingData, DEFAULT_BRANDING } from '@/components/shared/branding-context'

const FONT_OPTIONS = [
  { label: 'Cinzel (Editorial Luxury Serif)', value: 'Cinzel' },
  { label: 'Playfair Display (Classic Elegant Serif)', value: 'Playfair Display' },
  { label: 'Inter (Modern Crisp Sans)', value: 'Inter' },
  { label: 'Plus Jakarta Sans (Contemporary Tech)', value: 'Plus Jakarta Sans' },
  { label: 'DM Sans (Clean Geometric Sans)', value: 'DM Sans' },
  { label: 'Merriweather (Warm Literary)', value: 'Merriweather' },
]

const ALLOWED_LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
])

export function ManagerBrandingView() {
  const { branding: liveBranding, refreshBranding } = useBranding()

  const [form, setForm] = useState<RestaurantBrandingData>({ ...liveBranding })
  const [logoPreview, setLogoPreview] = useState<string>(liveBranding.logoUrl || '')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  useEffect(() => {
    setForm({ ...liveBranding })
    setLogoPreview(liveBranding.logoUrl || '')
  }, [liveBranding])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_LOGO_MIME_TYPES.has(file.type.toLowerCase())) {
      setFeedback({
        type: 'error',
        message: 'Please select a PNG, JPG, WebP, GIF, or AVIF image (SVG is not allowed).',
      })
      e.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Image size exceeds 2MB limit.' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setLogoPreview(dataUrl)
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }))
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoPreview('')
    setForm((prev) => ({ ...prev, logoUrl: '' }))
  }

  const handleSave = async (publish: boolean) => {
    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          logoUrl: logoPreview,
          isPublished: publish,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save branding.')
      }

      await refreshBranding()
      setFeedback({
        type: 'success',
        message: publish
          ? 'Branding published to live restaurant interfaces successfully!'
          : 'Branding draft saved successfully.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating branding.'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaults = async () => {
    if (!confirm('Are you sure you want to reset all branding settings to factory defaults?')) {
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/branding', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to reset branding.')
      await refreshBranding()
      setForm({ ...DEFAULT_BRANDING })
      setLogoPreview('')
      setFeedback({ type: 'success', message: 'Branding reset to default luxury theme.' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error resetting branding.'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Title */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{
            fontFamily: `var(--brand-font, ${form.fontFamily || 'Cinzel'}), serif`,
            color: '#eee9df',
            fontWeight: 700,
            letterSpacing: 1,
            mb: 0.5,
          }}
        >
          Restaurant Visual Identity & Branding
        </Typography>
        <Typography variant="body2" sx={{ color: '#9da49a' }}>
          Customize restaurant logo, colors, typography, and name. Changes published here
          automatically update the live Hostess floor and guest booking interfaces.
        </Typography>
      </Box>

      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{
            mb: 3,
            bgcolor:
              feedback.type === 'success'
                ? 'rgba(124, 179, 130, 0.15)'
                : 'rgba(224, 125, 114, 0.15)',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'rgba(124, 179, 130, 0.3)'
                : 'rgba(224, 125, 114, 0.3)'
            }`,
          }}
        >
          {feedback.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Controls Column */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card
            sx={{
              bgcolor: '#171a18',
              border: '1px solid #2b302c',
              borderRadius: 3,
              mb: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 2 }}>
                Identity & Information
              </Typography>

              <TextField
                fullWidth
                label="Restaurant Name"
                value={form.restaurantName}
                onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Tagline / Subtitle"
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                sx={{ mb: 3 }}
              />

              <Divider sx={{ my: 2.5, borderColor: '#2b302c' }} />

              <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 1 }}>
                Restaurant Logo
              </Typography>
              <Typography variant="caption" sx={{ color: '#889186', display: 'block', mb: 2 }}>
                Upload PNG, JPG, WebP, GIF, or AVIF emblem (max 2MB).
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 2,
                    bgcolor: '#202421',
                    border: '1px dashed #444c45',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {logoPreview ? (
                    <Box
                      component="img"
                      src={logoPreview}
                      alt="Logo preview"
                      sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <RestaurantIcon sx={{ color: '#555f56', fontSize: 28 }} />
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUploadOutlinedIcon fontSize="small" />}
                    size="small"
                    sx={{
                      borderColor: '#444c45',
                      color: '#d9ded7',
                      textTransform: 'none',
                      '&:hover': { borderColor: form.primaryColor || '#d7b46a' },
                    }}
                  >
                    Upload Logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      hidden
                      onChange={handleLogoUpload}
                    />
                  </Button>

                  {logoPreview && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlinedIcon fontSize="small" />}
                      onClick={handleRemoveLogo}
                      sx={{ textTransform: 'none' }}
                    >
                      Remove
                    </Button>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2.5, borderColor: '#2b302c' }} />

              <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 2 }}>
                Color Palette & Theme Tokens
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" sx={{ color: '#9da49a', display: 'block', mb: 0.5 }}>
                    Primary Brand Color
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        border: '1px solid #444c45',
                        background: 'none',
                        cursor: 'pointer',
                      }}
                    />
                    <TextField
                      size="small"
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      sx={{ flexGrow: 1 }}
                    />
                  </Box>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" sx={{ color: '#9da49a', display: 'block', mb: 0.5 }}>
                    Secondary / Accent
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={form.secondaryColor}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        border: '1px solid #444c45',
                        background: 'none',
                        cursor: 'pointer',
                      }}
                    />
                    <TextField
                      size="small"
                      value={form.secondaryColor}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                      sx={{ flexGrow: 1 }}
                    />
                  </Box>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" sx={{ color: '#9da49a', display: 'block', mb: 0.5 }}>
                    Background Surface
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={form.backgroundColor}
                      onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        border: '1px solid #444c45',
                        background: 'none',
                        cursor: 'pointer',
                      }}
                    />
                    <TextField
                      size="small"
                      value={form.backgroundColor}
                      onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })}
                      sx={{ flexGrow: 1 }}
                    />
                  </Box>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" sx={{ color: '#9da49a', display: 'block', mb: 0.5 }}>
                    Card & Panel Surface
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={form.surfaceColor}
                      onChange={(e) => setForm({ ...form, surfaceColor: e.target.value })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        border: '1px solid #444c45',
                        background: 'none',
                        cursor: 'pointer',
                      }}
                    />
                    <TextField
                      size="small"
                      value={form.surfaceColor}
                      onChange={(e) => setForm({ ...form, surfaceColor: e.target.value })}
                      sx={{ flexGrow: 1 }}
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2.5, borderColor: '#2b302c' }} />

              <Typography variant="h6" sx={{ color: '#eee9df', fontWeight: 600, mb: 1 }}>
                Brand Typography
              </Typography>
              <Select
                fullWidth
                size="small"
                value={form.fontFamily}
                onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}
                sx={{ mb: 3 }}
              >
                {FONT_OPTIONS.map((f) => (
                  <MenuItem key={f.value} value={f.value} sx={{ fontFamily: f.value }}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, pt: 1, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  startIcon={saving ? <CircularProgress size={18} /> : <CheckCircleOutlinedIcon />}
                  sx={{
                    bgcolor: form.primaryColor || '#d7b46a',
                    color: '#171a18',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 3,
                    '&:hover': { bgcolor: form.secondaryColor || '#c4a259' },
                  }}
                >
                  Publish to Live
                </Button>

                <Button
                  variant="outlined"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  sx={{
                    borderColor: '#444c45',
                    color: '#eee9df',
                    textTransform: 'none',
                  }}
                >
                  Save Draft
                </Button>

                <Button
                  variant="text"
                  color="warning"
                  onClick={handleResetDefaults}
                  disabled={saving}
                  startIcon={<RestoreOutlinedIcon />}
                  sx={{ textTransform: 'none', ml: 'auto !important' }}
                >
                  Reset Defaults
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Live Preview Column */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: 'sticky', top: 24 }}>
            <Card
              sx={{
                bgcolor: '#171a18',
                border: '1px solid #2b302c',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  p: 2,
                  bgcolor: '#202421',
                  borderBottom: '1px solid #2b302c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <VisibilityOutlinedIcon sx={{ color: form.primaryColor || '#d7b46a', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ color: '#eee9df', fontWeight: 600 }}>
                  Live Interface Preview
                </Typography>
                <Chip
                  label="PREVIEW"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    bgcolor: 'rgba(215, 180, 106, 0.15)',
                    color: form.primaryColor || '#d7b46a',
                    ml: 'auto',
                  }}
                />
              </Box>

              <CardContent
                sx={{
                  p: 3,
                  backgroundColor: form.backgroundColor || '#111312',
                  minHeight: 400,
                }}
              >
                {/* Simulated Header */}
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: form.surfaceColor || '#171a18',
                    border: '1px solid #2b302c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 3,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    {logoPreview ? (
                      <Box
                        component="img"
                        src={logoPreview}
                        alt="Logo"
                        sx={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 1 }}
                      />
                    ) : (
                      <RestaurantIcon sx={{ color: form.primaryColor || '#d7b46a', fontSize: 20 }} />
                    )}
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: form.fontFamily || 'Cinzel',
                          fontWeight: 700,
                          color: form.textColor || '#eee9df',
                          lineHeight: 1.1,
                        }}
                      >
                        {form.restaurantName || 'Restaurant Name'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#889186', fontSize: '0.65rem' }}>
                        {form.tagline || 'Dining Room'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 1.5,
                      bgcolor: form.primaryColor || '#d7b46a',
                      color: form.backgroundColor || '#111312',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    + New booking
                  </Box>
                </Box>

                {/* Simulated Floor Card */}
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: form.surfaceColor || '#171a18',
                    border: `1px solid ${form.primaryColor || '#d7b46a'}30`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    mb: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontFamily: form.fontFamily || 'Cinzel',
                        fontWeight: 700,
                        color: form.textColor || '#eee9df',
                      }}
                    >
                      Table 4 · VIP Seating
                    </Typography>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#7cb382',
                        boxShadow: '0 0 6px #7cb382',
                      }}
                    />
                  </Box>

                  <Typography variant="caption" sx={{ color: '#9da49a', display: 'block', mb: 1.5 }}>
                    Guest: Nadia Khoury (6 covers) · 8:30 PM
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: `${form.primaryColor || '#d7b46a'}20`,
                        color: form.primaryColor || '#d7b46a',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      Anniversary
                    </Box>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        color: '#9da49a',
                        fontSize: '0.7rem',
                      }}
                    >
                      Quiet area
                    </Box>
                  </Box>
                </Box>

                <Typography
                  variant="caption"
                  sx={{ color: '#687067', display: 'block', textAlign: 'center', mt: 3 }}
                >
                  Typography sample: The quick brown fox jumps over the lazy dog.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
