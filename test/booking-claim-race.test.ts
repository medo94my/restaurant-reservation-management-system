import { afterAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { db, restaurantUnitStates } from '../lib/db'

const hasDatabase = Boolean(process.env.DATABASE_URL)
const d = hasDatabase ? describe : describe.skip

const RESTAURANT_ID = 'test-claim-race-probe'
const UNIT_ID = 'Table 99'

// Mirrors the exact claim statement from app/api/service-data/route.ts: a
// conditional upsert that only wins while the unit is still 'available'. The
// route maps a 0-row result to 409 "That floor unit is no longer available."
async function claimViaDrizzle(reservationId: number) {
  return db.transaction(async (tx) => {
    const claim = {
      status: 'prep',
      guestName: 'Race Probe',
      guestPhone: '000',
      partySize: 2,
      serviceTime: '19:00',
      notes: '',
      reservationId,
      updatedAt: new Date(),
    }
    const [claimed] = await tx.insert(restaurantUnitStates)
      .values({ restaurantId: RESTAURANT_ID, unitId: UNIT_ID, ...claim })
      .onConflictDoUpdate({
        target: [restaurantUnitStates.restaurantId, restaurantUnitStates.unitId],
        set: claim,
        setWhere: eq(restaurantUnitStates.status, 'available'),
      })
      .returning()
    return claimed
  })
}

async function seedUnit(status: string) {
  await db.delete(restaurantUnitStates).where(and(
    eq(restaurantUnitStates.restaurantId, RESTAURANT_ID),
    eq(restaurantUnitStates.unitId, UNIT_ID),
  ))
  await db.insert(restaurantUnitStates).values({ restaurantId: RESTAURANT_ID, unitId: UNIT_ID, status, notes: '' })
}

d('booking unit claim (integration — mirrors app/api/service-data)', () => {
  afterAll(async () => {
    await db.delete(restaurantUnitStates).where(eq(restaurantUnitStates.restaurantId, RESTAURANT_ID))
  })

  it('lets exactly one concurrent booking claim the same available unit', async () => {
    await seedUnit('available')

    const [first, second] = await Promise.all([claimViaDrizzle(101), claimViaDrizzle(102)])
    const winners = [first, second].filter(Boolean)
    expect(winners, 'exactly one transaction may move the unit to prep').toHaveLength(1)
    const winner = winners[0]
    expect(winner.status).toBe('prep')
    expect([101, 102], 'the winner is whichever transaction took the row lock first').toContain(winner.reservationId)

    const [row] = await db.select().from(restaurantUnitStates).where(and(
      eq(restaurantUnitStates.restaurantId, RESTAURANT_ID),
      eq(restaurantUnitStates.unitId, UNIT_ID),
    ))
    expect(row.status).toBe('prep')
    expect(row.reservationId).toBe(winner.reservationId)
  })

  it('refuses to claim a unit that is not available (0 rows — the route turns this into 409)', async () => {
    await seedUnit('seated')
    const claimed = await claimViaDrizzle(201)
    expect(claimed).toBeUndefined()
  })
})
