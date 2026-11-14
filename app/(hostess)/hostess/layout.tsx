import React from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Box from '@mui/material/Box'
import { getStaffSession } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export default async function HostessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const staffSession = await getStaffSession(reqHeaders)

  if (!staffSession || !staffSession.user || !staffSession.user.isActive) {
    redirect('/login')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'var(--brand-bg, #111312)',
        color: 'var(--brand-text, #eee9df)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </Box>
  )
}
