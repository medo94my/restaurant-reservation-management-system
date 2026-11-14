'use client'

import * as React from 'react'
import { ThemeProvider } from '@mui/material/styles'
import theme from '@/lib/theme'

export function MuiThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}

export default MuiThemeProvider
