import { and, asc, eq, gte, lt, ne, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, restaurantGuestProfiles, restaurantReservations, restaurantServiceEvents, restaurantUnitStates, restaurantWorkspaceConfig } from '@/lib/db'
import { getStaffContext, isManager } from '@/lib/staff-auth'
import { DEFAULT_FLOOR_ITEMS, RESTAURANT_MANAGER_USER_ID } from '@/lib/restaurant-config'
import type { CustomerProfile, RestaurantConfig, Unit } from '@/lib/restaurant-config'

const restaurantId = RESTAURANT_MANAGER_USER_ID
const restaurantTimeZone = 'Asia/Beirut'
const unitStatuses = ['available', 'seated', 'prep', 'blocked'] as const
const unitKinds = ['Table', 'Couch', 'Room'] as const

type UnitStatus = (typeof unitStatuses)[number]

function beirutDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: restaurantTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function addMonths(dateKey: string, months: number) {
  const [year, month] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10)
}

function localMidnightAsUtc(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day)
  let candidate = target
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: restaurantTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]))
    const localAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    const difference = localAsUtc - target
    if (difference === 0) break
    candidate -= difference
  }

  return new Date(candidate)
}

function isSameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin
}

async function hasStaffSession(request: Request) {
  return Boolean(await getStaffContext(request.headers))
}

async function getFloorItems(): Promise<Unit[]> {
  const [row] = await db
    .select({ config: restaurantWorkspaceConfig.config })
    .from(restaurantWorkspaceConfig)
    .where(eq(restaurantWorkspaceConfig.userId, restaurantId))
    .limit(1)

  const saved = row?.config as (Partial<RestaurantConfig> & { tables?: Unit[] }) | undefined
  const floorItems = saved?.floorItems ?? saved?.tables ?? DEFAULT_FLOOR_ITEMS
  return Array.isArray(floorItems) ? floorItems.filter((item): item is Unit => Boolean(item && typeof item.id === 'string')) : DEFAULT_FLOOR_ITEMS
}

async function ensureUnitStates(floorItems: Unit[]) {
  if (!floorItems.length) return

  await db
    .insert(restaurantUnitStates)
    .values(floorItems.map((item) => ({
      restaurantId,
      unitId: item.id,
      status: item.status === 'blocked' ? 'blocked' : 'available',
      notes: '',
    })))
    .onConflictDoNothing()
}

async function migrateGuestProfiles() {
  const existing = await db
    .select({ phone: restaurantGuestProfiles.phone })
    .from(restaurantGuestProfiles)
    .where(eq(restaurantGuestProfiles.restaurantId, restaurantId))
    .limit(1)

  if (existing.length) return

  const [row] = await db
    .select({ config: restaurantWorkspaceConfig.config })
    .from(restaurantWorkspaceConfig)
    .where(eq(restaurantWorkspaceConfig.userId, restaurantId))
    .limit(1)

  const saved = row?.config as (Partial<RestaurantConfig> & { customers?: CustomerProfile[] }) | undefined
  const customers = Array.isArray(saved?.customers) ? saved.customers : []
  if (!customers.length) return

  await db
    .insert(restaurantGuestProfiles)
    .values(customers
      .filter((customer) => typeof customer.phone === 'string' && typeof customer.name === 'string')
      .map((customer) => ({
        restaurantId,
        phone: customer.phone.trim(),
        name: customer.name.trim(),
        visits: Math.max(0, Math.floor(Number(customer.visits) || 0)),
        note: typeof customer.note === 'string' ? customer.note.slice(0, 500) : '',
        occasionTags: Array.isArray(customer.occasionTags) ? customer.occasionTags.filter((tag) => typeof tag === 'string').slice(0, 40) : [],
      })))
    .onConflictDoNothing()
}

function serializeReservation(row: typeof restaurantReservations.$inferSelect) {
  return {
    id: Number(row.id),
    name: row.guestName,
    phone: row.guestPhone,
    pax: row.partySize,
    time: row.reservationTime.slice(0, 5),
    kind: row.unitKind,
    tableType: row.tableType,
    note: row.notes,
    unit: row.unitId,
    tags: row.occasionTags,
    arrived: row.status === 'arrived' || row.status === 'seated' || row.status === 'completed',
    status: row.status,
    bill: Number(row.billAmount ?? 0),
  }
}

