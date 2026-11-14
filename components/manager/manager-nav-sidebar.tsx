'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import EventSeatOutlinedIcon from '@mui/icons-material/EventSeatOutlined'
import LoyaltyOutlinedIcon from '@mui/icons-material/LoyaltyOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ViewQuiltOutlinedIcon from '@mui/icons-material/ViewQuiltOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { useBranding } from '@/components/shared/branding-context'
import { authClient, useSession } from '@/lib/auth/client'

const NAV_ITEMS = [
  { label: 'Overview', href: '/manager', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { label: 'Reservations', href: '/manager/reservations', icon: <EventSeatOutlinedIcon fontSize="small" /> },
  { label: 'Floor Plan', href: '/manager/floor-plan', icon: <ViewQuiltOutlinedIcon fontSize="small" /> },
  { label: 'Guests & VIP', href: '/manager/guests', icon: <LoyaltyOutlinedIcon fontSize="small" /> },
  { label: 'Branding', href: '/manager/branding', icon: <PaletteOutlinedIcon fontSize="small" /> },
  { label: 'Staff Management', href: '/manager/staff', icon: <PeopleAltOutlinedIcon fontSize="small" /> },
  { label: 'Settings', href: '/manager/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
]

export function ManagerNavSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { branding } = useBranding()
  const { data: sessionData } = useSession()
  const currentStaff = sessionData?.user as { name?: string; role?: string; staffId?: string } | undefined
  const roleLabel = currentStaff?.role
    ? currentStaff.role.charAt(0).toUpperCase() + currentStaff.role.slice(1)
    : 'Manager'

  const [collapsed, setCollapsed] = useState(false)

  // Hydrate preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('manager_sidebar_collapsed')
      if (saved !== null) {
        setCollapsed(saved === 'true')
      }
    } catch {
      // ignore
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('manager_sidebar_collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const handleLogout = async () => {
    try {
      await authClient.signOut()
    } catch {
      // Ignore
    }
    router.replace('/login')
  }

  return (
    <Box
      component="nav"
      aria-label="Manager navigation sidebar"
      sx={{
        width: collapsed ? 72 : 260,
        flexShrink: 0,
        bgcolor: '#171a18',
        borderRight: '1px solid #2b302c',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowX: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Header with Gemini-style Menu Toggle */}
      <Box
        sx={{
          p: collapsed ? 1.5 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.5,
          borderBottom: '1px solid #2b302c',
          minHeight: 68,
        }}
      >
        <Tooltip
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          placement="right"
          arrow
        >
          <IconButton
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            sx={{
              width: 44,
              height: 44,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 2,
              color: '#9da49a',
              transition: 'all 0.18s ease-in-out',
              '&:hover': {
                color: branding.primaryColor || '#d7b46a',
                bgcolor: 'rgba(215, 180, 106, 0.12)',
              },
              '&:focus-visible': {
                outline: '2px solid #d7b46a',
                outlineOffset: '2px',
              },
            }}
          >
            {collapsed ? <MenuIcon sx={{ fontSize: 22 }} /> : <MenuOpenIcon sx={{ fontSize: 22 }} />}
          </IconButton>
        </Tooltip>

        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, overflow: 'hidden' }}>
            {branding.logoUrl ? (
              <Box
                component="img"
                src={branding.logoUrl}
                alt={branding.restaurantName}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '6px',
                  objectFit: 'contain',
                  flexShrink: 0,
                  border: `1px solid ${branding.primaryColor || '#d7b46a'}40`,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '6px',
                  bgcolor: 'rgba(215, 180, 106, 0.1)',
                  border: '1px solid rgba(215, 180, 106, 0.25)',
                  color: branding.primaryColor || '#d7b46a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <RestaurantIcon sx={{ fontSize: 18 }} />
              </Box>
            )}

            <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontFamily: `var(--brand-font, ${branding.fontFamily || 'Cinzel'}), serif`,
                  fontWeight: 700,
                  color: '#eee9df',
                  lineHeight: 1.2,
                  letterSpacing: 0.5,
                  fontSize: '0.88rem',
                }}
              >
                {branding.restaurantName || 'Saffron & Cedar'}
              </Typography>
              <Chip
                label={roleLabel.toUpperCase()}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  bgcolor: 'rgba(215, 180, 106, 0.15)',
                  color: branding.primaryColor || '#d7b46a',
                  border: '1px solid rgba(215, 180, 106, 0.3)',
                  mt: 0.25,
                }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Navigation Links */}
      <List sx={{ px: collapsed ? 1 : 1.5, py: 2, flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href

          const buttonContent = (
            <ListItemButton
              component={Link}
              href={item.href}
              selected={isActive}
              aria-label={collapsed ? item.label : undefined}
              sx={{
                borderRadius: 2,
                py: 1.25,
                px: collapsed ? 0 : 1.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: collapsed ? 44 : '100%',
                height: 44,
                mx: collapsed ? 'auto' : 0,
                color: isActive ? branding.primaryColor || '#d7b46a' : '#b0b6ad',
                bgcolor: isActive
                  ? collapsed
                    ? 'rgba(215, 180, 106, 0.16)'
                    : 'rgba(215, 180, 106, 0.12)'
                  : 'transparent',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(215, 180, 106, 0.28)' : 'none',
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                  bgcolor: 'rgba(215, 180, 106, 0.08)',
                  color: '#eee9df',
                },
                '&:focus-visible': {
                  outline: '2px solid #d7b46a',
                  outlineOffset: '2px',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 'auto' : 32,
                  justifyContent: 'center',
                  color: isActive ? branding.primaryColor || '#d7b46a' : '#889186',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: isActive ? 700 : 500 }} noWrap>
                      {item.label}
                    </Typography>
                  }
                />
              )}
            </ListItemButton>
          )

          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5, display: 'flex', justifyContent: 'center' }}>
              {collapsed ? (
                <Tooltip title={item.label} placement="right" arrow>
                  {buttonContent}
                </Tooltip>
              ) : (
                buttonContent
              )}
            </ListItem>
          )
        })}

        <Divider sx={{ my: 1.5, borderColor: '#2b302c', mx: collapsed ? 1 : 0 }} />

        {/* Link to Hostess Interface */}
        <ListItem disablePadding sx={{ display: 'flex', justifyContent: 'center' }}>
          {collapsed ? (
            <Tooltip title="Switch to Hostess UI" placement="right" arrow>
              <ListItemButton
                component={Link}
                href="/hostess"
                aria-label="Switch to Hostess UI"
                sx={{
                  borderRadius: 2,
                  width: 44,
                  height: 44,
                  p: 0,
                  justifyContent: 'center',
                  mx: 'auto',
                  color: '#9da49a',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: '#eee9df',
                  },
                  '&:focus-visible': {
                    outline: '2px solid #d7b46a',
                    outlineOffset: '2px',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center', color: '#9da49a' }}>
                  <ArrowForwardOutlinedIcon fontSize="small" />
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          ) : (
            <ListItemButton
              component={Link}
              href="/hostess"
              sx={{
                borderRadius: 2,
                py: 1.25,
                px: 1.5,
                color: '#9da49a',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  color: '#eee9df',
                },
                '&:focus-visible': {
                  outline: '2px solid #d7b46a',
                  outlineOffset: '2px',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: '#9da49a' }}>
                <ArrowForwardOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography sx={{ fontSize: '0.84rem' }} noWrap>Switch to Hostess UI</Typography>}
              />
            </ListItemButton>
          )}
        </ListItem>
      </List>

      {/* Staff User Footer */}
      <Box
        sx={{
          p: collapsed ? 1.5 : 2,
          borderTop: '1px solid #2b302c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <Box sx={{ minWidth: 0, mr: 1, overflow: 'hidden' }}>
            <Typography
              variant="body2"
              sx={{ color: '#eee9df', fontWeight: 600, fontSize: '0.85rem' }}
              noWrap
            >
              {currentStaff ? (currentStaff.name || roleLabel) : 'Not signed in'}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#889186', fontSize: '0.72rem', display: 'block' }}
              noWrap
            >
              {currentStaff ? `${currentStaff.staffId || 'MGR-01'} · ${roleLabel}` : 'Sign-in required'}
            </Typography>
          </Box>
        )}

        <Tooltip
          title={`Sign Out (${currentStaff?.name || 'Manager'})`}
          placement={collapsed ? 'right' : 'top'}
          arrow
        >
          <IconButton
            size="small"
            onClick={handleLogout}
            aria-label="Sign out"
            sx={{
              width: 44,
              height: 44,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 2,
              color: '#889186',
              '&:hover': { color: '#e07d72', bgcolor: 'rgba(224, 125, 114, 0.1)' },
              '&:focus-visible': {
                outline: '2px solid #d7b46a',
                outlineOffset: '2px',
              },
            }}
          >
            <LogoutOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
