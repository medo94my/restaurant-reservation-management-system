import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getStaffContext } from '@/lib/staff-auth'

export default async function HostessLayout({ children }: { children: ReactNode }) {
  const context = await getStaffContext()
  if (!context) redirect('/login')

  return children
}
