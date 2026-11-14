import type { Metadata, Viewport } from 'next'
import type { CSSProperties } from 'react'
import {
  Cinzel,
  DM_Sans,
  Inter,
  Merriweather,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Roboto,
} from 'next/font/google'
import { eq } from 'drizzle-orm'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { MuiThemeProvider } from '@/components/theme-provider'
import { BrandingProvider } from '@/components/shared/branding-context'
import {
  DEFAULT_BRANDING,
  resolveBrandFontCss,
  type RestaurantBrandingData,
} from '@/lib/branding/brand-tokens'
import { db } from '@/lib/db'
import { restaurantBranding } from '@/lib/schema'
import './globals.css'
import './dining-room.css'

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
})

const cinzel = Cinzel({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
})

const merriweather = Merriweather({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-merriweather',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
  display: 'swap',
})

const fontVariables = [
  roboto.variable,
  cinzel.variable,
  inter.variable,
  plusJakartaSans.variable,
  merriweather.variable,
  dmSans.variable,
  playfairDisplay.variable,
].join(' ')

async function getPublishedBranding(): Promise<RestaurantBrandingData> {
  try {
    const [row] = await db
      .select()
      .from(restaurantBranding)
      .where(eq(restaurantBranding.id, 'default'))
      .limit(1)

    if (!row || row.isPublished === false) {
      return DEFAULT_BRANDING
    }

    return {
      id: row.id,
      restaurantName: row.restaurantName,
      tagline: row.tagline,
      logoUrl: row.logoUrl,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      backgroundColor: row.backgroundColor,
      surfaceColor: row.surfaceColor,
      textColor: row.textColor,
      fontFamily: row.fontFamily,
      isPublished: row.isPublished,
    }
  } catch {
    return DEFAULT_BRANDING
  }
}

export const metadata: Metadata = {
  title: 'Saffron & Cedar | Guest & Floor Manager',
  description:
    'Manage guest visit tiers, occasion tags, reservations, and an editable dining-room floor plan for Saffron & Cedar.'
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#111312' },
    { media: '(prefers-color-scheme: dark)', color: '#111312' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialBranding = await getPublishedBranding()
  const brandFontCss = resolveBrandFontCss(initialBranding.fontFamily)
  const initialCssVars = {
    '--brand-primary': initialBranding.primaryColor,
    '--brand-secondary': initialBranding.secondaryColor,
    '--brand-bg': initialBranding.backgroundColor,
    '--brand-surface': initialBranding.surfaceColor,
    '--brand-text': initialBranding.textColor,
    '--brand-font': brandFontCss,
    '--md-sys-color-primary': initialBranding.primaryColor,
    '--md-sys-color-secondary': initialBranding.secondaryColor,
    '--md-sys-color-background': initialBranding.backgroundColor,
    '--md-sys-color-surface': initialBranding.surfaceColor,
    '--md-sys-color-on-background': initialBranding.textColor,
    '--md-sys-color-on-surface': initialBranding.textColor,
    '--md-ref-typeface-brand': brandFontCss,
  } as CSSProperties

  return (
    <html lang="en" className={fontVariables} style={initialCssVars} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppRouterCacheProvider>
          <MuiThemeProvider>
            <BrandingProvider initialBranding={initialBranding}>
              {children}
            </BrandingProvider>
          </MuiThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
