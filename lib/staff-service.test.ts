import { Pool } from 'pg'
import { eq } from 'drizzle-orm'
import { ensureDatabaseTables } from './db-init.ts'
import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { auth, resolveBetterAuthSecret } from './auth/auth.ts'
import { db, user as authUserTable } from './db.ts'
import {
  DEFAULT_STARTER_STAFF,
  DrizzleStaffStorageAdapter,
  InMemoryStaffStorageAdapter,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_SECONDS,
  StaffService,
  defaultStaffService,
  getStaffSession,
  getStaffSessionSecret,
  hasPermission,
  hashPin,
  isAtLeastRole,
  isManagerOrAdmin,
  recordAuditLog,
  signStaffSessionToken,
  staffCookieOptions,
  staffMemberFromRow,
  verifyPinHash,
  verifyStaffPin,
  verifyStaffSessionToken,
  type StaffMember,
  type StaffRole,
  type StaffStorageAdapter,
} from './staff-service.ts'

test('hashPin and verifyPinHash - secure PIN hashing and constant-time verification', () => {
  const pin = '4321'
  const { hash, salt } = hashPin(pin)

  assert.ok(hash, 'Hash should be generated')
  assert.ok(salt, 'Salt should be generated')
  assert.equal(typeof hash, 'string')
  assert.equal(typeof salt, 'string')

  // Different salts should produce different hashes for the same PIN
  const second = hashPin(pin)
  assert.notEqual(second.salt, salt)
  assert.notEqual(second.hash, hash)

  // Verification of correct PIN
  assert.equal(verifyPinHash(pin, hash, salt), true, 'Correct PIN should verify successfully')

  // Verification of incorrect PIN
  assert.equal(verifyPinHash('9999', hash, salt), false, 'Incorrect PIN must fail')
  assert.equal(verifyPinHash('4322', hash, salt), false, 'Slightly different PIN must fail')

  // Malformed or invalid inputs
  assert.equal(verifyPinHash('', hash, salt), false)
  assert.equal(verifyPinHash(pin, 'invalid-hex-hash', salt), false)
  assert.equal(verifyPinHash(pin, hash, ''), false)

  assert.throws(() => hashPin(''), /PIN must be a non-empty string/)
})

test('Default starter staff profiles - seeds Head Hostess and Dining Room Supervisor', async () => {
  const adapter = new InMemoryStaffStorageAdapter(true)
  const staff = await adapter.getStaffList()

  assert.equal(staff.length, 2, 'Should have exactly 2 starter staff members')

  const hostess = staff.find(s => s.role === 'host')
  assert.ok(hostess, 'Hostess profile should exist')
  assert.equal(hostess?.name, 'Head Hostess')
  assert.equal(hostess?.role, 'host')
  assert.equal(hostess?.active, true)
  assert.equal(verifyPinHash('1111', hostess!.pinHash, hostess!.pinSalt), true, 'Head Hostess PIN is 1111')

  const supervisor = staff.find(s => s.role === 'manager')
  assert.ok(supervisor, 'Supervisor profile should exist')
  assert.equal(supervisor?.name, 'Dining Room Supervisor')
  assert.equal(supervisor?.role, 'manager')
  assert.equal(supervisor?.active, true)
  assert.equal(
    verifyPinHash('123456', supervisor!.pinHash, supervisor!.pinSalt),
    true,
    'Dining Room Supervisor PIN is 123456'
  )
})

test('verifyStaffPin - quick PIN unlock for active staff members', async () => {
  // Test with default singleton
  const hostess = await verifyStaffPin('1111')
  assert.ok(hostess)
  assert.equal(hostess?.name, 'Head Hostess')
  assert.equal(hostess?.role, 'host')

  const manager = await verifyStaffPin('123456')
  assert.ok(manager)
  assert.equal(manager?.name, 'Dining Room Supervisor')
  assert.equal(manager?.role, 'manager')

  // Invalid PIN
  const unknown = await verifyStaffPin('0000')
  assert.equal(unknown, null)

  const empty = await verifyStaffPin('')
  assert.equal(empty, null)
})

