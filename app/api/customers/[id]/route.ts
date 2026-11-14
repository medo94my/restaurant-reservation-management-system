import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/auth/auth'
import {
  customerService,
  CustomerAlreadyExistsError,
  CustomerNotFoundError,
  CustomerValidationError,
  maskCustomerForRole,
} from '@/lib/customer-service'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const staffSession = await getStaffSession(request?.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const role = staffSession.user.role
    const params = await context.params
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required.' }, { status: 400 })
    }

    const customer = await customerService.getCustomerById(id)
    if (!customer) {
      return NextResponse.json({ error: `Customer with ID ${id} not found.` }, { status: 404 })
    }

    return NextResponse.json(
      { customer: maskCustomerForRole(customer, role) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to retrieve customer.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const staffSession = await getStaffSession(request?.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const role = staffSession.user.role
    const isManager = role === 'manager' || role === 'admin'

    const params = await context.params
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required.' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Valid JSON update payload required.' }, { status: 400 })
    }

    // Support visit and spend recording if specified
    if (body.recordVisit === true || (body.billAmount !== undefined && body.action === 'record-visit')) {
      const bill = Number(body.billAmount ?? 0)
      if (isNaN(bill) || bill < 0) {
        return NextResponse.json({ error: 'Valid bill amount is required.' }, { status: 400 })
      }
      const customer = await customerService.recordVisitAndSpend(id, bill)
      return NextResponse.json({ customer: maskCustomerForRole(customer, role) })
    }

    const updatePayload = isManager
      ? body
      : {
          ...body,
          visitCount: undefined,
          totalSpend: undefined,
        }

    const customer = await customerService.updateCustomer(id, updatePayload)
    return NextResponse.json({ customer: maskCustomerForRole(customer, role) })
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof CustomerValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof CustomerAlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Unable to update customer.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
