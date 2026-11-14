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
