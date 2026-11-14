import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { restaurantBranding } from '@/lib/schema'
import { requireManager } from '@/lib/auth/auth'

export const runtime = 'nodejs'

const MAX_LOGO_DATA_LENGTH = 2_800_000
const MAX_LOGO_URL_LENGTH = 2048
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i

function validateLogoData(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { ok: false, error: 'logoData must not be empty.' }
  }

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
    error: 'logoData must be an https:// URL, a relative path, or a valid base64 raster image.',
  }
}

export async function POST(request: Request) {
  try {
    const manager = await requireManager(request.headers)

    const body = await request.json().catch(() => null)
    if (!body || typeof body.logoData !== 'string') {
      return NextResponse.json({ error: 'logoData string is required.' }, { status: 400 })
    }

    const logoCheck = validateLogoData(body.logoData)
    if (!logoCheck.ok) {
      return NextResponse.json({ error: logoCheck.error }, { status: 400 })
    }

    const updated = await db
      .update(restaurantBranding)
      .set({
        logoUrl: logoCheck.value,
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
      logoUrl: logoCheck.value,
      message: 'Logo updated successfully.',
    })
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to update logo.' }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const manager = await requireManager(request.headers)

    const updated = await db
      .update(restaurantBranding)
      .set({
        logoUrl: '',
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
      logoUrl: '',
      message: 'Logo removed successfully.',
    })
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || 'Failed to delete logo.' }, { status })
  }
}
