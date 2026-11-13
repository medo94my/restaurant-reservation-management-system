import { redirect } from 'next/navigation'
import { StaffEntry } from '@/components/auth/staff-auth'
import { getStaffContext, isManager } from '@/lib/staff-auth'

export default async function LoginPage() {
  const context = await getStaffContext()
  if (context) redirect(isManager(context) ? '/manager' : '/hostess')
  return <StaffEntry />
}
