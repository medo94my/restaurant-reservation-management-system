import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  getStaffSession as getBetterAuthStaffSession,
  resolveBetterAuthSecret,
} from './auth/auth.ts'
import { db, reservationAuditLogs, session as authSessionTable, staffMembers, user as authUserTable } from './db.ts'
import { toDbUuid } from './customer-service.ts'

export type StaffRole = 'host' | 'server' | 'manager' | 'admin'

export interface StaffMember {
  id: string
  /** Optional FK link to Better Auth `user.id` (`staff_members.auth_user_id`). */
  authUserId?: string | null
  name: string
  role: StaffRole
  pinHash: string
  pinSalt: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type StaffProfile = {
  id: string
  authUserId?: string | null
  name: string
  role: StaffRole
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface StaffSession {
  staffId: string
  id: string
  name: string
  role: StaffRole
  exp: number
  iat: number
}

export interface AuditLogEntry {
  id: string
  reservationId: string
  staffId: string
  staffName?: string
  action: string
  prevState?: unknown
  newState?: unknown
  timestamp: string
}

export interface SaveStaffInput {
  id?: string
  authUserId?: string | null
  name?: string
  role?: StaffRole
  pin?: string
  active?: boolean
}

export interface StaffStorageAdapter {
  getStaffList(): Promise<StaffMember[]>
  getStaffById(id: string): Promise<StaffMember | null>
  saveStaff(staff: StaffMember): Promise<void>
  deleteStaff?(id: string): Promise<void>
  recordAuditLog?(entry: AuditLogEntry): Promise<void>
  getAuditLogs?(reservationId?: string): Promise<AuditLogEntry[]>
}

const SCRYPT_KEY_LENGTH = 64

export function hashPin(pin: string, salt = randomBytes(16).toString('hex')): { hash: string; salt: string } {
  if (typeof pin !== 'string' || !pin) {
    throw new Error('PIN must be a non-empty string')
  }
  const derivedKey = scryptSync(pin, salt, SCRYPT_KEY_LENGTH)
  return {
    hash: derivedKey.toString('hex'),
    salt,
  }
}

export function verifyPinHash(pin: string, hash: string, salt: string): boolean {
  if (typeof pin !== 'string' || typeof hash !== 'string' || typeof salt !== 'string') {
    return false
  }
  try {
    const derivedKey = scryptSync(pin, salt, SCRYPT_KEY_LENGTH)
    const storedHashBuffer = Buffer.from(hash, 'hex')
    if (derivedKey.length !== storedHashBuffer.length) {
      return false
    }
    return timingSafeEqual(derivedKey, storedHashBuffer)
  } catch {
    return false
  }
}

export const DEFAULT_STARTER_STAFF: Array<{
  id: string
  name: string
  pin: string
  role: StaffRole
  active: boolean
}> = [
  {
    id: 'staff-head-hostess',
    name: 'Head Hostess',
    pin: '1111',
    role: 'host',
    active: true,
  },
  {
    id: 'staff-dining-supervisor',
    name: 'Dining Room Supervisor',
    pin: '123456',
    role: 'manager',
    active: true,
  },
]

export class InMemoryStaffStorageAdapter implements StaffStorageAdapter {
  private staff = new Map<string, StaffMember>()
  private auditLogs: AuditLogEntry[] = []

  constructor(seedDefaultStaff = true) {
    if (seedDefaultStaff) {
      this.seedDefaults()
    }
  }

  private seedDefaults() {
    const now = new Date().toISOString()
    for (const item of DEFAULT_STARTER_STAFF) {
      const { hash, salt } = hashPin(item.pin)
      this.staff.set(item.id, {
        id: item.id,
        name: item.name,
        role: item.role,
        pinHash: hash,
        pinSalt: salt,
        active: item.active,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  getStaffMemberSync(id: string): StaffMember | undefined {
    return this.staff.get(id)
  }

  async getStaffList(): Promise<StaffMember[]> {
    return Array.from(this.staff.values())
  }

  async getStaffById(id: string): Promise<StaffMember | null> {
    const member = this.staff.get(id)
    return member ? { ...member } : null
  }

  async saveStaff(member: StaffMember): Promise<void> {
    this.staff.set(member.id, { ...member })
  }

  async deleteStaff(id: string): Promise<void> {
    this.staff.delete(id)
  }

  async recordAuditLog(entry: AuditLogEntry): Promise<void> {
    this.auditLogs.unshift({ ...entry })
  }

  async getAuditLogs(reservationId?: string): Promise<AuditLogEntry[]> {
    if (!reservationId) return [...this.auditLogs]
    return this.auditLogs.filter(log => log.reservationId === reservationId)
  }
}

type StaffMemberRow = typeof staffMembers.$inferSelect

/**
 * Maps a persisted `staff_members` row to a StaffMember, using the stored per-member
 * `pin_salt` so `verifyPinHash` keeps working after restarts / cache misses.
 * When linked to a Better Auth `user` via `auth_user_id`, `linkedAuthUserActive === false`
 * forces `active` to `false` so deactivating a Better Auth account also blocks PIN unlock.
 */
export function staffMemberFromRow(
  row: Omit<StaffMemberRow, 'authUserId'> & { authUserId?: string | null },
  linkedAuthUserActive?: boolean | null
): StaffMember {
  const effectiveActive =
    linkedAuthUserActive === false ? false : Boolean(row.isActive)
  return {
    id: row.id,
    authUserId: row.authUserId ?? null,
    name: row.name,
    role: row.role as StaffRole,
    pinHash: row.hashedPin,
    pinSalt: row.pinSalt,
    active: effectiveActive,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  }
}

export class DrizzleStaffStorageAdapter implements StaffStorageAdapter {
  private fallback: InMemoryStaffStorageAdapter

  constructor(fallback: InMemoryStaffStorageAdapter = new InMemoryStaffStorageAdapter()) {
    this.fallback = fallback
  }

  private isDbAvailable(): boolean {
    return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0)
  }

  async getStaffList(): Promise<StaffMember[]> {
    if (!this.isDbAvailable()) {
      return this.fallback.getStaffList()
    }

    try {
      const joinedRows = await db
        .select({
          staff: staffMembers,
          authUserIsActive: authUserTable.isActive,
        })
        .from(staffMembers)
        .leftJoin(authUserTable, eq(staffMembers.authUserId, authUserTable.id))

      if (joinedRows.length === 0) {
        return this.fallback.getStaffList()
      }

      return joinedRows.map(({ staff, authUserIsActive }) =>
        staffMemberFromRow(staff, authUserIsActive)
      )
    } catch {
      return this.fallback.getStaffList()
    }
  }

  async getStaffById(id: string): Promise<StaffMember | null> {
    if (!this.isDbAvailable()) {
      return this.fallback.getStaffById(id)
    }

    try {
      const dbId = toDbUuid(id)
      const [joined] = await db
        .select({
          staff: staffMembers,
          authUserIsActive: authUserTable.isActive,
        })
        .from(staffMembers)
        .leftJoin(authUserTable, eq(staffMembers.authUserId, authUserTable.id))
        .where(eq(staffMembers.id, dbId))
        .limit(1)

      if (!joined) {
        return this.fallback.getStaffById(id)
      }

      return staffMemberFromRow(joined.staff, joined.authUserIsActive)
    } catch {
      return this.fallback.getStaffById(id)
    }
  }

  async saveStaff(staff: StaffMember): Promise<void> {
    await this.fallback.saveStaff(staff)
    if (!this.isDbAvailable()) return

    try {
      const dbId = toDbUuid(staff.id)
      const createdAt = staff.createdAt ? new Date(staff.createdAt) : new Date()
      const updatedAt = staff.updatedAt ? new Date(staff.updatedAt) : new Date()
      const authUserId = staff.authUserId ?? null

      await db
        .insert(staffMembers)
        .values({
          id: dbId,
          authUserId,
          name: staff.name,
          role: staff.role,
          hashedPin: staff.pinHash,
          pinSalt: staff.pinSalt,
          isActive: staff.active,
          createdAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: staffMembers.id,
          set: {
            authUserId,
            name: staff.name,
            role: staff.role,
            hashedPin: staff.pinHash,
            pinSalt: staff.pinSalt,
            isActive: staff.active,
            updatedAt: new Date(),
          },
        })

      // Synchronize activation state & profile with linked Better Auth user account when present
      if (authUserId) {
        await db
          .update(authUserTable)
          .set({
            name: staff.name,
            isActive: staff.active,
            updatedAt: new Date(),
          })
          .where(eq(authUserTable.id, authUserId))

        if (!staff.active) {
          await db.delete(authSessionTable).where(eq(authSessionTable.userId, authUserId))
        }
      }
    } catch {
      // fallback already saved
    }
  }

  async deleteStaff(id: string): Promise<void> {
    if (this.fallback.deleteStaff) {
      await this.fallback.deleteStaff(id)
    }
    if (!this.isDbAvailable()) return

    try {
      const dbId = toDbUuid(id)
      await db.delete(staffMembers).where(eq(staffMembers.id, dbId))
    } catch {
      // fallback already updated
    }
  }

  async recordAuditLog(entry: AuditLogEntry): Promise<void> {
    if (this.fallback.recordAuditLog) {
      await this.fallback.recordAuditLog(entry)
    }
    if (!this.isDbAvailable()) return

    try {
      const dbId = toDbUuid(entry.id)
      const reservationId = toDbUuid(entry.reservationId)
      const staffId = entry.staffId ? toDbUuid(entry.staffId) : null

      await db.insert(reservationAuditLogs).values({
        id: dbId,
        reservationId,
        staffId,
        action: entry.action,
        previousState: entry.prevState,
        newState: entry.newState,
        createdAt: entry.timestamp ? new Date(entry.timestamp) : new Date(),
      })
    } catch {
      // fallback already recorded
    }
  }

  async getAuditLogs(reservationId?: string): Promise<AuditLogEntry[]> {
    if (!this.isDbAvailable()) {
      return this.fallback.getAuditLogs ? this.fallback.getAuditLogs(reservationId) : []
    }

    try {
      let rows
      if (reservationId) {
        const resDbId = toDbUuid(reservationId)
        rows = await db
          .select()
          .from(reservationAuditLogs)
          .where(eq(reservationAuditLogs.reservationId, resDbId))
      } else {
        rows = await db.select().from(reservationAuditLogs)
      }

      if (rows.length === 0) {
        return this.fallback.getAuditLogs ? this.fallback.getAuditLogs(reservationId) : []
      }

      return rows.map((r) => ({
        id: r.id,
        reservationId: r.reservationId,
        staffId: r.staffId || '',
        action: r.action,
        prevState: r.previousState,
        newState: r.newState,
        timestamp: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      }))
    } catch {
      return this.fallback.getAuditLogs ? this.fallback.getAuditLogs(reservationId) : []
    }
  }
}

/**
 * Isolated terminal PIN-unlock cookie name.
 * Primary authentication and session management use Better Auth (`@/lib/auth/auth` -> `better-auth.session_token`).
 * Helpers below bridge to Better Auth's secret and session store so there is no split-brain state.
 */
export const STAFF_SESSION_COOKIE = 'staff-service-session'
export const STAFF_SESSION_TTL_SECONDS = 12 * 60 * 60 // 12 hours

/**
 * Resolves the HMAC secret for terminal PIN-unlock tokens, sharing Better Auth's secret
 * (`BETTER_AUTH_SECRET` / `AUTH_SECRET`) when `STAFF_SESSION_SECRET` / `MANAGER_SESSION_SECRET`
 * are not explicitly set, and delegating to `resolveBetterAuthSecret` in development/test.
 */
export function getStaffSessionSecret(
  env: Record<string, string | undefined> = process.env
): string {
  const configured =
    env.STAFF_SESSION_SECRET?.trim() ||
    env.MANAGER_SESSION_SECRET?.trim() ||
    env.BETTER_AUTH_SECRET?.trim() ||
    env.AUTH_SECRET?.trim()
  if (configured) return configured

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'STAFF_SESSION_SECRET (or BETTER_AUTH_SECRET / MANAGER_SESSION_SECRET) must be set in production.'
    )
  }

  return resolveBetterAuthSecret(env)
}

function safeHmacEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  return leftBuf.length === rightBuf.length && timingSafeEqual(leftBuf, rightBuf)
}

export function signStaffSessionToken(
  session: { staffId: string; name: string; role: StaffRole; exp?: number; iat?: number },
  secret = getStaffSessionSecret(),
  ttlSeconds = STAFF_SESSION_TTL_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000)
  const iat = session.iat ?? now
  const exp = session.exp ?? (iat + ttlSeconds)

  const payload = {
    staffId: session.staffId,
    id: session.staffId,
    name: session.name,
    role: session.role,
    iat,
    exp,
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

export function verifyStaffSessionToken(
  token: string | undefined | null,
  secret = getStaffSessionSecret()
): StaffSession | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) return null

  const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  if (!safeHmacEqual(signature, expectedSignature)) {
    return null
  }

  try {
    const raw = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    const now = Math.floor(Date.now() / 1000)
    const staffId = raw.staffId || raw.id
    if (!staffId || !raw.name || !raw.role || !raw.exp || typeof raw.exp !== 'number' || raw.exp <= now) {
      return null
    }
    return {
      staffId,
      id: staffId,
      name: raw.name,
      role: raw.role,
      exp: raw.exp,
      iat: raw.iat ?? (raw.exp - STAFF_SESSION_TTL_SECONDS),
    }
  } catch {
    return null
  }
}

export function staffCookieOptions(maxAge = STAFF_SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  }
}

