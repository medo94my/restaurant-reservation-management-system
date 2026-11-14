import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { restaurantBranding, type RestaurantBranding } from '@/lib/schema'
import { getStaffSession, requireManager } from '@/lib/auth/auth'

export const runtime = 'nodejs'

const MAX_LOGO_DATA_LENGTH = 2_800_000
const MAX_LOGO_URL_LENGTH = 2048
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const ALLOWED_FONTS = new Set([
  'Cinzel',
  'Inter',
  'Plus Jakarta Sans',
  'Merriweather',
  'DM Sans',
  'Playfair Display',
])

function validateLogoValue(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: '' }

  if (trimmed.startsWith('data:')) {
    if (trimmed.length > MAX_LOGO_DATA_LENGTH) {
      return { ok: false, error: 'Logo image exceeds 2MB size limit.' }
    }
    if (!SAFE_DATA_IMAGE_RE.test(trimmed)) {
      return {
        ok: false,
        error: 'Unsupported logo data URI. Only base64 PNG, JPEG, WebP, GIF, and AVIF images are allowed.',
      }
    }
    return { ok: true, value: trimmed }
  }

  if (trimmed.length > MAX_LOGO_URL_LENGTH || /[\s<>'"\\]/.test(trimmed)) {
    return { ok: false, error: 'Invalid logo URL.' }
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { ok: true, value: trimmed }
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:') {
      return { ok: true, value: trimmed }
    }
  } catch {
    // Fall through to error
  }

  return {
    ok: false,
    error: 'Logo URL must be an https:// URL, a relative path, or a valid base64 raster image.',
  }
}

const DEFAULT_BRANDING: Omit<RestaurantBranding, 'updatedAt' | 'updatedByStaffId'> = {
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
  workspaceId: null,
}

export async function GET(request: Request) {
  try {
    const [branding] = await db
      .select()
      .from(restaurantBranding)
      .where(eq(restaurantBranding.id, 'default'))
      .limit(1)

    if (!branding) {
      return NextResponse.json({ branding: DEFAULT_BRANDING }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (branding.isPublished === false) {
      const staffSession = await getStaffSession(request.headers).catch(() => null)
      const isManager = Boolean(
        staffSession?.user &&
          staffSession.user.isActive !== false &&
          (staffSession.user.role === 'manager' || staffSession.user.role === 'admin')
      )
      if (!isManager) {
        return NextResponse.json({ branding: DEFAULT_BRANDING }, { headers: { 'Cache-Control': 'no-store' } })
      }
    }

    return NextResponse.json({ branding }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.warn('Failed to fetch branding, using defaults', err)
    return NextResponse.json({ branding: DEFAULT_BRANDING }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function PUT(request: Request) {
  try {
    const manager = await requireManager(request.headers)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
    }

    const {
      restaurantName,
      tagline,
      logoUrl,
      primaryColor,
      secondaryColor,
      backgroundColor,
      surfaceColor,
      textColor,
      fontFamily,
      isPublished,
    } = body as Record<string, unknown>

    const updateData: Partial<RestaurantBranding> = {
      updatedByStaffId: manager.id,
      updatedAt: new Date(),
    }

    if (restaurantName !== undefined) {
      if (typeof restaurantName !== 'string' || !restaurantName.trim() || restaurantName.trim().length > 120) {
        return NextResponse.json({ error: 'Invalid restaurantName.' }, { status: 400 })
      }
      updateData.restaurantName = restaurantName.trim()
    }

    if (tagline !== undefined) {
      if (typeof tagline !== 'string' || tagline.trim().length > 160) {
        return NextResponse.json({ error: 'Invalid tagline.' }, { status: 400 })
      }
      updateData.tagline = tagline.trim()
    }

    if (logoUrl !== undefined) {
      if (typeof logoUrl !== 'string') {
        return NextResponse.json({ error: 'logoUrl must be a string.' }, { status: 400 })
      }
      const logoCheck = validateLogoValue(logoUrl)
      if (!logoCheck.ok) {
        return NextResponse.json({ error: logoCheck.error }, { status: 400 })
      }
      updateData.logoUrl = logoCheck.value
    }

    const colorFields = [
      ['primaryColor', primaryColor],
      ['secondaryColor', secondaryColor],
      ['backgroundColor', backgroundColor],
      ['surfaceColor', surfaceColor],
      ['textColor', textColor],
    ] as const

    for (const [field, val] of colorFields) {
      if (val !== undefined) {
        if (typeof val !== 'string' || !HEX_COLOR_RE.test(val.trim())) {
          return NextResponse.json({ error: `Invalid hex color for ${field}.` }, { status: 400 })
        }
        updateData[field] = val.trim()
      }
    }

    if (fontFamily !== undefined) {
      if (typeof fontFamily !== 'string' || !ALLOWED_FONTS.has(fontFamily.trim())) {
        return NextResponse.json({ error: 'Unsupported fontFamily.' }, { status: 400 })
      }
      updateData.fontFamily = fontFamily.trim()
    }

    if (isPublished !== undefined) {
      if (typeof isPublished !== 'boolean') {
        return NextResponse.json({ error: 'isPublished must be a boolean.' }, { status: 400 })
      }
      updateData.isPublished = isPublished
    }

    const [saved] = await db
      .insert(restaurantBranding)
      .values({
        id: 'default',
        restaurantName: updateData.restaurantName ?? 'Saffron & Cedar',
        tagline: updateData.tagline ?? 'Beirut Dining Room',
        logoUrl: updateData.logoUrl ?? '',
        primaryColor: updateData.primaryColor ?? '#d7b46a',
        secondaryColor: updateData.secondaryColor ?? '#bfa15f',
        backgroundColor: updateData.backgroundColor ?? '#111312',
        surfaceColor: updateData.surfaceColor ?? '#171a18',
        textColor: updateData.textColor ?? '#f4efe6',
        fontFamily: updateData.fontFamily ?? 'Cinzel',
        isPublished: updateData.isPublished ?? true,
        updatedByStaffId: manager.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: restaurantBranding.id,
        set: updateData,
      })
      .returning()

    return NextResponse.json({
      success: true,
      branding: saved || DEFAULT_BRANDING,
      message: 'Branding updated successfully.',
    })
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to update branding.' }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const manager = await requireManager(request.headers)

    const updated = await db
      .update(restaurantBranding)
      .set({
        ...DEFAULT_BRANDING,
        updatedByStaffId: manager.id,
        updatedAt: new Date(),
      })
      .where(eq(restaurantBranding.id, 'default'))
      .returning({ id: restaurantBranding.id })

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Branding record not found.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      branding: DEFAULT_BRANDING,
      message: 'Branding reset to default values.',
    })
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to reset branding.' }, { status })
  }
}
