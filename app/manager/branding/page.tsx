import { redirect } from 'next/navigation'

export default function BrandingRedirectPage() {
  redirect('/manager/settings')
}
