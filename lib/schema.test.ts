import assert from 'node:assert/strict'
import test from 'node:test'
import { getTableColumns } from 'drizzle-orm'
import { DATABASE_INIT_SQL } from './db-init.ts'
import {
  customers as dbCustomers,
  db,
  floorLayouts as dbFloorLayouts,
  FLOOR_UNIT_KINDS as dbFloorUnitKinds,
  getReservationUnitId as dbGetReservationUnitId,
  isFloorUnitKind as dbIsFloorUnitKind,
  reservationAuditLogs as dbReservationAuditLogs,
  reservations as dbReservations,
  reservationStatusEnum as dbReservationStatusEnum,
  restaurantWorkspaceConfig,
  staffMembers as dbStaffMembers,
  staffRoleEnum as dbStaffRoleEnum,
  withUnitAlias as dbWithUnitAlias,
} from './db.ts'
import {
  customers,
  floorLayouts,
  FLOOR_UNIT_KINDS,
  getReservationUnitId,
  isFloorUnitKind,
  reservationAuditLogs,
  reservations,
  reservationStatusEnum,
  staffMembers,
  staffRoleEnum,
  user,
  withUnitAlias,
} from './schema.ts'

test('schema - enums have correct members and names', () => {
  assert.equal(reservationStatusEnum.enumName, 'reservation_status')
  assert.deepEqual(reservationStatusEnum.enumValues, [
    'booked',
    'confirmed',
    'seated',
    'completed',
    'cancelled',
    'no_show',
  ])

  assert.equal(staffRoleEnum.enumName, 'staff_role')
  assert.deepEqual(staffRoleEnum.enumValues, [
    'host',
    'server',
    'manager',
    'admin',
  ])
})

test('schema - customers table has required columns, constraints, and defaults', () => {
  const cols = getTableColumns(customers)
  const expectedKeys = [
    'id',
    'name',
    'phone',
    'email',
    'visitCount',
    'totalSpend',
    'loyaltyTier',
    'dietaryFlags',
    'seatingPreferences',
    'occasionTags',
    'permanentNotes',
    'lastVisitAt',
    'createdAt',
    'updatedAt',
  ]

  assert.deepEqual(Object.keys(cols).sort(), [...expectedKeys].sort())

  // Constraints & Column properties
  assert.equal(cols.id.primary, true)
  assert.equal(cols.id.hasDefault, true)
  assert.equal(cols.name.notNull, true)
  assert.equal(cols.phone.notNull, true)
  assert.equal(cols.phone.isUnique, true)
  assert.equal(cols.email.notNull, false)
  assert.equal(cols.lastVisitAt.notNull, false)

  // Defaults
  assert.equal(cols.visitCount.default, 0)
  assert.equal(cols.totalSpend.default, '0.00')
  assert.equal(cols.loyaltyTier.default, 'new')
  assert.deepEqual(cols.dietaryFlags.default, [])
  assert.deepEqual(cols.seatingPreferences.default, [])
  assert.deepEqual(cols.occasionTags.default, [])
  assert.equal(cols.permanentNotes.default, '')
  assert.equal(cols.createdAt.hasDefault, true)
  assert.equal(cols.updatedAt.hasDefault, true)
})

test('schema - reservations table has required columns, foreign keys, and defaults', () => {
  const cols = getTableColumns(reservations)
  const expectedKeys = [
    'id',
    'customerId',
    'tableId',
    'partySize',
    'reservationTime',
    'expectedDurationMin',
    'status',
    'shiftNote',
    'createdByStaffId',
    'createdAt',
    'updatedAt',
  ]

  assert.deepEqual(Object.keys(cols).sort(), [...expectedKeys].sort())

  // Constraints & Column properties
  assert.equal(cols.id.primary, true)
  assert.equal(cols.id.hasDefault, true)
  assert.equal(cols.customerId.notNull, true)
  assert.equal(cols.tableId.notNull, false)
  assert.equal(cols.partySize.notNull, true)
  assert.equal(cols.reservationTime.notNull, true)
  assert.equal(cols.createdByStaffId.notNull, false)

  // Defaults
  assert.equal(cols.expectedDurationMin.default, 90)
  assert.equal(cols.status.default, 'booked')
  assert.equal(cols.shiftNote.default, '')
  assert.equal(cols.createdAt.hasDefault, true)
  assert.equal(cols.updatedAt.hasDefault, true)

  // Foreign key constraint: customerId references customers.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fks = (reservations as any)[Symbol.for('drizzle:PgInlineForeignKeys')]
  assert.ok(Array.isArray(fks) && fks.length >= 1)
  const fkCustomer = fks[0].reference()
  assert.equal(fkCustomer.foreignTable, customers)
  assert.equal(fkCustomer.columns[0].name, 'customer_id')
  assert.equal(fkCustomer.foreignColumns[0].name, 'id')
})

