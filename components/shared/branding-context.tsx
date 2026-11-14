'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  DEFAULT_BRANDING,
  resolveBrandFontCss,
  type RestaurantBrandingData,
} from '@/lib/branding/brand-tokens'

export { DEFAULT_BRANDING, resolveBrandFontCss, type RestaurantBrandingData }

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