function extractTokenFromCookieString(cookieStr: string): string | null {
  const match = cookieStr.match(/(?:^|;\s*)staff-service-session=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function normalizeAuthRoleToStaffRole(role: string | undefined | null): StaffRole {
  if (role === 'admin') return 'admin'
  if (role === 'manager') return 'manager'
  if (role === 'server') return 'server'
  return 'host'
}

function extractBetterAuthCookieHeaders(requestHeadersOrCookies?: unknown): Headers | null {
  if (!requestHeadersOrCookies) return null
  if (requestHeadersOrCookies instanceof Headers) {
    const cookie = requestHeadersOrCookies.get('cookie')
    return cookie && cookie.includes('better-auth.session_token=') ? requestHeadersOrCookies : null
  }
  if (typeof requestHeadersOrCookies === 'string') {
    if (requestHeadersOrCookies.includes('better-auth.session_token=')) {
      return new Headers({ cookie: requestHeadersOrCookies })
    }
    return null
  }
  if (typeof requestHeadersOrCookies === 'object') {
    const obj = requestHeadersOrCookies as Record<string, unknown>
    if (obj.headers) {
      const h = obj.headers
      if (h instanceof Headers) {
        const cookie = h.get('cookie')
        return cookie && cookie.includes('better-auth.session_token=') ? h : null
      }
      const cookieHeader =
        typeof (h as { get?: (k: string) => string | null }).get === 'function'
          ? (h as { get: (k: string) => string | null }).get('cookie')
          : ((h as Record<string, unknown>)['cookie'] as string | undefined)
      if (cookieHeader && cookieHeader.includes('better-auth.session_token=')) {
        return new Headers({ cookie: cookieHeader })
      }
    }
    if (typeof (obj as { get?: unknown }).get === 'function') {
      const getter = obj as { get: (k: string) => unknown }
      const baCookie = getter.get('better-auth.session_token')
      const tokenVal =
        typeof baCookie === 'string' ? baCookie : (baCookie as { value?: string })?.value
      if (tokenVal) {
        return new Headers({ cookie: `better-auth.session_token=${tokenVal}` })
      }
      const cookieHeader = getter.get('cookie')
      if (typeof cookieHeader === 'string' && cookieHeader.includes('better-auth.session_token=')) {
        return new Headers({ cookie: cookieHeader })
      }
    }
  }
  return null
}

/**
 * Resolves a staff session by bridging first to Better Auth (`better-auth.session_token`)
 * when present, and falling back to an isolated terminal PIN-unlock token (`staff-service-session`)
 * whose staff member is verified to still be active in `defaultStaffService`.
 */
export async function getStaffSession(
  requestHeadersOrCookies?: unknown,
  staffLookup: Pick<StaffService, 'getStaffById'> = defaultStaffService
): Promise<StaffSession | null> {
  // 1. Bridge to primary Better Auth session when a Better Auth cookie is present (or ambient headers)
  const baHeaders = extractBetterAuthCookieHeaders(requestHeadersOrCookies)
  if (baHeaders || requestHeadersOrCookies === undefined) {
    const baSession = await getBetterAuthStaffSession(baHeaders ?? undefined).catch(() => null)
    if (baSession?.user && baSession.user.isActive !== false) {
      const exp = Math.floor(new Date(baSession.session.expiresAt).getTime() / 1000)
      return {
        staffId: baSession.user.staffId || baSession.user.id,
        id: baSession.user.id,
        name: baSession.user.name,
        role: normalizeAuthRoleToStaffRole(baSession.user.role),
        exp,
        iat: exp - 30 * 24 * 60 * 60,
      }
    }
  }

  // 2. Fallback to isolated PIN-unlock token
  let token: string | null = null

  if (!requestHeadersOrCookies) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      token = cookieStore.get(STAFF_SESSION_COOKIE)?.value ?? null
    } catch {
      return null
    }
  } else if (typeof requestHeadersOrCookies === 'string') {
    if (requestHeadersOrCookies.includes(`${STAFF_SESSION_COOKIE}=`)) {
      token = extractTokenFromCookieString(requestHeadersOrCookies)
    } else if (requestHeadersOrCookies.includes('.')) {
      token = requestHeadersOrCookies.trim()
    }
  } else if (typeof requestHeadersOrCookies === 'object') {
    const obj = requestHeadersOrCookies as Record<string, unknown>
    // Check if it's Request / NextRequest with .cookies
    if (obj.cookies && typeof (obj.cookies as { get?: unknown }).get === 'function') {
      const c = (obj.cookies as { get: (name: string) => unknown }).get(STAFF_SESSION_COOKIE)
      token = typeof c === 'string' ? c : (c as { value?: string })?.value ?? null
    }
    // Check if it has .headers (Request or NextRequest)
    if (!token && obj.headers) {
      const headers = obj.headers as { get?: (k: string) => string | null; [key: string]: unknown }
      const cookieHeader = typeof headers.get === 'function'
        ? headers.get('cookie')
        : (headers['cookie'] as string | undefined)
      if (cookieHeader) {
        token = extractTokenFromCookieString(cookieHeader)
      }
      if (!token) {
        const authHeader = typeof headers.get === 'function'
          ? headers.get('authorization')
          : (headers['authorization'] as string | undefined)
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7).trim()
        }
      }
    }
    // Check if it's Headers or ReadonlyRequestCookies directly (has .get)
    if (!token && typeof (obj as { get?: unknown }).get === 'function') {
      const getter = obj as { get: (k: string) => unknown }
      const c = getter.get(STAFF_SESSION_COOKIE)
      if (c) {
        token = typeof c === 'string' ? c : (c as { value?: string })?.value ?? null
      }
      if (!token) {
        const cookieHeader = getter.get('cookie')
        if (typeof cookieHeader === 'string') {
          token = extractTokenFromCookieString(cookieHeader)
        }
      }
    }
  }

  if (!token) return null
  const verified = verifyStaffSessionToken(token)
  if (!verified) return null

  // Enforce active-account check so deactivated staff members cannot use stale PIN session tokens
  const knownStaff = await staffLookup.getStaffById(verified.staffId).catch(() => null)
  if (knownStaff && !knownStaff.active) {
    return null
  }

  return verified
}

