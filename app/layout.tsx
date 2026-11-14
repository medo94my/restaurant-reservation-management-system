import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import StyledJsxRegistry from './registry'
import './globals.css'

const dmSans = DM_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})
const playfair = Playfair_Display({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Saffron & Cedar | Restaurant Operations',
  description:
    'Secure restaurant operations for staff access, reservations, guest service, team management, and restaurant branding.'
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#111713' },
    { media: '(prefers-color-scheme: dark)', color: '#111713' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        {/* Icon font is self-hosted (public/fonts, see globals.css) — preloaded
            so the first paint already has it and no icon text ever flashes. */}
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <StyledJsxRegistry>{children}</StyledJsxRegistry>
      </body>
    </html>
  )
}
