'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export interface RestaurantBrandingData {
  id: string
  restaurantName: string
  tagline: string
  logoUrl?: string | null
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  fontFamily: string
  isPublished?: boolean
}

export const DEFAULT_BRANDING: RestaurantBrandingData = {
  id: 'default',
  restaurantName: 'Saffron & Cedar',
  tagline: 'Beirut Dining Room',
  logoUrl: '',
  primaryColor: '#d7b46a',
  secondaryColor: '#bfa15f',
  backgroundColor: '#111312',
  surfaceColor: '#171a18',
  textColor: '#f4efe6',
  fontFamily: 'Cinzel',
  isPublished: true,
}

const FONT_VARIABLE_MAP: Record<string, string> = {
  Cinzel: "var(--font-cinzel), 'Cinzel', Georgia, serif",
  'Playfair Display': "var(--font-playfair-display), 'Playfair Display', Georgia, serif",
  Inter: "var(--font-inter), 'Inter', system-ui, sans-serif",
  'Plus Jakarta Sans': "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', system-ui, sans-serif",
  Merriweather: "var(--font-merriweather), 'Merriweather', Georgia, serif",
  'DM Sans': "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif",
}

export function resolveBrandFontCss(fontFamily?: string): string {
  if (fontFamily && FONT_VARIABLE_MAP[fontFamily]) {
    return FONT_VARIABLE_MAP[fontFamily]
  }
  return FONT_VARIABLE_MAP.Cinzel
}

interface BrandingContextType {
  branding: RestaurantBrandingData
  setBranding: React.Dispatch<React.SetStateAction<RestaurantBrandingData>>
  refreshBranding: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  setBranding: () => {},
  refreshBranding: async () => {},
})

export function BrandingProvider({
  children,
  initialBranding,
}: {
  children: React.ReactNode
  initialBranding?: RestaurantBrandingData
}) {
  const [branding, setBranding] = useState<RestaurantBrandingData>(
    initialBranding || DEFAULT_BRANDING
  )

  const refreshBranding = async () => {
    try {
      const res = await fetch('/api/branding')
      if (res.ok) {
        const data = await res.json()
        if (data?.branding) {
          setBranding(data.branding)
        }
      }
    } catch (err) {
      console.warn('Could not fetch updated branding', err)
    }
  }

  useEffect(() => {
    refreshBranding()
  }, [])

  // Apply CSS custom properties to the document root
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      const fontCss = resolveBrandFontCss(branding.fontFamily)
      root.style.setProperty('--brand-primary', branding.primaryColor)
      root.style.setProperty('--brand-secondary', branding.secondaryColor)
      root.style.setProperty('--brand-bg', branding.backgroundColor)
      root.style.setProperty('--brand-surface', branding.surfaceColor)
      root.style.setProperty('--brand-text', branding.textColor)
      root.style.setProperty('--brand-font', fontCss)
      root.style.setProperty('--md-sys-color-primary', branding.primaryColor)
      root.style.setProperty('--md-sys-color-secondary', branding.secondaryColor)
      root.style.setProperty('--md-sys-color-background', branding.backgroundColor)
      root.style.setProperty('--md-sys-color-surface', branding.surfaceColor)
      root.style.setProperty('--md-sys-color-on-background', branding.textColor)
      root.style.setProperty('--md-sys-color-on-surface', branding.textColor)
      root.style.setProperty('--md-ref-typeface-brand', fontCss)
    }
  }, [branding])

  return (
    <BrandingContext.Provider value={{ branding, setBranding, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
