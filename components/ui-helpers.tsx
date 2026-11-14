import React from 'react'
import type { Booking, Unit } from '@/lib/restaurant-config'

/* =========================================================================
   Types
   ========================================================================= */

export interface ActiveStaffSession {
  name: string
  role: string
}

export interface MatchedCustomer {
  id: string
  name: string
  phone: string
  dietaryFlags?: string[]
  seatingPreferences?: string
  permanentNotes?: string
  visitCount?: number
  visits?: number
  loyaltyTier?: string
  note?: string
  occasionTags?: string[]
}

export interface LiveAlertNotification {
  id: string
  type: 'prep_due' | 'overstay'
  title: string
  message: string
  timestamp: number
}

export interface BookingFormState {
  guestName: string
  phone: string
  pax: number
  kind: Unit['kind']
  tableType: Booking['tableType']
  time: string
  note: string
  unitId: string | null
  occasionTags: string[]
  customOccasion?: string
}

export const DEFAULT_BOOKING_FORM: BookingFormState = {
  guestName: '',
  phone: '',
  pax: 2,
  kind: 'Table',
  tableType: 'any',
  time: '20:00',
  note: '',
  unitId: null,
  occasionTags: [],
  customOccasion: '',
}

/* =========================================================================
   Icon Component
   ========================================================================= */

export function Icon({ name, size = 19, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined app-icon ${className}`}
      aria-hidden="true"
      style={{ fontSize: size }}
    >
      {name}
    </span>
  )
}

/* =========================================================================
   Formatters
   ========================================================================= */

export const fmtTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function formatDateShort(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatDateLong(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatDateFull(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatClockTime(date: Date | null): string {
  if (!date) return '--:-- --'
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function formatServiceShift(date: Date | null): string {
  if (!date) return 'Today’s service · Evening'
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const shift = date.getHours() < 16 ? 'Lunch' : 'Evening'
  return `${weekday} service · ${shift}`
}

export function formatLoyaltyTier(tier?: string): string {
  if (!tier) return 'New'
  if (tier.toLowerCase() === 'vip') return 'VIP'
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

export function formatDietaryFlag(flag: string): string {
  const labels: Record<string, string> = {
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    gluten_free: 'Gluten-Free',
    nut_allergy: 'Nut Allergy',
    dairy_free: 'Dairy-Free',
    halal: 'Halal',
    kosher: 'Kosher',
    shellfish: 'Shellfish Allergy',
  }
  return labels[flag] || flag
}