export class StaffService {
  private adapter: StaffStorageAdapter

  constructor(adapter: StaffStorageAdapter = new InMemoryStaffStorageAdapter()) {
    this.adapter = adapter
  }

  getAdapter(): StaffStorageAdapter {
    return this.adapter
  }

  async getStaffList(includeInactive = false): Promise<StaffMember[]> {
    const list = await this.adapter.getStaffList()
    return includeInactive ? list : list.filter(s => s.active)
  }

  async getPublicStaffList(): Promise<StaffProfile[]> {
    const activeStaff = await this.getStaffList(false)
    return activeStaff.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role,
      active: s.active,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  }

  async getStaffById(id: string): Promise<StaffMember | null> {
    return this.adapter.getStaffById(id)
  }

  async verifyStaffPin(pin: string): Promise<StaffMember | null> {
    if (!pin || typeof pin !== 'string') return null
    const list = await this.adapter.getStaffList()
    for (const member of list) {
      if (!member.active) continue
      if (verifyPinHash(pin, member.pinHash, member.pinSalt)) {
        return member
      }
    }
    return null
  }

  async saveStaffMember(input: SaveStaffInput): Promise<StaffMember> {
    const now = new Date().toISOString()

    if (input.id) {
      const existing = await this.adapter.getStaffById(input.id)
      if (!existing) {
        throw new Error(`Staff member with id ${input.id} not found`)
      }

      let pinHash = existing.pinHash
      let pinSalt = existing.pinSalt

      if (input.pin) {
        const hashed = hashPin(input.pin)
        pinHash = hashed.hash
        pinSalt = hashed.salt
      }

      const updated: StaffMember = {
        ...existing,
        authUserId: input.authUserId !== undefined ? input.authUserId : existing.authUserId,
        name: input.name?.trim() || existing.name,
        role: input.role || existing.role,
        pinHash,
        pinSalt,
        active: input.active !== undefined ? input.active : existing.active,
        updatedAt: now,
      }

      await this.adapter.saveStaff(updated)
      return updated
    } else {
      if (!input.name || !input.name.trim()) {
        throw new Error('Staff name is required')
      }
      if (!input.role) {
        throw new Error('Staff role is required')
      }
      if (!input.pin) {
        throw new Error('Staff PIN is required')
      }

      const id = `staff-${Date.now()}-${randomBytes(4).toString('hex')}`
      const { hash, salt } = hashPin(input.pin)

      const newMember: StaffMember = {
        id,
        authUserId: input.authUserId ?? null,
        name: input.name.trim(),
        role: input.role,
        pinHash: hash,
        pinSalt: salt,
        active: input.active !== undefined ? input.active : true,
        createdAt: now,
        updatedAt: now,
      }

      await this.adapter.saveStaff(newMember)
      return newMember
    }
  }

