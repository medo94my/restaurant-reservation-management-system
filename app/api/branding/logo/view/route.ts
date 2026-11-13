import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getStaffContext } from '@/lib/staff-auth'

export const runtime = 'nodejs'

/**
 * Streams a restaurant logo from the private blob store to signed-in staff.
 * Logos are stored with `access: 'private'`, so raw blob URLs are not
 * directly renderable — clients use `logoViewSrc()` and hit this route.
 */
export async function GET(request: Request) {
  const context = await getStaffContext(request.headers)
  if (!context) return new NextResponse('Unauthorized', { status: 401 })

  const pathname = new URL(request.url).searchParams.get('pathname') ?? ''
  if (!pathname.startsWith(`restaurant-logos/${context.profile.restaurantId}/`)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const result = await get(pathname, { access: 'private' })
    if (!result) return new NextResponse('Not found', { status: 404 })
    return new NextResponse(result.stream, {
      headers: {
        'content-type': result.headers?.get('content-type') ?? 'application/octet-stream',
        'content-disposition': 'inline',
        'cache-control': 'private, max-age=60',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
