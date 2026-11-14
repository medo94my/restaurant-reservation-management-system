import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { db } from '../db.ts'
import { restaurantBranding } from '../schema.ts'

describe('Restaurant Branding Management', () => {
  before(async () => {
    // Reset/ensure default branding record exists with canonical luxury tokens
    await db
      .insert(restaurantBranding)
      .values({
        id: 'default',
        restaurantName: 'Saffron & Cedar',
        tagline: 'Beirut Dining Room',
        logoUrl: '',
        primaryColor: '#d7b46a',
        secondaryColor: '#bfa15f',
        backgroundColor: '#111312',
        surfaceColor: '#171a18',
        textColor: '#f4efe6',
        fontFamily: 'Cinzel',
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: restaurantBranding.id,
        set: {
          restaurantName: 'Saffron & Cedar',
          tagline: 'Beirut Dining Room',
          primaryColor: '#d7b46a',
          secondaryColor: '#bfa15f',
          backgroundColor: '#111312',
          surfaceColor: '#171a18',
          textColor: '#f4efe6',
          fontFamily: 'Cinzel',
          isPublished: true,
        },
      })
  })

  test('default branding record exists with luxury tokens', async () => {
    const [branding] = await db
      .select()
      .from(restaurantBranding)
      .where(eq(restaurantBranding.id, 'default'))
      .limit(1)

    assert.ok(branding, 'Default branding record should exist')
    assert.strictEqual(branding.restaurantName, 'Saffron & Cedar')
    assert.strictEqual(branding.primaryColor, '#d7b46a')
    assert.strictEqual(branding.backgroundColor, '#111312')
    assert.strictEqual(branding.fontFamily, 'Cinzel')
  })

  test('branding updates persist to PostgreSQL', async () => {
    await db
      .update(restaurantBranding)
      .set({
        tagline: 'Authentic Levantine Dining',
        updatedAt: new Date(),
      })
      .where(eq(restaurantBranding.id, 'default'))

    const [updated] = await db
      .select()
      .from(restaurantBranding)
      .where(eq(restaurantBranding.id, 'default'))
      .limit(1)

    assert.strictEqual(updated.tagline, 'Authentic Levantine Dining')

    // Restore
    await db
      .update(restaurantBranding)
      .set({
        tagline: 'Beirut Dining Room',
        updatedAt: new Date(),
      })
      .where(eq(restaurantBranding.id, 'default'))
  })

  test('unpublished draft flag persists without losing published defaults', async () => {
    const updatedRows = await db
      .update(restaurantBranding)
      .set({
        isPublished: false,
        fontFamily: 'Playfair Display',
        updatedAt: new Date(),
      })
      .where(eq(restaurantBranding.id, 'default'))
      .returning({ id: restaurantBranding.id, isPublished: restaurantBranding.isPublished })

    assert.strictEqual(updatedRows.length, 1)
    assert.strictEqual(updatedRows[0].isPublished, false)

    // Restore published state
    const restoredRows = await db
      .update(restaurantBranding)
      .set({
        isPublished: true,
        fontFamily: 'Cinzel',
        updatedAt: new Date(),
      })
      .where(eq(restaurantBranding.id, 'default'))
      .returning({ id: restaurantBranding.id, isPublished: restaurantBranding.isPublished })

    assert.strictEqual(restoredRows.length, 1)
    assert.strictEqual(restoredRows[0].isPublished, true)
  })
})