test('schema - staffMembers table has required columns, constraints, and defaults', () => {
  const cols = getTableColumns(staffMembers)
  const expectedKeys = [
    'id',
    'authUserId',
    'name',
    'role',
    'hashedPin',
    'pinSalt',
    'isActive',
    'createdAt',
    'updatedAt',
  ]

  assert.deepEqual(Object.keys(cols).sort(), [...expectedKeys].sort())

  // Constraints & Column properties
  assert.equal(cols.id.primary, true)
  assert.equal(cols.id.hasDefault, true)
  assert.equal(cols.authUserId.notNull, false)
  assert.equal(cols.authUserId.name, 'auth_user_id')
  assert.equal(cols.name.notNull, true)
  assert.equal(cols.hashedPin.notNull, true)
  assert.equal(cols.pinSalt.notNull, true)
  assert.equal(cols.pinSalt.name, 'pin_salt')

  // Defaults
  assert.equal(cols.role.default, 'host')
  assert.equal(cols.isActive.default, true)
  assert.equal(cols.createdAt.hasDefault, true)
  assert.equal(cols.updatedAt.hasDefault, true)

  // Foreign key constraint: authUserId references user.id with ON DELETE SET NULL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fks = (staffMembers as any)[Symbol.for('drizzle:PgInlineForeignKeys')]
  assert.ok(Array.isArray(fks) && fks.length >= 1)
  const fkAuthUser = fks[0].reference()
  assert.equal(fkAuthUser.foreignTable, user)
  assert.equal(fkAuthUser.columns[0].name, 'auth_user_id')
  assert.equal(fkAuthUser.foreignColumns[0].name, 'id')
  assert.equal(fks[0].onDelete, 'set null')
})

test('schema - floorLayouts table has required columns and constraints', () => {
  const cols = getTableColumns(floorLayouts)
  const expectedKeys = [
    'id',
    'name',
    'layoutItems',
    'updatedByStaffId',
    'updatedAt',
  ]

  assert.deepEqual(Object.keys(cols).sort(), [...expectedKeys].sort())

  // Constraints & Column properties
  assert.equal(cols.id.primary, true)
  assert.equal(cols.id.dataType, 'string')
  assert.equal(cols.name.notNull, true)
  assert.equal(cols.layoutItems.notNull, true)
  assert.equal(cols.updatedByStaffId.notNull, false)
  assert.equal(cols.updatedAt.hasDefault, true)
})

test('schema - reservationAuditLogs table has required columns and constraints', () => {
  const cols = getTableColumns(reservationAuditLogs)
  const expectedKeys = [
    'id',
    'reservationId',
    'staffId',
    'action',
    'previousState',
    'newState',
    'createdAt',
  ]

  assert.deepEqual(Object.keys(cols).sort(), [...expectedKeys].sort())

  // Constraints & Column properties
  assert.equal(cols.id.primary, true)
  assert.equal(cols.id.hasDefault, true)
  assert.equal(cols.reservationId.notNull, true)
  assert.equal(cols.staffId.notNull, false)
  assert.equal(cols.action.notNull, true)
  assert.equal(cols.previousState.notNull, false)
  assert.equal(cols.newState.notNull, false)
  assert.equal(cols.createdAt.hasDefault, true)

  // Foreign key constraint: reservationId references reservations.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fks = (reservationAuditLogs as any)[Symbol.for('drizzle:PgInlineForeignKeys')]
  assert.ok(Array.isArray(fks) && fks.length >= 1)
  const fkRes = fks[0].reference()
  assert.equal(fkRes.foreignTable, reservations)
  assert.equal(fkRes.columns[0].name, 'reservation_id')
  assert.equal(fkRes.foreignColumns[0].name, 'id')
})

