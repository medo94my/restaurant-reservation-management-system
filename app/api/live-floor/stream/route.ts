import { getStaffSession } from '../../../../lib/auth/auth.ts'
import {
  DEFAULT_SSE_HEARTBEAT_MS,
  clampHeartbeatInterval,
  realtimeEventBus,
} from '../../../../lib/realtime-service.ts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const staffSession = await getStaffSession(request.headers).catch(() => null)
  if (!staffSession || !staffSession.user || !staffSession.user.isActive) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  let heartbeatIntervalMs = DEFAULT_SSE_HEARTBEAT_MS

  try {
    const url = new URL(request.url)
    const customHeartbeat = url.searchParams.get('heartbeat')
    heartbeatIntervalMs = clampHeartbeatInterval(customHeartbeat)
  } catch {
    // If request.url is relative or invalid, fall back to default
  }

  const stream = realtimeEventBus.createSseStream({
    signal: request.signal,
    heartbeatIntervalMs,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
