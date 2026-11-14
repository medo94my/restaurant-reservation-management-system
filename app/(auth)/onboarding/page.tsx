'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  Container,
  TextField,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Stack,
  CircularProgress,
  IconButton,
  InputAdornment,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { authClient } from '@/lib/auth/client'

const STEPS = [
  'Restaurant Profile',
  'Manager Account',
  'Branding & Style',
  'Service Operations',
  'Review & Launch',
]

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const FONT_OPTIONS = [
  'Cinzel',
  'Playfair Display',
  'Cormorant Garamond',
  'Inter',
  'Montserrat',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isCompletedLockout, setIsCompletedLockout] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  // Step 1: Restaurant Info
  const [restaurantName, setRestaurantName] = useState('Saffron & Cedar')
  const [description, setDescription] = useState('Levantine dining and culinary excellence.')
  const [phoneNumber, setPhoneNumber] = useState('+961 1 234 567')
  const [email, setEmail] = useState('manager@saffroncedar.com')
  const [address, setAddress] = useState('Gouraud Street, Gemmayzeh, Beirut')
  const [country, setCountry] = useState('Lebanon')
  const [timezone, setTimezone] = useState('Asia/Beirut')
  const [currency, setCurrency] = useState('USD')

  // Step 2: Manager Credentials
  const [managerName, setManagerName] = useState('')
  const [staffId, setStaffId] = useState('')
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)

  // Step 3: Branding
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#d7b46a')
  const [secondaryColor, setSecondaryColor] = useState('#bfa15f')
  const [backgroundColor, setBackgroundColor] = useState('#111312')
  const [surfaceColor, setSurfaceColor] = useState('#171a18')
  const [textColor, setTextColor] = useState('#f4efe6')
  const [fontFamily, setFontFamily] = useState('Cinzel')
  const [tagline, setTagline] = useState('Beirut Dining Room')

  // Step 4: Operations
  const [operatingDays, setOperatingDays] = useState<string[]>(DAYS_OF_WEEK)
  const [lunchStart, setLunchStart] = useState('12:00 PM')
  const [lunchEnd, setLunchEnd] = useState('04:30 PM')
  const [dinnerStart, setDinnerStart] = useState('06:30 PM')
  const [dinnerEnd, setDinnerEnd] = useState('11:30 PM')
  const [reservationIntervalMin, setReservationIntervalMin] = useState(15)
  const [turnTimeSmallMin, setTurnTimeSmallMin] = useState(90)
  const [turnTimeLargeMin, setTurnTimeLargeMin] = useState(120)
  const [isResumedSession, setIsResumedSession] = useState(false)
  const hasInitializedRef = React.useRef(false)

  // Initialize or fetch onboarding status on mount
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    async function loadStatus() {
      try {
        const res = await fetch('/api/onboarding/status')
        if (res.ok) {
          const data = await res.json()
          if (data.isCompleted) {
            setIsCompletedLockout(true)
            setLoading(false)
            return
          }

          // If draft data exists, populate state
          if (data.draftData) {
            populateDraft(data.draftData)
            if (data.currentStep && data.currentStep > 1 && data.currentStep <= 5) {
              setActiveStep(data.currentStep - 1)
              if (data.currentStep >= 3) {
                setIsResumedSession(true)
              }
            }
          }

          // If no workspaceId is active, initialize draft session once
          if (!data.workspaceId) {
            const initRes = await fetch('/api/onboarding/init', { method: 'POST' })
            if (initRes.ok) {
              const initData = await initRes.json()
              if (initData.draftData) {
                populateDraft(initData.draftData)
              }
              if (initData.currentStep && initData.currentStep > 1) {
                setActiveStep(Math.min(initData.currentStep - 1, 4))
                if (initData.currentStep >= 3) {
                  setIsResumedSession(true)
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        console.warn('Onboarding load warning', err)
      } finally {
        setLoading(false)
      }
    }

    loadStatus()
  }, [])

  const populateDraft = (draft: Record<string, any>) => {
    if (draft.step1) {
      if (draft.step1.name) setRestaurantName(draft.step1.name)
      if (draft.step1.description) setDescription(draft.step1.description)
      if (draft.step1.phoneNumber) setPhoneNumber(draft.step1.phoneNumber)
      if (draft.step1.email) setEmail(draft.step1.email)
      if (draft.step1.address) setAddress(draft.step1.address)
      if (draft.step1.country) setCountry(draft.step1.country)
      if (draft.step1.timezone) setTimezone(draft.step1.timezone)
      if (draft.step1.currency) setCurrency(draft.step1.currency)
    }
    if (draft.step2) {
      if (draft.step2.managerName) setManagerName(draft.step2.managerName)
      if (draft.step2.staffId) setStaffId(draft.step2.staffId)
    }
    if (draft.step3) {
      if (draft.step3.logoUrl) setLogoUrl(draft.step3.logoUrl)
      if (draft.step3.primaryColor) setPrimaryColor(draft.step3.primaryColor)
      if (draft.step3.secondaryColor) setSecondaryColor(draft.step3.secondaryColor)
      if (draft.step3.backgroundColor) setBackgroundColor(draft.step3.backgroundColor)
      if (draft.step3.surfaceColor) setSurfaceColor(draft.step3.surfaceColor)
      if (draft.step3.textColor) setTextColor(draft.step3.textColor)
      if (draft.step3.fontFamily) setFontFamily(draft.step3.fontFamily)
      if (draft.step3.tagline) setTagline(draft.step3.tagline)
    }
    if (draft.step4) {
      if (draft.step4.operatingDays) setOperatingDays(draft.step4.operatingDays)
      if (draft.step4.lunchStart) setLunchStart(draft.step4.lunchStart)
      if (draft.step4.lunchEnd) setLunchEnd(draft.step4.lunchEnd)
      if (draft.step4.dinnerStart) setDinnerStart(draft.step4.dinnerStart)
      if (draft.step4.dinnerEnd) setDinnerEnd(draft.step4.dinnerEnd)
      if (draft.step4.reservationIntervalMin) setReservationIntervalMin(draft.step4.reservationIntervalMin)
      if (draft.step4.turnTimeSmallMin) setTurnTimeSmallMin(draft.step4.turnTimeSmallMin)
      if (draft.step4.turnTimeLargeMin) setTurnTimeLargeMin(draft.step4.turnTimeLargeMin)
    }
  }

  // Toggle operating day
  const handleToggleDay = (day: string) => {
    setOperatingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  // Step 1 validation & save
  const handleNextStep1 = async () => {
    if (!restaurantName.trim()) {
      setErrorMsg('Restaurant name is required.')
      return
    }
    if (!phoneNumber.trim()) {
      setErrorMsg('Restaurant phone number is required.')
      return
    }
    if (!address.trim()) {
      setErrorMsg('Restaurant address is required.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/onboarding/step', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 1,
          data: {
            name: restaurantName.trim(),
            description: description.trim(),
            phoneNumber: phoneNumber.trim(),
            email: email.trim(),
            address: address.trim(),
            country: country.trim(),
            timezone: timezone.trim(),
            currency: currency.trim(),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save restaurant details.')
      }

      setActiveStep(1)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving step.')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2 validation & save
  const handleNextStep2 = async () => {
    if (!managerName.trim()) {
      setErrorMsg('Manager full name is required.')
      return
    }
    if (!staffId.trim()) {
      setErrorMsg('Staff ID is required.')
      return
    }
    if (!passcode) {
      setErrorMsg('Passcode is required.')
      return
    }
    if (passcode.length < 4) {
      setErrorMsg('Passcode must be at least 4 characters long.')
      return
    }
    if (passcode !== confirmPasscode) {
      setErrorMsg('Passcodes do not match.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/onboarding/step', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 2,
          data: {
            managerName: managerName.trim(),
            staffId: staffId.trim().toUpperCase(),
            passcode,
            confirmPasscode,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register manager details.')
      }

      setIsResumedSession(false)
      setActiveStep(2)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving step.')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 3 validation & save
  const handleNextStep3 = async () => {
    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/onboarding/step', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 3,
          data: {
            logoUrl: logoUrl.trim(),
            primaryColor: primaryColor.trim(),
            secondaryColor: secondaryColor.trim(),
            backgroundColor: backgroundColor.trim(),
            surfaceColor: surfaceColor.trim(),
            textColor: textColor.trim(),
            fontFamily,
            tagline: tagline.trim(),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save branding settings.')
      }

      setActiveStep(3)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving step.')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 4 validation & save
  const handleNextStep4 = async () => {
    if (operatingDays.length === 0) {
      setErrorMsg('Please select at least one operating day.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/onboarding/step', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 4,
          data: {
            operatingDays,
            lunchStart,
            lunchEnd,
            dinnerStart,
            dinnerEnd,
            reservationIntervalMin: Number(reservationIntervalMin),
            turnTimeSmallMin: Number(turnTimeSmallMin),
            turnTimeLargeMin: Number(turnTimeLargeMin),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save operational settings.')
      }

      setActiveStep(4)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving step.')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 5: Final Launch & Complete
  const handleCompleteOnboarding = async () => {
    const trimmedPasscode = passcode.trim()
    if (trimmedPasscode.length > 0 && trimmedPasscode.length < 4) {
      setErrorMsg('Passcode confirmation must be at least 4 characters long.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          trimmedPasscode ? { passcodeConfirmation: trimmedPasscode } : {}
        ),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete restaurant setup.')
      }

      setSuccessMsg('Workspace successfully initialized! Logging you in...')

      // Only attempt client sign-in fallback if the server did not already establish the session
      // AND a non-empty passcode is available in client state.
      if (!data.sessionEstablished && trimmedPasscode) {
        try {
          await authClient.signIn.username({
            username: staffId.trim().toUpperCase(),
            password: trimmedPasscode,
          })
        } catch (signInErr) {
          console.warn('Client sign-in fallback', signInErr)
        }
      }

      // Navigate to manager console (or redirectUrl returned by server)
      const targetUrl = typeof data.redirectUrl === 'string' ? data.redirectUrl : '/manager'
      setTimeout(() => {
        router.push(targetUrl)
      }, 700)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to finalize onboarding.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#111312',
        }}
      >
        <CircularProgress sx={{ color: '#d7b46a' }} />
      </Box>
    )
  }

  // Lockout view when onboarding is already complete
  if (isCompletedLockout) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 20%, #1c201d 0%, #111312 80%)',
          p: 3,
        }}
      >
        <Container maxWidth="sm">
          <Card
            sx={{
              bgcolor: '#171a18',
              border: '1px solid rgba(215, 180, 106, 0.25)',
              borderRadius: 3,
              p: 3,
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                p: 2,
                borderRadius: '50%',
                bgcolor: 'rgba(215, 180, 106, 0.1)',
                color: '#d7b46a',
                mb: 2,
              }}
            >
              <CheckCircleOutlinedIcon sx={{ fontSize: 44 }} />
            </Box>
            <Typography variant="h5" sx={{ color: '#f4efe6', fontFamily: 'Cinzel, serif', mb: 1.5 }}>
              Restaurant Setup Complete
            </Typography>
            <Typography variant="body2" sx={{ color: '#8e968b', mb: 3 }}>
              The initial restaurant workspace and manager account have already been configured.
              Additional staff accounts must be managed from within the Manager Console.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/login')}
                sx={{
                  borderColor: 'rgba(215, 180, 106, 0.4)',
                  color: '#d7b46a',
                  '&:hover': { borderColor: '#d7b46a', bgcolor: 'rgba(215, 180, 106, 0.05)' },
                }}
              >
                Go to Staff Login
              </Button>
              <Button
                variant="contained"
                onClick={() => router.push('/manager')}
                sx={{
                  bgcolor: '#d7b46a',
                  color: '#111312',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#c4a055' },
                }}
              >
                Open Manager Console
              </Button>
            </Stack>
          </Card>
        </Container>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 15%, #1d211e 0%, #111312 85%)',
        py: { xs: 4, md: 6 },
        px: 2,
      }}
    >
      <Container maxWidth="md">
        {/* Header Branding */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
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
            <RestaurantIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography
            variant="h4"
            sx={{
              color: '#f4efe6',
              fontFamily: 'Cinzel, Georgia, serif',
              letterSpacing: '0.04em',
              fontWeight: 600,
            }}
          >
            Restaurant Onboarding
          </Typography>
          <Typography variant="body2" sx={{ color: '#8e968b', mt: 0.5 }}>
            Establish your restaurant workspace and initial manager credentials.
          </Typography>
        </Box>

        {/* Stepper Progress */}
        <Card
          sx={{
            bgcolor: '#171a18',
            border: '1px solid rgba(215, 180, 106, 0.2)',
            borderRadius: 3,
            p: 2.5,
            mb: 3,
          }}
        >
          <Stepper
            activeStep={activeStep}
            alternativeLabel
            sx={{
              '& .MuiStepLabel-label': {
                color: '#8e968b !important',
                fontSize: '0.8rem',
                '&.Mui-active': { color: '#d7b46a !important', fontWeight: 600 },
                '&.Mui-completed': { color: '#bfa15f !important' },
              },
              '& .MuiStepIcon-root': {
                color: '#252926',
                '&.Mui-active': { color: '#d7b46a' },
                '&.Mui-completed': { color: '#bfa15f' },
              },
            }}
          >
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Card>

        {/* Alerts */}
        {errorMsg && (
          <Alert
            severity="error"
            onClose={() => setErrorMsg('')}
            sx={{
              mb: 3,
              bgcolor: 'rgba(211, 47, 47, 0.1)',
              color: '#ff8a80',
              border: '1px solid rgba(211, 47, 47, 0.3)',
            }}
          >
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert
            severity="success"
            sx={{
              mb: 3,
              bgcolor: 'rgba(46, 125, 50, 0.15)',
              color: '#a5d6a7',
              border: '1px solid rgba(46, 125, 50, 0.3)',
            }}
          >
            {successMsg}
          </Alert>
        )}

        {/* Wizard Form Cards */}
        <Card
          sx={{
            bgcolor: '#171a18',
            border: '1px solid rgba(215, 180, 106, 0.2)',
            borderRadius: 3,
            p: { xs: 2.5, sm: 4 },
          }}
        >
          {/* STEP 1: Restaurant Information */}
          {activeStep === 0 && (
            <Box>
              <Typography
                variant="h6"
                sx={{ color: '#d7b46a', fontFamily: 'Cinzel, serif', mb: 1 }}
              >
                Step 1: Restaurant Details
              </Typography>
              <Typography variant="body2" sx={{ color: '#8e968b', mb: 3 }}>
                Enter the primary information for your dining establishment.
              </Typography>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField
                    fullWidth
                    label="Restaurant Name"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="e.g. Saffron & Cedar"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+961 1 234 567"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of culinary concept and atmosphere"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@restaurant.com"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Physical Address"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, District, City"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  />
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                <Button
                  variant="contained"
                  onClick={handleNextStep1}
                  disabled={submitting}
                  endIcon={submitting ? <CircularProgress size={18} /> : <ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#d7b46a',
                    color: '#111312',
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    '&:hover': { bgcolor: '#c4a055' },
                  }}
                >
                  Save & Continue
                </Button>
              </Box>
            </Box>
          )}

          {/* STEP 2: Initial Manager Account */}
          {activeStep === 1 && (
            <Box>
              <Typography
                variant="h6"
                sx={{ color: '#d7b46a', fontFamily: 'Cinzel, serif', mb: 1 }}
              >
                Step 2: Initial Manager Account
              </Typography>
              <Typography variant="body2" sx={{ color: '#8e968b', mb: 3 }}>
                Create the founding manager profile. Staff will authenticate using their unique Staff ID and Passcode.
              </Typography>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Manager Full Name"
                    required
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="e.g. Samira Khoury"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Staff ID (Login Username)"
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                    placeholder="e.g. MGR-01"
                    helperText="Unique uppercase ID used for signing in"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <BadgeOutlinedIcon sx={{ color: '#8e968b', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Passcode (Min. 4 characters)"
                    required
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="••••••••"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon sx={{ color: '#8e968b', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPasscode(!showPasscode)}
                              edge="end"
                              aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                              sx={{ color: '#8e968b' }}
                            >
                              {showPasscode ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Confirm Passcode"
                    required
                    type={showPasscode ? 'text' : 'password'}
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    placeholder="••••••••"
                  />
                </Grid>
              </Grid>

              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(215, 180, 106, 0.05)',
                  border: '1px dashed rgba(215, 180, 106, 0.25)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#d7b46a', display: 'block', fontWeight: 600 }}>
                  Security & Role Enforcement
                </Typography>
                <Typography variant="caption" sx={{ color: '#8e968b' }}>
                  The <strong>Manager</strong> role is strictly bound by the server engine. Plaintext passcodes are never persisted in setup drafts and are hashed securely with Better Auth before being written to PostgreSQL.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(0)}
                  startIcon={<ArrowBackIcon />}
                  sx={{ borderColor: 'rgba(215, 180, 106, 0.3)', color: '#d7b46a' }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNextStep2}
                  disabled={submitting}
                  endIcon={submitting ? <CircularProgress size={18} /> : <ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#d7b46a',
                    color: '#111312',
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    '&:hover': { bgcolor: '#c4a055' },
                  }}
                >
                  Save & Continue
                </Button>
              </Box>
            </Box>
          )}

          {/* STEP 3: Restaurant Branding & Live Preview */}
          {activeStep === 2 && (
            <Box>
              <Typography
                variant="h6"
                sx={{ color: '#d7b46a', fontFamily: 'Cinzel, serif', mb: 1 }}
              >
                Step 3: Restaurant Branding & Style
              </Typography>
              <Typography variant="body2" sx={{ color: '#8e968b', mb: 3 }}>
                Customize the published visual appearance, color palette, and typography.
              </Typography>

              <Grid container spacing={3}>
                {/* Form Controls */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Stack spacing={2.5}>
                    <TextField
                      fullWidth
                      label="Tagline / Location"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="e.g. Beirut Dining Room"
                    />

                    <FormControl fullWidth>
                      <InputLabel>Typography / Font Family</InputLabel>
                      <Select
                        value={fontFamily}
                        label="Typography / Font Family"
                        onChange={(e) => setFontFamily(e.target.value)}
                      >
                        {FONT_OPTIONS.map((f) => (
                          <MenuItem key={f} value={f}>
                            <span style={{ fontFamily: f }}>{f}</span>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="Primary Gold"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Box
                                    sx={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 1,
                                      bgcolor: primaryColor,
                                      border: '1px solid #444',
                                    }}
                                  />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="Secondary Accent"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Box
                                    sx={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 1,
                                      bgcolor: secondaryColor,
                                      border: '1px solid #444',
                                    }}
                                  />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="Background Color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Box
                                    sx={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 1,
                                      bgcolor: backgroundColor,
                                      border: '1px solid #444',
                                    }}
                                  />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="Surface / Card"
                          value={surfaceColor}
                          onChange={(e) => setSurfaceColor(e.target.value)}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Box
                                    sx={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 1,
                                      bgcolor: surfaceColor,
                                      border: '1px solid #444',
                                    }}
                                  />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Stack>
                </Grid>

                {/* Live Preview Card */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: backgroundColor,
                      border: `1px solid ${primaryColor}40`,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: primaryColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          fontWeight: 700,
                        }}
                      >
                        Live Preview
                      </Typography>
                      <Box
                        sx={{
                          mt: 2,
                          p: 2,
                          borderRadius: 2,
                          bgcolor: surfaceColor,
                          border: `1px solid ${primaryColor}30`,
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{
                            color: textColor,
                            fontFamily: `${fontFamily}, serif`,
                            fontWeight: 600,
                          }}
                        >
                          {restaurantName || 'Restaurant Name'}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: primaryColor,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            display: 'block',
                            mb: 1.5,
                          }}
                        >
                          {tagline || 'Dining Room'}
                        </Typography>
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1.5 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: textColor }}>
                            Table 4 · 4 Guests
                          </Typography>
                          <Chip
                            label="CONFIRMED"
                            size="small"
                            sx={{
                              bgcolor: `${primaryColor}20`,
                              color: primaryColor,
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              border: `1px solid ${primaryColor}40`,
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Button
                      fullWidth
                      variant="contained"
                      sx={{
                        mt: 2,
                        bgcolor: primaryColor,
                        color: backgroundColor,
                        fontWeight: 700,
                        fontFamily: `${fontFamily}, sans-serif`,
                        '&:hover': { bgcolor: secondaryColor },
                      }}
                    >
                      Sample Action Button
                    </Button>
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(1)}
                  startIcon={<ArrowBackIcon />}
                  sx={{ borderColor: 'rgba(215, 180, 106, 0.3)', color: '#d7b46a' }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNextStep3}
                  disabled={submitting}
                  endIcon={submitting ? <CircularProgress size={18} /> : <ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#d7b46a',
                    color: '#111312',
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    '&:hover': { bgcolor: '#c4a055' },
                  }}
                >
                  Save & Continue
                </Button>
              </Box>
            </Box>
          )}

          {/* STEP 4: Service Operations */}
          {activeStep === 3 && (
            <Box>
              <Typography
                variant="h6"
                sx={{ color: '#d7b46a', fontFamily: 'Cinzel, serif', mb: 1 }}
              >
                Step 4: Restaurant Service Operations
              </Typography>
              <Typography variant="body2" sx={{ color: '#8e968b', mb: 3 }}>
                Configure your service shifts, operating days, and reservation pacing.
              </Typography>

              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#f4efe6', mb: 1 }}>
                    Operating Days
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {DAYS_OF_WEEK.map((day) => {
                      const selected = operatingDays.includes(day)
                      return (
                        <Chip
                          key={day}
                          label={day}
                          clickable
                          onClick={() => handleToggleDay(day)}
                          sx={{
                            bgcolor: selected ? 'rgba(215, 180, 106, 0.2)' : '#232724',
                            color: selected ? '#d7b46a' : '#8e968b',
                            border: `1px solid ${selected ? '#d7b46a' : 'rgba(255,255,255,0.06)'}`,
                            fontWeight: selected ? 600 : 400,
                          }}
                        />
                      )
                    })}
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="subtitle2" sx={{ color: '#f4efe6', mb: 1 }}>
                      Lunch Service
                    </Typography>
                    <Stack direction="row" spacing={1.5}>
                      <TextField
                        fullWidth
                        label="Start Time"
                        value={lunchStart}
                        onChange={(e) => setLunchStart(e.target.value)}
                      />
                      <TextField
                        fullWidth
                        label="End Time"
                        value={lunchEnd}
                        onChange={(e) => setLunchEnd(e.target.value)}
                      />
                    </Stack>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="subtitle2" sx={{ color: '#f4efe6', mb: 1 }}>
                      Dinner Service
                    </Typography>
                    <Stack direction="row" spacing={1.5}>
                      <TextField
                        fullWidth
                        label="Start Time"
                        value={dinnerStart}
                        onChange={(e) => setDinnerStart(e.target.value)}
                      />
                      <TextField
                        fullWidth
                        label="End Time"
                        value={dinnerEnd}
                        onChange={(e) => setDinnerEnd(e.target.value)}
                      />
                    </Stack>
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Slot Interval (minutes)"
                      value={reservationIntervalMin}
                      onChange={(e) => setReservationIntervalMin(Number(e.target.value))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Small Table Turn Time (min)"
                      value={turnTimeSmallMin}
                      onChange={(e) => setTurnTimeSmallMin(Number(e.target.value))}
                      helperText="Parties up to 4 covers"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Large Table Turn Time (min)"
                      value={turnTimeLargeMin}
                      onChange={(e) => setTurnTimeLargeMin(Number(e.target.value))}
                      helperText="Parties 5+ covers"
                    />
                  </Grid>
                </Grid>
              </Stack>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(2)}
                  startIcon={<ArrowBackIcon />}
                  sx={{ borderColor: 'rgba(215, 180, 106, 0.3)', color: '#d7b46a' }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNextStep4}
                  disabled={submitting}
                  endIcon={submitting ? <CircularProgress size={18} /> : <ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#d7b46a',
                    color: '#111312',
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    '&:hover': { bgcolor: '#c4a055' },
                  }}
                >
                  Save & Continue
                </Button>
              </Box>
            </Box>
          )}

          {/* STEP 5: Review & Complete Launch */}
          {activeStep === 4 && (
            <Box>
              <Typography
                variant="h6"
                sx={{ color: '#d7b46a', fontFamily: 'Cinzel, serif', mb: 1 }}
              >
                Step 5: Review & Launch Workspace
              </Typography>
              <Typography variant="body2" sx={{ color: '#8e968b', mb: 3 }}>
                Confirm your configuration before workspace creation. All operational data and credentials will be atomically finalized.
              </Typography>

              <Stack spacing={2.5}>
                {/* Summary Card 1: Restaurant Info */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#202421',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#d7b46a', mb: 1 }}>
                    Restaurant Information
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Name:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{restaurantName}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Phone:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{phoneNumber}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Address:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{address}, {country}</Typography>
                    </Grid>
                  </Grid>
                </Box>

                {/* Summary Card 2: Initial Manager Account */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#202421',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#d7b46a', mb: 1 }}>
                    Initial Manager Account
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Manager Name:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{managerName || 'Configured'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Staff ID:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{staffId || 'Configured'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Role:</Typography>
                      <Typography variant="body2" sx={{ color: '#81c784', fontWeight: 600 }}>
                        Manager (Server-Enforced)
                      </Typography>
                    </Grid>
                  </Grid>

                  {isResumedSession && (
                    <Box sx={{ mt: 2 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Confirm Manager Passcode (Optional — verify Step 2 passcode)"
                        type={showPasscode ? 'text' : 'password'}
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Re-enter your Step 2 passcode to verify, or leave blank to use saved credentials"
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockOutlinedIcon sx={{ color: '#8e968b', fontSize: 18 }} />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPasscode(!showPasscode)}
                                  edge="end"
                                  aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                                  sx={{ color: '#8e968b' }}
                                >
                                  {showPasscode ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Summary Card 3: Operations & Branding */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#202421',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#d7b46a', mb: 1 }}>
                    Branding & Operations
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Typography:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{fontFamily}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Lunch Service:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{lunchStart} – {lunchEnd}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#8e968b' }}>Dinner Service:</Typography>
                      <Typography variant="body2" sx={{ color: '#f4efe6' }}>{dinnerStart} – {dinnerEnd}</Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Stack>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(3)}
                  startIcon={<ArrowBackIcon />}
                  sx={{ borderColor: 'rgba(215, 180, 106, 0.3)', color: '#d7b46a' }}
                >
                  Back to Operations
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCompleteOnboarding}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={18} sx={{ color: '#111312' }} /> : <RocketLaunchIcon />}
                  sx={{
                    bgcolor: '#d7b46a',
                    color: '#111312',
                    fontWeight: 700,
                    px: 3.5,
                    py: 1.2,
                    fontSize: '0.95rem',
                    '&:hover': { bgcolor: '#c4a055' },
                  }}
                >
                  {submitting ? 'Initializing Workspace...' : 'Complete & Launch Restaurant'}
                </Button>
              </Box>
            </Box>
          )}
        </Card>
      </Container>
    </Box>
  )
}
