import React from 'react'
import { redirect } from 'next/navigation'
import Box from '@mui/material/Box'
import { ManagerNavSidebar } from '@/components/manager/manager-nav-sidebar'
import { getStaffSession } from '@/lib/auth/auth'

export const metadata = {
  title: 'Manager Administration | Saffron & Cedar',
  description: 'Executive management dashboard, branding customization, staff accounts, and restaurant controls.',
}

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staffSession = await getStaffSession()

  if (!staffSession || !staffSession.user || !staffSession.user.isActive) {
    redirect('/login')
  }

  const role = staffSession.user.role
  if (role !== 'manager' && role !== 'admin') {
    redirect('/hostess')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#111312',
        color: '#eee9df',
      }}
    >
      <ManagerNavSidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2.5, sm: 4 },
          overflowY: 'auto',
          maxHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