  async deleteStaffMember(id: string): Promise<void> {
    if (this.adapter.deleteStaff) {
      await this.adapter.deleteStaff(id)
    } else {
      const existing = await this.adapter.getStaffById(id)
      if (existing) {
        await this.adapter.saveStaff({ ...existing, active: false, updatedAt: new Date().toISOString() })
      }
    }
  }

  createSessionToken(member: Pick<StaffMember, 'id' | 'name' | 'role'>, ttlSeconds?: number): string {
    return signStaffSessionToken(
      {
        staffId: member.id,
        name: member.name,
        role: member.role,
      },
      undefined,
      ttlSeconds
    )
  }

  async recordAuditLog(
    reservationId: string,
    staffId: string,
    action: string,
    prevState?: unknown,
    newState?: unknown
  ): Promise<AuditLogEntry> {
    const staff = await this.getStaffById(staffId).catch(() => null)
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${randomBytes(4).toString('hex')}`,
      reservationId,
      staffId,
      staffName: staff?.name,
      action,
      prevState: prevState !== undefined ? JSON.parse(JSON.stringify(prevState)) : undefined,
      newState: newState !== undefined ? JSON.parse(JSON.stringify(newState)) : undefined,
      timestamp: new Date().toISOString(),
    }

    if (this.adapter.recordAuditLog) {
      await this.adapter.recordAuditLog(entry)
    }
    return entry
  }

  async getAuditLogs(reservationId?: string): Promise<AuditLogEntry[]> {
    if (this.adapter.getAuditLogs) {
      return this.adapter.getAuditLogs(reservationId)
    }
    return []
  }
}

const globalForStaff = globalThis as unknown as { staffService?: StaffService }
export const defaultStaffService =
  globalForStaff.staffService ??
  new StaffService(
    process.env.DATABASE_URL
      ? new DrizzleStaffStorageAdapter()
      : new InMemoryStaffStorageAdapter()
  )
if (process.env.NODE_ENV !== 'production') {
  globalForStaff.staffService = defaultStaffService
}

export async function verifyStaffPin(pin: string): Promise<StaffMember | null> {
  return defaultStaffService.verifyStaffPin(pin)
}

export async function recordAuditLog(
  reservationId: string,
  staffId: string,
  action: string,
  prevState?: unknown,
  newState?: unknown
): Promise<AuditLogEntry> {
  return defaultStaffService.recordAuditLog(reservationId, staffId, action, prevState, newState)
}

export const STAFF_ROLES: StaffRole[] = ['host', 'server', 'manager', 'admin']

export const ROLE_HIERARCHY: Record<StaffRole, number> = {
  host: 1,
  server: 2,
  manager: 3,
  admin: 4,
}

export type StaffPermission =
  | 'view_floor'
  | 'seat_guest'
  | 'edit_reservation'
  | 'cancel_reservation'
  | 'manage_staff'
  | 'manage_settings'
  | 'override_turn_times'
  | 'view_audit_logs'

export const ROLE_PERMISSIONS: Record<StaffRole, Set<StaffPermission>> = {
  host: new Set(['view_floor', 'seat_guest', 'edit_reservation']),
  server: new Set(['view_floor', 'seat_guest', 'edit_reservation']),
  manager: new Set([
    'view_floor',
    'seat_guest',
    'edit_reservation',
    'cancel_reservation',
    'manage_staff',
    'manage_settings',
    'override_turn_times',
    'view_audit_logs',
  ]),
  admin: new Set([
    'view_floor',
    'seat_guest',
    'edit_reservation',
    'cancel_reservation',
    'manage_staff',
    'manage_settings',
    'override_turn_times',
    'view_audit_logs',
  ]),
}

export function hasPermission(role: StaffRole, permission: StaffPermission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

export function isManagerOrAdmin(role: StaffRole): boolean {
  return role === 'manager' || role === 'admin'
}

export function isAtLeastRole(role: StaffRole, minimumRole: StaffRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0)
}
