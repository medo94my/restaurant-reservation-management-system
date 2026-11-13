import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { StaffAccountBar } from '@/components/auth/staff-auth'
import { getStaffContext } from '@/lib/staff-auth'

export default async function HostessLayout({ children }: { children: ReactNode }) {
  const context = await getStaffContext()
  if (!context) redirect('/login')

  return <>
    <StaffAccountBar profile={{ name: context.profile.name, staffId: context.profile.staffId, role: context.profile.role }} />
    {children}
  </>
}
