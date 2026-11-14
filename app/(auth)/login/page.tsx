'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  TextField,
  Typography,
  Alert,
  Chip,
  Stack,
  InputAdornment,
  IconButton,
} from '@mui/material'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import { authClient } from '@/lib/auth/client'

const SHOW_DEMO_AUTH =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true'

export default function LoginPage() {
  const router = useRouter()
  const { data: sessionData } = authClient.useSession()
  const [staffId, setStaffId] = useState('')
  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const hasCheckedRef = React.useRef(false)

  // Auto-redirect if already authenticated (e.g. browser back button or direct navigation)
  useEffect(() => {
    if (sessionData?.user) {
      const userRole = (sessionData.user as { role?: string })?.role || 'hostess'
      if (userRole === 'manager' || userRole === 'admin') {
        router.replace('/manager')
      } else {
        router.replace('/hostess')
      }
    }
  }, [sessionData, router])

  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    async function checkStatus() {
      try {
        const res = await fetch('/api/onboarding/status')
        if (res.ok) {
          const data = await res.json()
          if (!data.isCompleted) {
            router.replace('/onboarding')
          }
        }
      } catch {
        // Fallback to staying on login
      }
    }
    checkStatus()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId.trim() || !passcode.trim()) {
      setErrorMsg('Please enter both Staff ID and Passcode.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await authClient.signIn.username({
        username: staffId.trim().toUpperCase(),
        password: passcode,
      })

      if (error) {
        setErrorMsg(error.message || 'Invalid Staff ID or passcode.')
        setLoading(false)
        return
      }

      // Check role and replace history entry (prevents Back button from trapping user at /login)
      const userRole = (data?.user as { role?: string })?.role || 'hostess'
      if (userRole === 'manager' || userRole === 'admin') {
        router.replace('/manager')
      } else {
        router.replace('/hostess')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.'
      setErrorMsg(msg)
      setLoading(false)
    }
  }

  const fillQuickDemo = (id: string, code: string) => {
    setStaffId(id)
    setPasscode(code)
    setErrorMsg('')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 20%, #1c201d 0%, #111312 80%)',
        p: 2,
      }}
    >
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 1.5,
              borderRadius: 3,
              bgcolor: 'rgba(215, 180, 106, 0.1)',
              border: '1px solid rgba(215, 180, 106, 0.25)',
              color: '#d7b46a',
              mb: 1.5,
            }}
          >
            <RestaurantIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'var(--brand-font, "Cinzel"), serif',
              letterSpacing: 2,
              fontWeight: 700,
              color: '#eee9df',
            }}
          >
            Saffron & Cedar
          </Typography>
          <Typography variant="body2" sx={{ color: '#9da49a', mt: 0.5, letterSpacing: 1 }}>
            STAFF PORTAL
          </Typography>
        </Box>

        <Card
          sx={{
            bgcolor: '#171a18',
            border: '1px solid #343a35',
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <CardContent sx={{ p: 3.5 }}>
            <Typography variant="h6" sx={{ color: '#eee9df', mb: 0.5, fontWeight: 600 }}>
              Staff Sign In
            </Typography>
            <Typography variant="caption" sx={{ color: '#889186', display: 'block', mb: 2.5 }}>
              Enter your assigned Staff ID and secure Passcode.
            </Typography>

            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2.5, bgcolor: 'rgba(224, 125, 114, 0.12)' }}>
                {errorMsg}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Staff ID"
                placeholder="e.g. MGR-01 or HOST-01"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                disabled={loading}
                autoFocus
                sx={{ mb: 2 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <BadgeOutlinedIcon sx={{ color: '#9da49a', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                fullWidth
                label="Passcode"
                type={showPasscode ? 'text' : 'password'}
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={loading}
                sx={{ mb: 3 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ color: '#9da49a', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPasscode(!showPasscode)}
                          edge="end"
                          aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                          sx={{ color: '#9da49a' }}
                        >
                          {showPasscode ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  py: 1.25,
                  bgcolor: '#d7b46a',
                  color: '#171a18',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  letterSpacing: 0.5,
                  '&:hover': { bgcolor: '#c4a259' },
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#171a18' }} /> : 'Sign In'}
              </Button>
            </Box>

{SHOW_DEMO_AUTH && (
            <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid #292f2a' }}>
              <Typography variant="caption" sx={{ color: '#7a8279', display: 'block', mb: 1 }}>
                Quick Demo Credentials:
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  size="small"
                  label="Manager (MGR-01)"
                  onClick={() => fillQuickDemo('MGR-01', 'manager123')}
                  sx={{
                    bgcolor: 'rgba(215, 180, 106, 0.12)',
                    color: '#d7b46a',
                    border: '1px solid rgba(215, 180, 106, 0.3)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(215, 180, 106, 0.25)' },
                  }}
                />
                <Chip
                  size="small"
                  label="Hostess (HOST-01)"
                  onClick={() => fillQuickDemo('HOST-01', 'hostess123')}
                  sx={{
                    bgcolor: 'rgba(157, 164, 154, 0.12)',
                    color: '#9da49a',
                    border: '1px solid rgba(157, 164, 154, 0.3)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(157, 164, 154, 0.25)' },
                  }}
                />
              </Stack>
            </Box>
)}
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