test('verifyStaffPin - ignores inactive staff members', async () => {
  const customAdapter = new InMemoryStaffStorageAdapter(false)
  const service = new StaffService(customAdapter)

  const { hash, salt } = hashPin('7777')
  await customAdapter.saveStaff({
    id: 'staff-inactive',
    name: 'Former Waiter',
    role: 'server',
    pinHash: hash,
    pinSalt: salt,
    active: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const result = await service.verifyStaffPin('7777')
  assert.equal(result, null, 'Inactive staff must not unlock terminal')
})

test('Session token signing and verification - tamper resistance and expiration', () => {
  const member = {
    staffId: 'staff-head-hostess',
    name: 'Head Hostess',
    role: 'host' as StaffRole,
  }

  const token = signStaffSessionToken(member)
  assert.ok(token)
  assert.ok(token.includes('.'))

  // Successful verification
  const session = verifyStaffSessionToken(token)
  assert.ok(session)
  assert.equal(session?.staffId, 'staff-head-hostess')
  assert.equal(session?.id, 'staff-head-hostess')
  assert.equal(session?.name, 'Head Hostess')
  assert.equal(session?.role, 'host')
  assert.ok(session?.exp && session.exp > Math.floor(Date.now() / 1000))

  // Altering signature fails
  const [payloadPart, sigPart] = token.split('.')
  const tamperedSig = `${payloadPart}.${sigPart.slice(0, -4)}abcd`
  assert.equal(verifyStaffSessionToken(tamperedSig), null, 'Tampered signature must be rejected')

  // Altering payload fails
  const tamperedPayload = Buffer.from(
    JSON.stringify({ staffId: 'staff-head-hostess', name: 'Head Hostess', role: 'admin', exp: session!.exp })
  ).toString('base64url')
  assert.equal(
    verifyStaffSessionToken(`${tamperedPayload}.${sigPart}`),
    null,
    'Tampered payload with original signature must be rejected'
  )

  // Expired token fails
  const expiredToken = signStaffSessionToken(member, getStaffSessionSecret(), -10)
  assert.equal(verifyStaffSessionToken(expiredToken), null, 'Expired token must return null')

  // Malformed tokens
  assert.equal(verifyStaffSessionToken(''), null)
  assert.equal(verifyStaffSessionToken('not-a-token'), null)
  assert.equal(verifyStaffSessionToken('one.two.three'), null)
  assert.equal(verifyStaffSessionToken(null), null)
})

test('getStaffSession - extracts and validates session from various request headers and cookie sources', async () => {
  const member = {
    staffId: 'staff-dining-supervisor',
    name: 'Dining Room Supervisor',
    role: 'manager' as StaffRole,
  }
  const token = signStaffSessionToken(member)

  // 1. Direct token string
  const session1 = await getStaffSession(token)
  assert.equal(session1?.name, 'Dining Room Supervisor')
  assert.equal(session1?.role, 'manager')

  // 2. Cookie string
  const session2 = await getStaffSession(`other=123; ${STAFF_SESSION_COOKIE}=${token}; test=true`)
  assert.equal(session2?.staffId, 'staff-dining-supervisor')

  // 3. Web Request object with Cookie header
  const reqWithCookie = new Request('http://localhost/api/test', {
    headers: {
      cookie: `${STAFF_SESSION_COOKIE}=${token}`,
    },
  })
  const session3 = await getStaffSession(reqWithCookie)
  assert.equal(session3?.staffId, 'staff-dining-supervisor')

  // 4. Web Request with Authorization header (Bearer)
  const reqWithAuth = new Request('http://localhost/api/test', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
  const session4 = await getStaffSession(reqWithAuth)
  assert.equal(session4?.staffId, 'staff-dining-supervisor')

  // 5. Next.js style cookie store object
  const mockCookieStore = {
    get(name: string) {
      if (name === STAFF_SESSION_COOKIE) return { value: token }
      return undefined
    },
  }
  const session5 = await getStaffSession(mockCookieStore)
  assert.equal(session5?.staffId, 'staff-dining-supervisor')

  // 6. Missing or invalid returns null
  assert.equal(await getStaffSession(new Request('http://localhost/api/test')), null)
  assert.equal(await getStaffSession(''), null)
})

test('Role permissions and hierarchy', () => {
  assert.deepEqual(STAFF_ROLES, ['host', 'server', 'manager', 'admin'])

  // Host permissions
  assert.equal(hasPermission('host', 'view_floor'), true)
  assert.equal(hasPermission('host', 'seat_guest'), true)
  assert.equal(hasPermission('host', 'edit_reservation'), true)
  assert.equal(hasPermission('host', 'manage_staff'), false)
  assert.equal(hasPermission('host', 'cancel_reservation'), false)
  assert.equal(hasPermission('host', 'manage_settings'), false)

  // Server permissions
  assert.equal(hasPermission('server', 'view_floor'), true)
  assert.equal(hasPermission('server', 'seat_guest'), true)
  assert.equal(hasPermission('server', 'manage_staff'), false)

  // Manager permissions
  assert.equal(hasPermission('manager', 'manage_staff'), true)
  assert.equal(hasPermission('manager', 'cancel_reservation'), true)
  assert.equal(hasPermission('manager', 'manage_settings'), true)
  assert.equal(hasPermission('manager', 'view_audit_logs'), true)

  // Admin permissions
  assert.equal(hasPermission('admin', 'manage_staff'), true)
  assert.equal(hasPermission('admin', 'manage_settings'), true)

  // isManagerOrAdmin helper
  assert.equal(isManagerOrAdmin('admin'), true)
  assert.equal(isManagerOrAdmin('manager'), true)
  assert.equal(isManagerOrAdmin('host'), false)
  assert.equal(isManagerOrAdmin('server'), false)

  // isAtLeastRole hierarchy
  assert.equal(isAtLeastRole('admin', 'manager'), true)
  assert.equal(isAtLeastRole('manager', 'host'), true)
  assert.equal(isAtLeastRole('host', 'manager'), false)
  assert.equal(isAtLeastRole('server', 'server'), true)
})

test('StaffService - CRUD operations and public profile masking', async () => {
  const customAdapter = new InMemoryStaffStorageAdapter(false)
  const service = new StaffService(customAdapter)

  // Create new staff
  const created = await service.saveStaffMember({
    name: 'Sommelier Jules',
    role: 'server',
    pin: '8888',
  })

  assert.ok(created.id)
  assert.equal(created.name, 'Sommelier Jules')
  assert.equal(created.role, 'server')
  assert.equal(created.active, true)
  assert.ok(created.pinHash)
  assert.ok(created.pinSalt)

  // Verify PIN unlock works
  const unlocked = await service.verifyStaffPin('8888')
  assert.equal(unlocked?.id, created.id)

  // Public staff list masks pinHash and pinSalt
  const publicList = await service.getPublicStaffList()
  assert.equal(publicList.length, 1)
  assert.equal(publicList[0].id, created.id)
  assert.equal(publicList[0].name, 'Sommelier Jules')
  assert.equal(publicList[0].role, 'server')
  assert.equal('pinHash' in publicList[0], false, 'pinHash must be omitted from public profiles')
  assert.equal('pinSalt' in publicList[0], false, 'pinSalt must be omitted from public profiles')

  // Update staff member
  const updated = await service.saveStaffMember({
    id: created.id,
    name: 'Lead Sommelier Jules',
    role: 'manager',
    pin: '9999',
  })

  assert.equal(updated.name, 'Lead Sommelier Jules')
  assert.equal(updated.role, 'manager')

  // Old PIN no longer works, new PIN works
  assert.equal(await service.verifyStaffPin('8888'), null)
  const reUnlocked = await service.verifyStaffPin('9999')
  assert.equal(reUnlocked?.id, created.id)

  // Delete staff member
  await service.deleteStaffMember(created.id)
  assert.equal(await service.getStaffById(created.id), null)
})

test('Audit logging helper - records and queries audit events', async () => {
  const service = new StaffService(new InMemoryStaffStorageAdapter(true))

  const log1 = await service.recordAuditLog(
    'res-101',
    'staff-head-hostess',
    'seated',
    { status: 'booked' },
    { status: 'seated', tableId: 'T1' }
  )

  assert.ok(log1.id)
  assert.equal(log1.reservationId, 'res-101')
  assert.equal(log1.staffId, 'staff-head-hostess')
  assert.equal(log1.staffName, 'Head Hostess')
  assert.equal(log1.action, 'seated')
  assert.deepEqual(log1.prevState, { status: 'booked' })
  assert.deepEqual(log1.newState, { status: 'seated', tableId: 'T1' })

  const log2 = await service.recordAuditLog(
    'res-102',
    'staff-dining-supervisor',
    'turn_time_override',
    { turnMinutes: 90 },
    { turnMinutes: 120 }
  )

  const logsForRes101 = await service.getAuditLogs('res-101')
  assert.equal(logsForRes101.length, 1)
  assert.equal(logsForRes101[0].id, log1.id)

  const allLogs = await service.getAuditLogs()
  assert.equal(allLogs.length, 2)

  // Top-level recordAuditLog helper function
  const topLog = await recordAuditLog('res-200', 'staff-head-hostess', 'notes_updated')
  assert.equal(topLog.reservationId, 'res-200')
  assert.equal(topLog.action, 'notes_updated')
})

test('Cookie options helper', () => {
  const options = staffCookieOptions(3600)
  assert.equal(options.httpOnly, true)
  assert.equal(options.sameSite, 'strict')
  assert.equal(options.path, '/')
  assert.equal(options.maxAge, 3600)
})

test('getStaffSessionSecret - no hardcoded fallback; shares Better Auth secret and throws in production when unset', () => {
  assert.equal(getStaffSessionSecret({ STAFF_SESSION_SECRET: 'configured-secret' }), 'configured-secret')
  assert.equal(getStaffSessionSecret({ MANAGER_SESSION_SECRET: 'legacy-secret' }), 'legacy-secret')
  assert.equal(getStaffSessionSecret({ BETTER_AUTH_SECRET: 'shared-ba-secret' }), 'shared-ba-secret')
  assert.equal(getStaffSessionSecret({ AUTH_SECRET: 'shared-auth-secret' }), 'shared-auth-secret')

  assert.throws(
    () => getStaffSessionSecret({ NODE_ENV: 'production' }),
    /STAFF_SESSION_SECRET .* must be set in production/
  )
  assert.throws(
    () => getStaffSessionSecret({ NODE_ENV: 'production', STAFF_SESSION_SECRET: '   ' }),
    /must be set in production/
  )

  const devSecret = getStaffSessionSecret({ NODE_ENV: 'development' })
  assert.notEqual(devSecret, 'saffron-cedar-dining-room-staff-secret-2026')
  assert.match(devSecret, /^[0-9a-f]{64}$/, 'dev fallback is a random 32-byte hex secret')
  assert.equal(getStaffSessionSecret({}), devSecret, 'dev fallback is stable per process')
  assert.equal(devSecret, resolveBetterAuthSecret({ NODE_ENV: 'development' }), 'shares Better Auth dev secret')
})

test('getStaffSession - rejects PIN session tokens for deactivated staff members', async () => {
  const customAdapter = new InMemoryStaffStorageAdapter(false)
  const service = new StaffService(customAdapter)
  const { hash, salt } = hashPin('5555')
  await customAdapter.saveStaff({
    id: 'staff-revoked-pin',
    name: 'Revoked Staff',
    role: 'host',
    pinHash: hash,
    pinSalt: salt,
    active: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const token = signStaffSessionToken({
    staffId: 'staff-revoked-pin',
    name: 'Revoked Staff',
    role: 'host',
  })

  const resolved = await getStaffSession(token, service)
  assert.equal(resolved, null, 'Deactivated staff member token must be rejected')
})

test('staffMemberFromRow - uses the persisted pin_salt and respects linked Better Auth user active state', () => {
  const { hash, salt } = hashPin('2468')
  const now = new Date()
  const member = staffMemberFromRow({
    id: '0b6b3f7e-6a43-4c3e-9f0e-3c1f4c2d9a10',
    authUserId: 'ba-user-1',
    name: 'Night Host',
    role: 'host',
    hashedPin: hash,
    pinSalt: salt,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  assert.equal(member.authUserId, 'ba-user-1')
  assert.equal(member.pinSalt, salt)
  assert.equal(member.active, true)
  assert.equal(member.createdAt, now.toISOString())
  assert.equal(verifyPinHash('2468', member.pinHash, member.pinSalt), true)
  assert.equal(verifyPinHash('0000', member.pinHash, member.pinSalt), false)

  // Deactivated linked Better Auth user forces staff member active=false
  const deactivatedInAuth = staffMemberFromRow(
    {
      id: '0b6b3f7e-6a43-4c3e-9f0e-3c1f4c2d9a10',
      authUserId: 'ba-user-1',
      name: 'Night Host',
      role: 'host',
      hashedPin: hash,
      pinSalt: salt,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    false
  )
  assert.equal(deactivatedInAuth.active, false)

  // Legacy rows without a stored salt fail closed instead of fabricating one.
  const legacy = staffMemberFromRow({
    id: '0b6b3f7e-6a43-4c3e-9f0e-3c1f4c2d9a11',
    name: 'Legacy Host',
    role: 'host',
    hashedPin: hash,
    pinSalt: '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
  assert.equal(legacy.authUserId, null)
  assert.equal(verifyPinHash('2468', legacy.pinHash, legacy.pinSalt), false)
})

test(
  'DrizzleStaffStorageAdapter & getStaffSession - persists authUserId FK, syncs Better Auth state, and bridges Better Auth cookies',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    try {
      const colCheck = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_members' AND column_name = 'auth_user_id'`
      )
      if (colCheck.rowCount === 0) {
        await ensureDatabaseTables(pool)
      }
    } finally {
      await pool.end()
    }

    const writer = new DrizzleStaffStorageAdapter(new InMemoryStaffStorageAdapter(false))
    const { hash, salt } = hashPin('7391')
    const id = 'a1b2c3d4-0000-4000-8000-000000007391'
    const uniqueSuffix = Date.now().toString(36).toUpperCase()
    const staffCode = `SYNC-${uniqueSuffix}`
    const passcode = '7391pass'
    const now = new Date().toISOString()
    let authUserId = `ba-sync-${Date.now()}`

    try {
      const signUpRes = await auth.api.signUpEmail({
        body: {
          email: `${staffCode.toLowerCase()}@staff.internal`,
          username: staffCode,
          password: passcode,
          name: 'Cold Restart Tester',
          role: 'manager',
          staffId: staffCode,
          isActive: true,
        },
      })
      authUserId = signUpRes.user.id

      await writer.saveStaff({
        id,
        authUserId,
        name: 'Cold Restart Tester',
        role: 'manager',
        pinHash: hash,
        pinSalt: salt,
        active: true,
        createdAt: now,
        updatedAt: now,
      })

      // Simulate a fresh process after restart: empty fallback cache, so pinSalt & authUserId MUST come from DB.
      const coldReader = new DrizzleStaffStorageAdapter(new InMemoryStaffStorageAdapter(false))
      const loaded = await coldReader.getStaffById(id)
      assert.ok(loaded, 'Staff member should be loaded from PostgreSQL')
      assert.equal(loaded.authUserId, authUserId, 'authUserId FK should round-trip from staff_members')
      assert.equal(loaded.pinSalt, salt, 'pinSalt must match the saved random salt, not a fabricated hash')
      assert.equal(loaded.active, true)
      assert.equal(verifyPinHash('7391', loaded.pinHash, loaded.pinSalt), true)

      const list = await coldReader.getStaffList()
      const fromList = list.find((m) => m.id === id)
      assert.ok(fromList)
      assert.equal(fromList.authUserId, authUserId)
      assert.equal(fromList.pinSalt, salt)
      assert.equal(verifyPinHash('7391', fromList.pinHash, fromList.pinSalt), true)

      // Verify getStaffSession bridges a live Better Auth session cookie for this linked account
      const signInRes = await auth.api.signInUsername({
        body: {
          username: staffCode,
          password: passcode,
        },
        asResponse: true,
      })
      const setCookie = signInRes.headers.get('set-cookie') || ''
      const baCookieMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
      assert.ok(baCookieMatch)
      const bridged = await getStaffSession(
        new Headers({ cookie: `better-auth.session_token=${baCookieMatch[1]}` })
      )
      assert.ok(bridged, 'getStaffSession in staff-service should bridge Better Auth session cookies')
      assert.equal(bridged.staffId, staffCode)
      assert.equal(bridged.role, 'manager')

      // Deactivating the linked Better Auth user reflects as active=false on staff_members reads
      await db
        .update(authUserTable)
        .set({ isActive: false })
        .where(eq(authUserTable.id, authUserId))
      const afterAuthDeactivate = await coldReader.getStaffById(id)
      assert.equal(afterAuthDeactivate?.active, false, 'Linked deactivated Better Auth user must mark staff inactive')

      // Deleting the Better Auth user sets staff_members.auth_user_id to NULL (ON DELETE SET NULL)
      await db.delete(authUserTable).where(eq(authUserTable.id, authUserId))
      const afterAuthDelete = await coldReader.getStaffById(id)
      assert.ok(afterAuthDelete)
      assert.equal(afterAuthDelete.authUserId, null, 'ON DELETE SET NULL must null out auth_user_id')
    } finally {
      await writer.deleteStaff(id)
      await db.delete(authUserTable).where(eq(authUserTable.id, authUserId))
    }
  }
)

after(async () => {
  await (globalThis as { restaurantPool?: Pool }).restaurantPool?.end()
})
