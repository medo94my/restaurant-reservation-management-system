import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getStaffContext, isManager } from '@/lib/staff-auth'
import { isSameOrigin } from '@/lib/same-origin'

export const runtime = 'nodejs'

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif'])

function hasValidSignature(bytes: Buffer, contentType: string) {
  if (contentType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (contentType === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (contentType === 'image/avif') return bytes.toString('ascii', 4, 12).includes('ftypavif')
  return false
}

export async function POST(request: Request) {
  const context = await getStaffContext(request.headers)
  if (!isManager(context)) return NextResponse.json({ error: 'Manager access required.' }, { status: context ? 403 : 401 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image file.' }, { status: 400 })
  if (file.size < 1 || file.size > 2_000_000 || !allowedTypes.has(file.type)) {
    return NextResponse.json({ error: 'Use a PNG, JPEG, WebP, or AVIF logo up to 2 MB.' }, { status: 400 })
  }

  try {
    const signature = Buffer.from(await file.slice(0, 12).arrayBuffer())
    if (!hasValidSignature(signature, file.type)) return NextResponse.json({ error: 'The selected file is not a valid supported image.' }, { status: 400 })

    const blob = await put(`restaurant-logos/${context.profile.restaurantId}/logo`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })
    return NextResponse.json({ logo: { url: blob.url, pathname: blob.pathname, contentType: file.type, size: file.size } })
  } catch (error) {
    console.error('[branding] Logo upload failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Unable to upload the logo right now.' }, { status: 500 })
  }
}
