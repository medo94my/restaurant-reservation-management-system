import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/auth/auth'
import { customerService } from '@/lib/customer-service'
import { realtimeEventBus } from '@/lib/realtime-service'
import {
  reservationService,
  ReservationNotFoundError,
  InvalidReservationStateError,
  ReservationConflictError,
  ReservationValidationError,
} from '@/lib/reservation-service'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }> | { id: string }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const staffSession = await getStaffSession(request.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const params = await context.params
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Reservation ID is required.' }, { status: 400 })
    }

    const reservation = await reservationService.getReservation(id)
    if (!reservation) {
      return NextResponse.json({ error: `Reservation with ID ${id} not found.` }, { status: 404 })
    }

    return NextResponse.json({ reservation }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reservation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const staffSession = await getStaffSession(request.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const params = await context.params
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Reservation ID is required.' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
    }

    const {
      action,
      status,
      tableId,
      billAmount,
      reason,
      staffId,
      customerId,
      customerName,
      customerPhone,
      partySize,
      reservationTime,
      durationMinutes,
      notes,
      strictConflict,
    } = body as Record<string, unknown>
    const transition = String(action || status || '').toLowerCase().trim()

    const hasDetailFields =
      customerId !== undefined ||
      customerName !== undefined ||
      customerPhone !== undefined ||
      partySize !== undefined ||
      reservationTime !== undefined ||
      durationMinutes !== undefined ||
      notes !== undefined ||
      (!transition && tableId !== undefined)

    let updatedReservation

    switch (transition) {
      case 'seat':
      case 'seated': {
        const assignedTableId = typeof tableId === 'string' ? tableId.trim() : undefined
        updatedReservation = await reservationService.seatParty(
          id,
          assignedTableId,
          typeof staffId === 'string' ? staffId : undefined
        )
        break
      }

      case 'complete':
      case 'completed': {
        const bill = billAmount !== undefined ? Number(billAmount) : undefined
        updatedReservation = await reservationService.completeCheck(
          id,
          bill,
          typeof staffId === 'string' ? staffId : undefined,
          customerService
        )
        break
      }

      case 'cancel':
      case 'cancelled': {
        const cancelReason = typeof reason === 'string' ? reason : undefined
        updatedReservation = await reservationService.cancelReservation(
          id,
          cancelReason,
          typeof staffId === 'string' ? staffId : undefined
        )
        break
      }

      case 'confirm':
      case 'confirmed': {
        updatedReservation = await reservationService.confirmReservation(
          id,
          typeof staffId === 'string' ? staffId : undefined
        )
        break
      }

      case 'no_show':
      case 'noshow': {
        updatedReservation = await reservationService.markNoShow(
          id,
          typeof staffId === 'string' ? staffId : undefined
        )
        break
      }

      case 'booked':
      case 'pending':
      case 'unconfirm': {
        updatedReservation = await reservationService.updateReservation(
          id,
          {
            status: 'booked',
            ...(typeof customerId === 'string' ? { customerId } : {}),
            ...(typeof customerName === 'string' ? { customerName } : {}),
            ...(typeof customerPhone === 'string' ? { customerPhone } : {}),
            ...(partySize !== undefined ? { partySize: Number(partySize) } : {}),
            ...(typeof reservationTime === 'string' ? { reservationTime } : {}),
            ...(durationMinutes !== undefined ? { durationMinutes: Number(durationMinutes) } : {}),
            ...(tableId !== undefined
              ? { tableId: typeof tableId === 'string' && tableId.trim() ? tableId.trim() : null }
              : {}),
            ...(typeof notes === 'string' ? { notes } : {}),
            ...(typeof staffId === 'string' ? { staffId } : {}),
          },
          { strictOverlap: strictConflict === true }
        )
        break
      }

      case 'update':
      case 'edit':
      case '': {
        if (!transition && !hasDetailFields) {
          return NextResponse.json(
            {
              error: `Unsupported status transition '${transition}'. Valid actions are 'seat', 'complete', 'cancel', 'confirm', 'no_show', 'update'.`,
            },
            { status: 400 }
          )
        }
        updatedReservation = await reservationService.updateReservation(
          id,
          {
            ...(typeof customerId === 'string' ? { customerId } : {}),
            ...(typeof customerName === 'string' ? { customerName } : {}),
            ...(typeof customerPhone === 'string' ? { customerPhone } : {}),
            ...(partySize !== undefined ? { partySize: Number(partySize) } : {}),
            ...(typeof reservationTime === 'string' ? { reservationTime } : {}),
            ...(durationMinutes !== undefined ? { durationMinutes: Number(durationMinutes) } : {}),
            ...(tableId !== undefined
              ? { tableId: typeof tableId === 'string' && tableId.trim() ? tableId.trim() : null }
              : {}),
            ...(typeof notes === 'string' ? { notes } : {}),
            ...(typeof staffId === 'string' ? { staffId } : {}),
          },
          { strictOverlap: strictConflict === true }
        )
        break
      }

      default: {
        return NextResponse.json(
          {
            error: `Unsupported status transition '${transition}'. Valid actions are 'seat', 'complete', 'cancel', 'confirm', 'no_show'.`,
          },
          { status: 400 }
        )
      }
    }

    realtimeEventBus.broadcast({
      type: 'reservation:status_changed',
      payload: {
        reservationId: updatedReservation.id,
        status: updatedReservation.status,
        tableId: updatedReservation.tableId ?? undefined,
      },
    })

    if (updatedReservation.tableId) {
      if (updatedReservation.status === 'seated') {
        realtimeEventBus.broadcast({
          type: 'floor:unit_updated',
          payload: {
            unitId: updatedReservation.tableId,
            status: 'occupied',
            guest: updatedReservation.customerName,
            pax: updatedReservation.partySize,
          },
        })
      } else if (
        updatedReservation.status === 'completed' ||
        updatedReservation.status === 'cancelled' ||
        updatedReservation.status === 'no_show'
      ) {
        realtimeEventBus.broadcast({
          type: 'floor:unit_updated',
          payload: {
            unitId: updatedReservation.tableId,
            status: 'available',
            bill: updatedReservation.billAmount,
          },
        })
      }
    }

    return NextResponse.json({ reservation: updatedReservation })
  } catch (err: unknown) {
    if (err instanceof ReservationNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof InvalidReservationStateError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof ReservationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof ReservationValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unable to update reservation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
