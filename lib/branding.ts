export type RestaurantBranding = {
  restaurantName: string
  tagline: string
  logo: {
    url: string
    pathname: string
    contentType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif'
    size: number
  } | null
  palette: {
    primary: string
    background: string
    surface: string
    text: string
  }
  font: 'sans' | 'serif' | 'system'
}

export const DEFAULT_BRANDING: RestaurantBranding = {
  restaurantName: 'Saffron & Cedar',
  tagline: 'Beirut · Dining Room',
  logo: null,
  palette: {
    primary: '#d7b46a',
    background: '#111312',
    surface: '#171a18',
    text: '#eee9df',
  },
  font: 'sans',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)

function relativeLuminance(value: string) {
  const channels = value.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? []
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

export function hasAccessibleBrandingContrast(branding: RestaurantBranding) {
  return contrastRatio(branding.palette.text, branding.palette.background) >= 4.5
    && contrastRatio(branding.palette.text, branding.palette.surface) >= 4.5
    && contrastRatio(branding.palette.background, branding.palette.primary) >= 4.5
}

export function isRestaurantBranding(value: unknown): value is RestaurantBranding {
  if (!isRecord(value) || !isRecord(value.palette)) return false
  const { restaurantName, tagline, logo, font, palette } = value
  if (typeof restaurantName !== 'string' || restaurantName.trim().length < 1 || restaurantName.length > 80) return false
  if (typeof tagline !== 'string' || tagline.length > 120) return false
  if (!['sans', 'serif', 'system'].includes(String(font))) return false
  if (!isHexColor(palette.primary) || !isHexColor(palette.background) || !isHexColor(palette.surface) || !isHexColor(palette.text)) return false
  if (!hasAccessibleBrandingContrast(value as RestaurantBranding)) return false
  if (logo === null) return true
  if (!isRecord(logo)) return false
  return typeof logo.url === 'string'
    && logo.url.startsWith('https://')
    && typeof logo.pathname === 'string'
    && logo.pathname.length <= 512
    && ['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(String(logo.contentType))
    && Number.isInteger(logo.size)
    && Number(logo.size) > 0
    && Number(logo.size) <= 2_000_000
}
