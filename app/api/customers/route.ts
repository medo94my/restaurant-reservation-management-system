import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/auth/auth'
import {
  customerService,
  CustomerAlreadyExistsError,
  CustomerValidationError,
  maskCustomerForRole,
} from '@/lib/customer-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const staffSession = await getStaffSession(request?.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const role = staffSession.user.role
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('search') ?? ''
    const rawCustomers = await customerService.searchCustomers(query)
    const customers = rawCustomers.map((customer) => maskCustomerForRole(customer, role))
    return NextResponse.json({ customers }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to retrieve customers.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const staffSession = await getStaffSession(request?.headers).catch(() => null)
    if (!staffSession?.user || staffSession.user.isActive === false) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const role = staffSession.user.role
    const isManager = role === 'manager' || role === 'admin'

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Valid JSON request body required.' }, { status: 400 })
    }

    const {
      name,
      phone,
      dietaryFlags,
      seatingPreferences,
      permanentNotes,
      note,
      visitCount,
      totalSpend,
      occasionTags,
    } = body

    const customer = await customerService.createCustomer({
      name,
      phone,
      dietaryFlags,
      seatingPreferences,
      permanentNotes: permanentNotes ?? note,
      note,
      visitCount: isManager ? visitCount : 0,
      totalSpend: isManager ? totalSpend : 0,
      occasionTags,
    })

    return NextResponse.json(
      { customer: maskCustomerForRole(customer, role) },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof CustomerAlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Unable to create customer.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