test('schema - unit canonical modeling supports Table, Couch, and Room units per GLOSSARY.md', () => {
  // FLOOR_UNIT_KINDS matches domain glossary
  assert.deepEqual(FLOOR_UNIT_KINDS, ['Table', 'Couch', 'Room'])

  // isFloorUnitKind validator checks
  assert.equal(isFloorUnitKind('Table'), true)
  assert.equal(isFloorUnitKind('Couch'), true)
  assert.equal(isFloorUnitKind('Room'), true)
  assert.equal(isFloorUnitKind('Chair'), false)
  assert.equal(isFloorUnitKind(''), false)

  // getReservationUnitId helper retrieves unit ID regardless of Unit kind
  assert.equal(getReservationUnitId({ tableId: 'Table 4' }), 'Table 4')
  assert.equal(getReservationUnitId({ tableId: 'Couch 2' }), 'Couch 2')
  assert.equal(getReservationUnitId({ tableId: 'Room East' }), 'Room East')
  assert.equal(getReservationUnitId({ tableId: null }), null)
  assert.equal(getReservationUnitId({ tableId: undefined }), null)
  assert.equal(getReservationUnitId({}), null)

  // withUnitAlias decorates reservation object with canonical unitId
  const rawReservation = {
    id: 'res-1',
    customerId: 'cust-1',
    tableId: 'Couch 3',
    partySize: 2,
    reservationTime: new Date(),
    expectedDurationMin: 90,
    status: 'booked' as const,
    shiftNote: '',
    createdByStaffId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const aliased = withUnitAlias(rawReservation)
  assert.equal(aliased.unitId, 'Couch 3')
  assert.equal(aliased.tableId, 'Couch 3')
  assert.equal(aliased.id, 'res-1')
})

test('schema - lib/db.ts re-exports all models and preserves restaurantWorkspaceConfig', () => {
  // Re-exported tables, enums, and unit helpers match lib/schema
  assert.equal(dbCustomers, customers)
  assert.equal(dbReservations, reservations)
  assert.equal(dbStaffMembers, staffMembers)
  assert.equal(dbFloorLayouts, floorLayouts)
  assert.equal(dbReservationAuditLogs, reservationAuditLogs)
  assert.equal(dbReservationStatusEnum, reservationStatusEnum)
  assert.equal(dbStaffRoleEnum, staffRoleEnum)
  assert.equal(dbGetReservationUnitId, getReservationUnitId)
  assert.equal(dbWithUnitAlias, withUnitAlias)
  assert.equal(dbIsFloorUnitKind, isFloorUnitKind)
  assert.deepEqual(dbFloorUnitKinds, FLOOR_UNIT_KINDS)

  // restaurantWorkspaceConfig preserved
  assert.ok(restaurantWorkspaceConfig)
  const wsCols = getTableColumns(restaurantWorkspaceConfig)
  assert.ok(wsCols.userId)
  assert.ok(wsCols.config)

  // db instance is defined
  assert.ok(db)
  assert.equal(typeof db.select, 'function')
})

test('schema - Better Auth user.role defaults to canonical staff_role value "host"', () => {
  const cols = getTableColumns(user)
  assert.equal(cols.role.default, 'host')
  assert.ok((staffRoleEnum.enumValues as readonly string[]).includes(cols.role.default as string))
})

test('db-init - DDL creates staff_members (with pin_salt and auth_user_id FK) and aligns user.role default', () => {
  const sql = DATABASE_INIT_SQL.replace(/\s+/g, ' ')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS staff_members \(/)
  assert.match(sql, /auth_user_id TEXT REFERENCES "user"\(id\) ON DELETE SET NULL/)
  assert.match(sql, /role staff_role NOT NULL DEFAULT 'host'/)
  assert.match(sql, /hashed_pin VARCHAR\(128\) NOT NULL/)
  assert.match(sql, /pin_salt VARCHAR\(64\) NOT NULL DEFAULT ''/)
  assert.match(sql, /ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS pin_salt/)
  assert.match(sql, /ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS auth_user_id TEXT REFERENCES "user"\(id\) ON DELETE SET NULL/)
  // staff_members must be created after both the staff_role enum and the "user" table it references
  assert.ok(sql.indexOf('CREATE TYPE staff_role') < sql.indexOf('CREATE TABLE IF NOT EXISTS staff_members'))
  assert.ok(sql.indexOf('CREATE TABLE IF NOT EXISTS "user"') < sql.indexOf('CREATE TABLE IF NOT EXISTS staff_members'))

  assert.match(sql, /role TEXT NOT NULL DEFAULT 'host'/)
  assert.match(sql, /ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'host'/)
  assert.doesNotMatch(sql, /DEFAULT 'hostess'/)
})
