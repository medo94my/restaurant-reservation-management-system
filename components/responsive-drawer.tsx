'use client'

import React from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { Icon } from './ui-helpers'

export interface ResponsiveDrawerProps {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title?: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  width?: number | string
  maxWidth?: number | string
  'aria-labelledby'?: string
}

export function ResponsiveDrawer({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  children,
  actions,
  width = 460,
  maxWidth = '92vw',
  'aria-labelledby': ariaLabelledBy,
}: ResponsiveDrawerProps) {
  const theme = useTheme()
  const fallbackId = React.useId()
  const titleId = ariaLabelledBy || `drawer-title-${fallbackId}`
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Breakpoint: under 768px is treated as phone (bottom sheet); 768px and up (tablets/iPads/desktop) is right drawer
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))

  const anchor = isPhone ? 'bottom' : 'right'

  return (
    <Drawer
      anchor={anchor}
      open={mounted && open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(7, 9, 8, 0.72)',
            backdropFilter: 'blur(5px)',
          },
        },
        paper: {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': title ? titleId : undefined,
          tabIndex: -1,
          sx: {
            backgroundColor: '#181c19',
            backgroundImage: 'linear-gradient(180deg, rgba(215,180,106,0.03) 0%, rgba(24,28,25,1) 120px)',
            color: '#eee9df',
            boxShadow: isPhone
              ? '0 -10px 40px rgba(0,0,0,0.85)'
              : '-10px 0 45px rgba(0,0,0,0.85)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            ...(isPhone
              ? {
                  width: '100%',
                  maxHeight: '90vh',
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  borderTop: '1px solid #3c423d',
                  pb: 'max(env(safe-area-inset-bottom, 16px), 16px)',
                }
              : {
                  width,
                  maxWidth,
                  height: '100%',
                  borderLeft: '1px solid #343a35',
                }),
          },
        },
      }}
    >
      {/* Mobile drag handle bar */}
      {isPhone && (
        <Box
          aria-hidden="true"
          sx={{
            pt: 1.5,
            pb: 0.5,
            display: 'flex',
            justifyContent: 'center',
            cursor: 'grab',
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 4.5,
              borderRadius: 3,
              backgroundColor: '#4e554d',
            }}
          />
        </Box>
      )}

      {/* Drawer Header */}
      {(title || eyebrow || subtitle) && (
        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            pt: isPhone ? 1.5 : 3,
            pb: 2,
            borderBottom: '1px solid #2b312c',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {eyebrow && (
              <Typography
                variant="caption"
                sx={{
                  color: '#dfbf7c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  fontWeight: 700,
                  fontSize: '0.6875rem',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {eyebrow}
              </Typography>
            )}
            {typeof title === 'string' ? (
              <Typography
                id={titleId}
                variant="h5"
                sx={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontWeight: 600,
                  color: '#f4efe6',
                  fontSize: { xs: '1.25rem', sm: '1.4rem' },
                  lineHeight: 1.25,
                }}
              >
                {title}
              </Typography>
            ) : (
              <Box id={titleId}>{title}</Box>
            )}
            {subtitle && (
              <Typography
                component="div"
                variant="body2"
                sx={{
                  color: '#a8aea5',
                  mt: 0.5,
                  fontSize: '0.8125rem',
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          <IconButton
            onClick={onClose}
            aria-label="Close drawer"
            sx={{
              color: '#9da49a',
              backgroundColor: '#232924',
              borderRadius: 2,
              p: 1.25,
              width: 44,
              height: 44,
              minWidth: 44,
              minHeight: 44,
              mt: -0.5,
              mr: -0.5,
              '&:hover': {
                color: '#eee9df',
                backgroundColor: '#2e352f',
              },
              '&:focus-visible': {
                outline: '2px solid #d7b46a',
                outlineOffset: '2px',
              },
            }}
          >
            <Icon name="close" size={20} />
          </IconButton>
        </Box>
      )}

      {/* Drawer Body - Scrollable */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2.5, sm: 3 },
          py: 2.5,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </Box>

      {/* Drawer Footer Actions */}
      {actions && (
        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: 2,
            borderTop: '1px solid #2b312c',
            backgroundColor: '#151816',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1.5,
            '& .MuiButton-root': {
              minHeight: 44,
            },
          }}
        >
          {actions}
        </Box>
      )}
    </Drawer>
  )
}

export default ResponsiveDrawer
