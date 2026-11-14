import { describe, expect, it } from 'vitest'

const hasDatabase = Boolean(process.env.DATABASE_URL)
const d = hasDatabase ? describe : describe.skip

d('ensureSchema (integration — runs against DATABASE_URL)', () => {
  it('is idempotent: two consecutive bootstrap runs resolve without throwing', async () => {
    const { ensureSchema } = await import('../lib/schema')
    await ensureSchema()
    await ensureSchema()
  })

  it('leaves every application and Better Auth table present', async () => {
    const { ensureSchema } = await import('../lib/schema')
    const { pool } = await import('../lib/db')
    await ensureSchema()
    const { rows } = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    )
    const names = new Set(rows.map((row) => row.table_name))
    for (const table of [
      // application tables (mirrors lib/db.ts)
      'restaurant_workspace_config',
      'restaurant_reservations',
      'restaurant_unit_states',
      'restaurant_service_events',
      'restaurant_guest_profiles',
      'restaurant_staff_profiles',
      'staff_login_attempts',
      // Better Auth-owned tables
      'user',
      'session',
      'account',
      'verification',
    ]) {
      expect(names.has(table), `missing table ${table}`).toBe(true)
    }
  })
})
