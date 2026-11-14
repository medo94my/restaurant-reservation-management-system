'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AddIcon from '@mui/icons-material/Add'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import MapIcon from '@mui/icons-material/Map'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { useBranding } from '@/components/shared/branding-context'
import { authClient } from '@/lib/auth/client'

interface HostessTopBarProps {
  now: Date | null
  onOpenNewBooking: () => void
  onPrintRunSheet?: () => void
  userName?: string
  userRole?: string
}

export function HostessTopBar({
  now,
  onOpenNewBooking,
  onPrintRunSheet,
  userName = 'Head Hostess',
  userRole = 'HOST',
}: HostessTopBarProps) {
  const router = useRouter()
  const pathname = usePathname() || '/hostess'
  const { branding } = useBranding()

  const handleLogout = async () => {
    try {
      await authClient.signOut()
    } catch {
      // Ignore
    }
    router.replace('/login')
  }

  const formatClock = (d: Date | null) => {
    if (!d) return '--:-- --'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (d: Date | null) => {
    if (!d) return ''
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: branding.backgroundColor || '#111312',
        borderBottom: '1px solid #2b302c',
        backgroundImage: 'none',
        zIndex: 10,
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: { xs: 58, sm: 64 },
          maxWidth: 1680,
          mx: 'auto',
          width: '100%',
          px: { xs: 2, sm: 3, md: 4, xl: 6 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Left: Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {branding.logoUrl ? (
            <Box
              component="img"
              src={branding.logoUrl}
              alt={branding.restaurantName}
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                objectFit: 'contain',
                border: `1px solid ${branding.primaryColor || '#d7b46a'}40`,
              }}
            />
          ) : (
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                backgroundColor: '#262218',
                border: '1px solid #584a28',
                color: branding.primaryColor || '#d7b46a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RestaurantIcon sx={{ fontSize: 20 }} />
            </Box>
          )}

          <Box>
            <Typography
              variant="h6"
              sx={{
                fontSize: { xs: '0.95rem', sm: '1.1rem' },
                fontFamily: `var(--brand-font, ${branding.fontFamily || 'Cinzel'}), serif`,
                letterSpacing: { xs: '0.04em', sm: '0.06em' },
                fontWeight: 700,
                color: branding.textColor || '#eee9df',
                lineHeight: 1.15,
              }}
            >
              {branding.restaurantName || 'Saffron & Cedar'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontSize: '0.68rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#9da49a',
                mt: 0.25,
              }}
            >
              {branding.tagline || 'Beirut Dining Room'}
            </Typography>
          </Box>
        </Box>

        {/* Navigation Tabs */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            bgcolor: '#191d1a',
            p: 0.5,
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            gap: 0.5,
          }}
        >
          <Button
            component={Link}
            href="/hostess"
            size="small"
            startIcon={<MapIcon sx={{ fontSize: 17 }} />}
            sx={{
              color: pathname === '/hostess' ? '#1a1811' : '#9da49a',
              bgcolor: pathname === '/hostess' ? '#d7b46a' : 'transparent',
              fontWeight: pathname === '/hostess' ? 700 : 500,
              fontSize: '0.8rem',
              textTransform: 'none',
              px: 1.5,
              py: 0.5,
              borderRadius: '6px',
              minHeight: 34,
              '&:hover': {
                bgcolor: pathname === '/hostess' ? '#e4c77e' : 'rgba(215, 180, 106, 0.12)',
                color: pathname === '/hostess' ? '#1a1811' : '#f5f2eb',
              },
            }}
          >
            Floor Stand
          </Button>

          <Button
            component={Link}
            href="/hostess/reservations"
            size="small"
            startIcon={<CalendarMonthIcon sx={{ fontSize: 17 }} />}
            sx={{
              color: pathname.startsWith('/hostess/reservations') ? '#1a1811' : '#9da49a',
              bgcolor: pathname.startsWith('/hostess/reservations') ? '#d7b46a' : 'transparent',
              fontWeight: pathname.startsWith('/hostess/reservations') ? 700 : 500,
              fontSize: '0.8rem',
              textTransform: 'none',
              px: 1.5,
              py: 0.5,
              borderRadius: '6px',
              minHeight: 34,
              '&:hover': {
                bgcolor: pathname.startsWith('/hostess/reservations') ? '#e4c77e' : 'rgba(215, 180, 106, 0.12)',
                color: pathname.startsWith('/hostess/reservations') ? '#1a1811' : '#f5f2eb',
              },
            }}
          >
            Arrivals &amp; Bookings
          </Button>
        </Box>

        {/* Center: Live Status & Clock */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 0.75,
            borderRadius: 99,
            backgroundColor: '#171a18',
            border: '1px solid #2b302c',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#7cb382',
                boxShadow: '0 0 8px rgba(124, 179, 130, 0.6)',
              }}
            />
            <Typography variant="caption" sx={{ color: '#eee9df', fontWeight: 600 }}>
              Service live
            </Typography>
          </Box>

          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#444c45' }} />

          <Chip
            size="small"
            label={`${userName} · ${userRole}`}
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              backgroundColor: 'rgba(215, 180, 106, 0.12)',
              color: branding.primaryColor || '#d7b46a',
              border: '1px solid rgba(215, 180, 106, 0.3)',
            }}
          />

          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#444c45' }} />

          <Typography variant="caption" sx={{ color: '#9da49a' }} suppressHydrationWarning>
            {formatDate(now)}
          </Typography>

          <Box
            suppressHydrationWarning
            sx={{
              px: 1,
              py: 0.2,
              borderRadius: 1,
              backgroundColor: '#202421',
              color: branding.primaryColor || '#d7b46a',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {formatClock(now)}
          </Box>
        </Box>

        {/* Right: Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {onPrintRunSheet && (
            <Button
              variant="outlined"
              size="small"
              onClick={onPrintRunSheet}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                borderColor: '#343a35',
                color: '#d9ded7',
                textTransform: 'none',
                fontSize: '0.82rem',
                borderRadius: 2,
                '&:hover': { borderColor: branding.primaryColor || '#d7b46a' },
              }}
            >
              Print run sheet
            </Button>
          )}

          <Tooltip title="Sign Out">
            <IconButton
              size="small"
              onClick={handleLogout}
              aria-label="Sign out"
              sx={{
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                border: '1px solid #343a35',
                color: '#9da49a',
                borderRadius: 2,
                '&:hover': { borderColor: branding.primaryColor || '#d7b46a', color: branding.primaryColor || '#d7b46a' },
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            size="small"
            onClick={onOpenNewBooking}
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            sx={{
              bgcolor: branding.primaryColor || '#d7b46a',
              color: '#171a18',
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '0.85rem',
              borderRadius: 2,
              px: 1.75,
              '&:hover': { bgcolor: branding.secondaryColor || '#c4a259' },
            }}
          >
            New booking
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
