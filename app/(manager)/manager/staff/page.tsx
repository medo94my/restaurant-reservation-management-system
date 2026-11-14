import { ManagerStaffView } from '@/components/manager/manager-staff-view'

export const metadata = {
  title: 'Staff Management | Saffron & Cedar',
  description: 'Manage staff accounts, assign roles, reset passcodes, and control access permissions.',
}

export default function StaffPage() {
  return <ManagerStaffView />
}
