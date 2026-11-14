import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/auth/auth'
import { realtimeEventBus } from '@/lib/realtime-service'
import {
  reservationService,
  ReservationValidationError,
  ReservationConflictError,
  type ReservationStatus,
} from '@/lib/reservation-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const staffSession = await getStaffSession(request.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || undefined
    const statusParam = searchParams.get('status')
    const tableId = searchParams.get('tableId') || undefined
    const customerId = searchParams.get('customerId') || undefined

    let status: ReservationStatus | ReservationStatus[] | undefined
    if (statusParam) {
      if (statusParam.includes(',')) {
        status = statusParam.split(',').map((s) => s.trim()) as ReservationStatus[]
      } else {
        status = statusParam.trim() as ReservationStatus
      }
    }

    const reservations = await reservationService.listReservations({
      date,
      status,
      tableId,
      customerId,
    })

    return NextResponse.json({ reservations }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reservations.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const staffSession = await getStaffSession(request.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
    }

    const {
      customerId,
      partySize,
      reservationTime,
      tableId,
      durationMinutes,
      customerName,
      customerPhone,
      notes,
      staffId,
      strictConflict,
    } = body as Record<string, unknown>

    if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
      return NextResponse.json({ error: 'customerId is required.' }, { status: 400 })
    }

    const parsedPartySize = Number(partySize)
    if (!partySize || Number.isNaN(parsedPartySize) || parsedPartySize < 1) {
      return NextResponse.json({ error: 'partySize must be a positive integer.' }, { status: 400 })
    }

    if (!reservationTime || typeof reservationTime !== 'string' || Number.isNaN(new Date(reservationTime).getTime())) {
      return NextResponse.json({ error: 'reservationTime must be a valid ISO date string.' }, { status: 400 })
    }

    const parsedTableId = typeof tableId === 'string' && tableId.trim() ? tableId.trim() : null

    const reservation = await reservationService.createReservation(
      {
        customerId: customerId.trim(),
        partySize: parsedPartySize,
        reservationTime,
        tableId: parsedTableId,
        durationMinutes: durationMinutes !== undefined ? Number(durationMinutes) : undefined,
        customerName: typeof customerName === 'string' ? customerName : undefined,
        customerPhone: typeof customerPhone === 'string' ? customerPhone : undefined,
        notes: typeof notes === 'string' ? notes : undefined,
        staffId: typeof staffId === 'string' ? staffId : undefined,
      },
      { strictOverlap: strictConflict === true }
    )

    realtimeEventBus.broadcast({
      type: 'reservation:created',
      payload: {
        reservationId: reservation.id,
        customerName:
          reservation.customerName ||
          (typeof customerName === 'string' ? customerName : 'Guest'),
        partySize: reservation.partySize,
        time: reservation.reservationTime,
        tableId: reservation.tableId ?? undefined,
      },
    })

    return NextResponse.json(
      {
        reservation,
        warning: reservation.warning ?? undefined,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    if (err instanceof ReservationValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof ReservationConflictError) {
      return NextResponse.json(
        {
          error: err.message,
          conflicts: err.conflicts ?? [],
        },
        { status: 409 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unable to create reservation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
