import { HostessReservationsView } from '@/components/hostess/hostess-reservations-view'

export const metadata = {
  title: 'Arrivals & Reservations | Saffron & Cedar Hostess',
  description: 'Manage tonight\'s guest arrivals, table assignments, and service run sheet.',
}

export default function HostessReservationsPage() {
  return <HostessReservationsView />
}