function serializeUnitState(row: typeof restaurantUnitStates.$inferSelect) {
  return {
    unitId: row.unitId,
    status: row.status as UnitStatus,
    guest: row.guestName ?? undefined,
    phone: row.guestPhone ?? undefined,
    pax: row.partySize ?? undefined,
    time: row.serviceTime ?? undefined,
    note: row.notes,
    bill: row.billAmount == null ? undefined : Number(row.billAmount),
    reservationId: row.reservationId == null ? undefined : Number(row.reservationId),
  }
}

export async function GET(request: Request) {
  if (!(await hasStaffSession(request))) {
    return NextResponse.json({ error: 'Sign in to access restaurant data.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const requestedDate = new URL(request.url).searchParams.get('date')
  const serviceDate = isDateKey(requestedDate) ? requestedDate : beirutDate()
  const dayStart = localMidnightAsUtc(serviceDate)
  const dayEnd = localMidnightAsUtc(addDays(serviceDate, 1))
  const monthStartDate = `${serviceDate.slice(0, 7)}-01`
  const monthStart = localMidnightAsUtc(monthStartDate)
  const monthEnd = localMidnightAsUtc(addMonths(monthStartDate, 1))

  try {
    const floorItems = await getFloorItems()
    await ensureUnitStates(floorItems)
    await migrateGuestProfiles()

    const [reservations, unitStates, completedToday, completedThisMonth, customers] = await Promise.all([
      db.select().from(restaurantReservations)
        .where(and(
          eq(restaurantReservations.restaurantId, restaurantId),
          eq(restaurantReservations.serviceDate, serviceDate),
          ne(restaurantReservations.status, 'cancelled'),
        ))
        .orderBy(asc(restaurantReservations.reservationTime), asc(restaurantReservations.id)),
      db.select().from(restaurantUnitStates)
        .where(eq(restaurantUnitStates.restaurantId, restaurantId)),
      db.select({ partySize: restaurantServiceEvents.partySize, billAmount: restaurantServiceEvents.billAmount })
        .from(restaurantServiceEvents)
        .where(and(
          eq(restaurantServiceEvents.restaurantId, restaurantId),
          eq(restaurantServiceEvents.eventType, 'completed'),
          gte(restaurantServiceEvents.occurredAt, dayStart),
          lt(restaurantServiceEvents.occurredAt, dayEnd),
        )),
      db.select({ guestPhone: restaurantServiceEvents.guestPhone })
        .from(restaurantServiceEvents)
        .where(and(
          eq(restaurantServiceEvents.restaurantId, restaurantId),
          eq(restaurantServiceEvents.eventType, 'completed'),
          gte(restaurantServiceEvents.occurredAt, monthStart),
          lt(restaurantServiceEvents.occurredAt, monthEnd),
        )),
      db.select().from(restaurantGuestProfiles)
        .where(eq(restaurantGuestProfiles.restaurantId, restaurantId))
        .orderBy(asc(restaurantGuestProfiles.name)),
    ])

    const monthlyVisitsByPhone: Record<string, number> = {}
    for (const event of completedThisMonth) {
      if (event.guestPhone) monthlyVisitsByPhone[event.guestPhone] = (monthlyVisitsByPhone[event.guestPhone] ?? 0) + 1
    }

    const revenue = completedToday.reduce((total, event) => total + Number(event.billAmount ?? 0), 0)
    const servedCovers = completedToday.reduce((total, event) => total + Number(event.partySize ?? 0), 0)
    const countableReservations = reservations.filter((reservation) => reservation.status !== 'cancelled')
    const covers = countableReservations.reduce((total, reservation) => total + reservation.partySize, 0)
    const stateById = new Map(unitStates.map((state) => [state.unitId, state]))
    const activeUnits = floorItems.filter((item) => !item.archived)
    const occupiedUnits = activeUnits.filter((item) => {
      const status = stateById.get(item.id)?.status
      return status === 'seated' || status === 'prep'
    }).length
    const blockedUnits = activeUnits.filter((item) => stateById.get(item.id)?.status === 'blocked').length

    return NextResponse.json({
      serviceDate,
      reservations: reservations.map(serializeReservation),
      unitStates: unitStates.map(serializeUnitState),
      customers: customers.map((customer) => ({
        name: customer.name,
        phone: customer.phone,
        visits: customer.visits,
        note: customer.note,
        occasionTags: customer.occasionTags,
      })),
      monthlyVisitsByPhone,
      metrics: {
        reservationCount: countableReservations.length,
        covers,
        revenue: Math.round(revenue * 100) / 100,
        averageSpend: servedCovers ? Math.round((revenue / servedCovers) * 100) / 100 : 0,
        servedCovers,
        occupiedUnits,
        activeUnits: activeUnits.length,
        blockedUnits,
        occupancyPercent: activeUnits.length ? Math.round((occupiedUnits / activeUnits.length) * 100) : 0,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load service data.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  if (!(await hasStaffSession(request))) return NextResponse.json({ error: 'Sign in to create reservations.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.replace(/[^\d+]/g, '').slice(0, 24) : ''
  const partySize = Number(body?.pax)
  const time = typeof body?.time === 'string' ? body.time : ''
  const kind = typeof body?.kind === 'string' ? body.kind : ''
  const tableType = typeof body?.tableType === 'string' ? body.tableType.slice(0, 40) : 'any'
  const unitId = typeof body?.unit === 'string' ? body.unit.trim().slice(0, 120) : ''
  const notes = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : ''
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === 'string').map((tag: string) => tag.trim().slice(0, 64)).filter(Boolean).slice(0, 40) : []
  const serviceDate = isDateKey(body?.serviceDate) ? body.serviceDate : beirutDate()
  const requestId = typeof body?.clientRequestId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(body.clientRequestId) ? body.clientRequestId : crypto.randomUUID()

  if (name.length < 2 || !/^\+?\d{7,20}$/.test(phone) || !Number.isInteger(partySize) || partySize < 1 || partySize > 30 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !unitKinds.includes(kind as (typeof unitKinds)[number]) || !unitId) {
    return NextResponse.json({ error: 'Check the guest, time, party size, and table details.' }, { status: 400 })
  }

  const [existing] = await db.select().from(restaurantReservations)
    .where(and(eq(restaurantReservations.restaurantId, restaurantId), eq(restaurantReservations.clientRequestId, requestId)))
    .limit(1)
  if (existing) return NextResponse.json({ reservation: serializeReservation(existing) })

  try {
    const floorItems = await getFloorItems()
    const unit = floorItems.find((item) => item.id === unitId)
    const isUnassigned = /·\s*assign$/i.test(unitId)
    if (!isUnassigned && !unit) return NextResponse.json({ error: 'The selected floor unit no longer exists.' }, { status: 409 })

    const existingState = isUnassigned ? null : (await db.select().from(restaurantUnitStates)
      .where(and(eq(restaurantUnitStates.restaurantId, restaurantId), eq(restaurantUnitStates.unitId, unitId)))
      .limit(1))[0]
    if (existingState && existingState.status !== 'available') {
      return NextResponse.json({ error: 'That floor unit is no longer available.' }, { status: 409 })
    }

    const formattedTime = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
      .format(new Date(`2000-01-01T${time}:00Z`))

    const reservation = await db.transaction(async (tx) => {
      const [created] = await tx.insert(restaurantReservations).values({
        restaurantId,
        serviceDate,
        reservationTime: time,
        guestName: name,
        guestPhone: phone,
        partySize,
        unitId,
        unitKind: kind,
        tableType,
        notes,
        occasionTags: tags,
        status: 'booked',
        clientRequestId: requestId,
      }).returning()

      const [profile] = await tx.select().from(restaurantGuestProfiles)
        .where(and(eq(restaurantGuestProfiles.restaurantId, restaurantId), eq(restaurantGuestProfiles.phone, phone)))
        .limit(1)

      const profileValues = {
        restaurantId,
        phone,
        name,
        visits: profile?.visits ?? 0,
        note: notes || profile?.note || '',
        occasionTags: [...new Set([...(profile?.occasionTags ?? []), ...tags])],
        updatedAt: new Date(),
      }

      await tx.insert(restaurantGuestProfiles).values(profileValues).onConflictDoUpdate({
        target: [restaurantGuestProfiles.restaurantId, restaurantGuestProfiles.phone],
        set: {
          name,
          note: profileValues.note,
          occasionTags: profileValues.occasionTags,
          updatedAt: profileValues.updatedAt,
        },
      })

      if (!isUnassigned) {
        await tx.insert(restaurantUnitStates).values({
          restaurantId,
          unitId,
          status: 'prep',
          guestName: name,
          guestPhone: phone,
          partySize,
          serviceTime: formattedTime,
          notes,
          reservationId: created.id,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [restaurantUnitStates.restaurantId, restaurantUnitStates.unitId],
          set: {
            status: 'prep',
            guestName: name,
            guestPhone: phone,
            partySize,
            serviceTime: formattedTime,
            notes,
            reservationId: created.id,
            updatedAt: new Date(),
          },
        })
      }

      await tx.insert(restaurantServiceEvents).values({
        restaurantId,
        reservationId: created.id,
        eventKey: `reservation:${requestId}:created`,
        eventType: 'created',
        guestPhone: phone,
        guestName: name,
        partySize,
        unitId,
      }).onConflictDoNothing()

      return created
    })

    return NextResponse.json({ reservation: serializeReservation(reservation) }, { status: 201 })
  } catch {
    const [retry] = await db.select().from(restaurantReservations)
      .where(and(eq(restaurantReservations.restaurantId, restaurantId), eq(restaurantReservations.clientRequestId, requestId)))
      .limit(1)
    if (retry) return NextResponse.json({ reservation: serializeReservation(retry) })
    return NextResponse.json({ error: 'Unable to save this reservation.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const staffContext = await getStaffContext(request.headers)
  if (!staffContext) return NextResponse.json({ error: 'Sign in to update service data.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = typeof body?.action === 'string' ? body.action : ''
  const eventKey = typeof body?.eventKey === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(body.eventKey) ? body.eventKey : crypto.randomUUID()

  try {
    if (action === 'arrive' || action === 'unarrive' || action === 'seat') {
      const reservationId = Number(body?.reservationId)
      if (!Number.isSafeInteger(reservationId) || reservationId < 1) return NextResponse.json({ error: 'Invalid reservation.' }, { status: 400 })

      const result = await db.transaction(async (tx) => {
        const [reservation] = await tx.select().from(restaurantReservations)
          .where(and(eq(restaurantReservations.id, reservationId), eq(restaurantReservations.restaurantId, restaurantId)))
          .limit(1)
        if (!reservation || ['cancelled', 'completed'].includes(reservation.status)) return null

        const now = new Date()
        const status = action === 'arrive' ? 'arrived' : action === 'seat' ? 'seated' : 'booked'
        const [updated] = await tx.update(restaurantReservations)
          .set({ status, arrivedAt: action === 'unarrive' ? null : action === 'arrive' ? now : reservation.arrivedAt, seatedAt: action === 'seat' ? now : reservation.seatedAt, updatedAt: now })
          .where(and(eq(restaurantReservations.id, reservationId), eq(restaurantReservations.restaurantId, restaurantId)))
          .returning()

        if (action === 'seat') {
          await tx.insert(restaurantUnitStates).values({
            restaurantId,
            unitId: reservation.unitId,
            status: 'seated',
            guestName: reservation.guestName,
            guestPhone: reservation.guestPhone,
            partySize: reservation.partySize,
            serviceTime: reservation.reservationTime.slice(0, 5),
            notes: reservation.notes,
            reservationId,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: [restaurantUnitStates.restaurantId, restaurantUnitStates.unitId],
            set: {
              status: 'seated',
              guestName: reservation.guestName,
              guestPhone: reservation.guestPhone,
              partySize: reservation.partySize,
              serviceTime: reservation.reservationTime.slice(0, 5),
              notes: reservation.notes,
              reservationId,
              updatedAt: now,
            },
          })
        }

        if (action !== 'unarrive') {
          await tx.insert(restaurantServiceEvents).values({
            restaurantId,
            reservationId,
            eventKey,
            eventType: action === 'seat' ? 'seated' : 'arrived',
            guestPhone: reservation.guestPhone,
            guestName: reservation.guestName,
            partySize: reservation.partySize,
            unitId: reservation.unitId,
          }).onConflictDoNothing()
        }

        return updated
      })

      if (!result) return NextResponse.json({ error: 'Reservation was not found or is already closed.' }, { status: 409 })
      return NextResponse.json({ reservation: serializeReservation(result) })
    }

    if (action === 'complete') {
      const unitId = typeof body?.unitId === 'string' ? body.unitId.trim().slice(0, 120) : ''
      const amount = Number(body?.billAmount)
      if (!unitId || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
        return NextResponse.json({ error: 'Enter a valid bill amount.' }, { status: 400 })
      }

      const completed = await db.transaction(async (tx) => {
        const [state] = await tx.select().from(restaurantUnitStates)
          .where(and(eq(restaurantUnitStates.restaurantId, restaurantId), eq(restaurantUnitStates.unitId, unitId)))
          .limit(1)
        if (!state || !['seated', 'prep'].includes(state.status)) return null

        let guestPhone = state.guestPhone
        let guestName = state.guestName
        let partySize = state.partySize
        if (state.reservationId) {
          const [reservation] = await tx.select().from(restaurantReservations)
            .where(and(eq(restaurantReservations.id, state.reservationId), eq(restaurantReservations.restaurantId, restaurantId)))
            .limit(1)
          if (reservation) {
            guestPhone = reservation.guestPhone
            guestName = reservation.guestName
            partySize = reservation.partySize
            await tx.update(restaurantReservations)
              .set({ status: 'completed', billAmount: amount, completedAt: new Date(), updatedAt: new Date() })
              .where(and(eq(restaurantReservations.id, reservation.id), eq(restaurantReservations.restaurantId, restaurantId)))
          }
        }

        await tx.insert(restaurantServiceEvents).values({
          restaurantId,
          reservationId: state.reservationId,
          eventKey,
          eventType: 'completed',
          guestPhone,
          guestName,
          partySize,
          unitId,
          billAmount: amount,
        }).onConflictDoNothing()

        if (guestPhone) {
          await tx.update(restaurantGuestProfiles)
            .set({ visits: sql`${restaurantGuestProfiles.visits} + 1`, updatedAt: new Date() })
            .where(and(eq(restaurantGuestProfiles.restaurantId, restaurantId), eq(restaurantGuestProfiles.phone, guestPhone)))
        }

        await tx.update(restaurantUnitStates)
          .set({
            status: 'available',
            guestName: null,
            guestPhone: null,
            partySize: null,
            serviceTime: null,
            notes: '',
            billAmount: null,
            reservationId: null,
            updatedAt: new Date(),
          })
          .where(and(eq(restaurantUnitStates.restaurantId, restaurantId), eq(restaurantUnitStates.unitId, unitId)))

        return true
      })

      if (!completed) return NextResponse.json({ error: 'That floor unit is not currently being served.' }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'unit-status') {
  if (!isManager(staffContext)) return NextResponse.json({ error: 'Manager access required.' }, { status: 403 })

      const unitId = typeof body?.unitId === 'string' ? body.unitId.trim().slice(0, 120) : ''
      const status = body?.status as UnitStatus
      if (!unitId || !unitStatuses.includes(status)) return NextResponse.json({ error: 'Invalid floor-unit update.' }, { status: 400 })

      const floorItems = await getFloorItems()
      if (!floorItems.some((item) => item.id === unitId)) return NextResponse.json({ error: 'The selected floor unit no longer exists.' }, { status: 409 })

      const [current] = await db.select().from(restaurantUnitStates)
        .where(and(eq(restaurantUnitStates.restaurantId, restaurantId), eq(restaurantUnitStates.unitId, unitId)))
        .limit(1)
      if (current && ['seated', 'prep'].includes(current.status) && status === 'blocked') {
        return NextResponse.json({ error: 'Clear the active service before blocking this unit.' }, { status: 409 })
      }

      await db.insert(restaurantUnitStates).values({ restaurantId, unitId, status, notes: '', updatedAt: new Date() }).onConflictDoUpdate({
        target: [restaurantUnitStates.restaurantId, restaurantUnitStates.unitId],
        set: { status, updatedAt: new Date() },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unsupported service update.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Unable to save this service update.' }, { status: 500 })
  }
}
