import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { ManagerShell } from '@/components/manager/manager-shell'
import { getStaffContext, isManager } from '@/lib/staff-auth'

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const context = await getStaffContext()
  if (!context) redirect('/login')
  if (!isManager(context)) redirect('/hostess')

  return <ManagerShell staff={{ name: context.profile.name, staffId: context.profile.staffId, role: context.profile.role }}>{children}</ManagerShell>
}
