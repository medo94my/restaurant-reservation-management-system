import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { ensureDatabaseTables } from '../lib/db-init.ts'
import { auth } from '../lib/auth/auth.ts'
import * as schema from '../lib/schema.ts'

const connectionString =
  process.env.DATABASE_URL || 'postgresql://localhost:5432/restaurant_reservation_dev'

async function seed() {
  const pool = new Pool({ connectionString })
  console.log('Ensuring tables...')
  await ensureDatabaseTables(pool)
  const db = drizzle(pool, { schema })

  // 1. Initial Manager
  const managerStaffId = 'MGR-01'
  const managerPasscode = process.env.INITIAL_MANAGER_PASSCODE || 'manager123'
  const [existingManager] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.staffId, managerStaffId))
    .limit(1)

  if (!existingManager) {
    console.log(`Creating initial manager account: ${managerStaffId}...`)
    await auth.api.signUpEmail({
      body: {
        email: `${managerStaffId.toLowerCase()}@staff.internal`,
        username: managerStaffId,
        password: managerPasscode,
        name: 'Head Manager',
        role: 'manager',
        staffId: managerStaffId,
        isActive: true,
      },
    })
    console.log(`✓ Manager ${managerStaffId} created successfully.`)
  } else {
    console.log(`Updating manager ${managerStaffId} password...`)
    const authContext = await auth.$context
    const hashedPassword = await authContext.password.hash(managerPasscode)
    await db
      .update(schema.account)
      .set({ password: hashedPassword })
      .where(eq(schema.account.userId, existingManager.id))
    console.log(`✓ Manager ${managerStaffId} password updated to default.`)
  }

  // 2. Initial Hostess
  const hostessStaffId = 'HOST-01'
  const hostessPasscode = process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123'
  const [existingHostess] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.staffId, hostessStaffId))
    .limit(1)

  if (!existingHostess) {
    console.log(`Creating initial hostess account: ${hostessStaffId}...`)
    await auth.api.signUpEmail({
      body: {
        email: `${hostessStaffId.toLowerCase()}@staff.internal`,
        username: hostessStaffId,
        password: hostessPasscode,
        name: 'Head Hostess',
        role: 'hostess',
        staffId: hostessStaffId,
        isActive: true,
      },
    })
    console.log(`✓ Hostess ${hostessStaffId} created successfully.`)
  } else {
    console.log(`Hostess ${hostessStaffId} already exists.`)
  }

  // 3. Initial Branding Default
  const [existingBranding] = await db
    .select()
    .from(schema.restaurantBranding)
    .where(eq(schema.restaurantBranding.id, 'default'))
    .limit(1)

  if (!existingBranding) {
    console.log('Seeding default restaurant branding...')
    await db.insert(schema.restaurantBranding).values({
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
    console.log('✓ Default branding initialized.')
  }

  // 4. Initial Customers
  const custCount = await pool.query('SELECT count(*) FROM customers')
  if (Number(custCount.rows[0].count) === 0) {
    console.log('Seeding initial customers into PostgreSQL...')
    const defaultCusts = [
      { id: '11111111-0000-4000-a000-000000000001', phone: '96170123456', name: 'Nadia Khoury', visits: 12, note: 'Always requests a quiet table · no coriander' },
      { id: '11111111-0000-4000-a000-000000000002', phone: '96171111111', name: 'Karim Haddad', visits: 8, note: 'Prefers a central table' },
      { id: '11111111-0000-4000-a000-000000000003', phone: '96176123456', name: 'Maya Saad', visits: 6, note: 'Window table if available' },
      { id: '11111111-0000-4000-a000-000000000004', phone: '96170111999', name: 'Tarek Nassar', visits: 15, note: 'Celebrates anniversary · discreet service' },
      { id: '11111111-0000-4000-a000-000000000005', phone: '96131234567', name: 'Leila Farah', visits: 4, note: 'Vegetarian mezze' },
    ]
    for (const c of defaultCusts) {
      await pool.query(
        'INSERT INTO customers (id, name, phone, permanent_notes, visit_count, loyalty_tier) VALUES ($1, $2, $3, $4, $5, $6)',
        [c.id, c.name, c.phone, c.note, c.visits, c.visits >= 15 ? 'vip' : c.visits >= 10 ? 'loyal' : 'regular']
      )
    }
    console.log('✓ Initial customers seeded.')
  }

  await pool.end()
  console.log('Seeding complete!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed error:', err)
  process.exit(1)
})
