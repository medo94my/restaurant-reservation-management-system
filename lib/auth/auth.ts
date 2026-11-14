import { randomBytes } from 'node:crypto'
import { betterAuth, APIError } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { db } from '../db.ts'
import { user, session, account, verification, type AuthUser } from '../schema.ts'

/**
 * Minimum staff passcode length. Shared by Better Auth (`emailAndPassword.minPasswordLength`)
 * and the staff management API routes so 4+ char passcodes work for both sign-up and reset.
 */
export const STAFF_PASSCODE_MIN_LENGTH = 4
export const STAFF_PASSCODE_MAX_LENGTH = 128

/** Canonical default role for staff accounts (matches `staff_role` enum and GLOSSARY.md). */
export const DEFAULT_STAFF_ROLE = 'host'

export type StaffAccountRole = 'manager' | 'host'

/**
 * Normalizes a requested staff account role to its canonical value.
 * `'hostess'` is accepted as a legacy alias for `'host'`. Missing input defaults to `'host'`.
 * Returns `null` for unsupported roles.
 */
export function normalizeStaffAccountRole(role: unknown): StaffAccountRole | null {
  if (role === undefined || role === null || role === '') return DEFAULT_STAFF_ROLE
  if (role === 'manager') return 'manager'
  if (role === 'host' || role === 'hostess') return 'host'
  return null
}

/**
 * Validates a staff passcode against the shared length policy.
 * Returns an error message, or `null` when the passcode is acceptable.
 */
export function validateStaffPasscode(passcode: unknown): string | null {
  if (typeof passcode !== 'string' || passcode.length < STAFF_PASSCODE_MIN_LENGTH) {
    return `Passcode must be at least ${STAFF_PASSCODE_MIN_LENGTH} characters long.`
  }
  if (passcode.length > STAFF_PASSCODE_MAX_LENGTH) {
    return `Passcode must be at most ${STAFF_PASSCODE_MAX_LENGTH} characters long.`
  }
  return null
}

type StaffStatusLookup = (userId: string) => Promise<{ isActive: boolean } | undefined>

const lookupStaffStatus: StaffStatusLookup = async (userId) => {
  const [existingUser] = await db
    .select({ isActive: user.isActive })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return existingUser
}

/**
 * Session-creation guard: rejects sign-in for deactivated or unknown accounts.
 * Fails closed — if the account status cannot be verified (e.g. DB error), sign-in is refused.
 */
export async function assertStaffCanCreateSession(
  userId: string,
  lookup: StaffStatusLookup = lookupStaffStatus
): Promise<void> {
  let existingUser: { isActive: boolean } | undefined
  try {
    existingUser = await lookup(userId)
  } catch (err: unknown) {
    console.error('[auth] Unable to verify staff account status; rejecting sign-in.', err)
    throw new APIError('SERVICE_UNAVAILABLE', {
      message: 'Unable to verify staff account status. Please try again.',
    })
  }

  if (!existingUser) {
    throw new APIError('UNAUTHORIZED', { message: 'Staff account not found.' })
  }
  if (!existingUser.isActive) {
    throw new APIError('UNAUTHORIZED', {
      message: 'This staff account has been deactivated.',
    })
  }
}

let devOnlyBetterAuthSecret: string | undefined

/**
 * Resolves the Better Auth secret from environment variables without any hardcoded fallback.
 * Throws in production when unset; in development/test, generates a random per-process secret.
 */
export function resolveBetterAuthSecret(
  env: Record<string, string | undefined> = process.env
): string {
  const configured = env.BETTER_AUTH_SECRET?.trim() || env.AUTH_SECRET?.trim()
  if (configured) return configured

  if (env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET must be set in production.')
  }

  devOnlyBetterAuthSecret ??= randomBytes(32).toString('hex')
  return devOnlyBetterAuthSecret
}

export const DEV_LOCAL_TRUSTED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://localhost:8400',
] as const

function normalizeTrustedOriginCandidate(
  raw: string | undefined,
  assumeHttpsIfSchemeMissing = false
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const candidate =
    assumeHttpsIfSchemeMissing && !/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
      ? `https://${trimmed}`
      : trimmed

  // Support Better Auth wildcard origin patterns such as https://*.example.com
  if (/^https?:\/\/\*\.[^/\s]+$/i.test(candidate.replace(/\/+$/, ''))) {
    return candidate.replace(/\/+$/, '').toLowerCase()
  }

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.origin
  } catch {
    return null
  }
}

/**
 * Resolves Better Auth `trustedOrigins` from environment variables:
 * - `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated origins/URLs)
 * - `BETTER_AUTH_URL`
 * - `NEXT_PUBLIC_APP_URL`
 * - `VERCEL_URL` (bare hostname or https:// URL)
 * - Localhost / 127.0.0.1 dev ports when `NODE_ENV !== 'production'`
 */
export function resolveTrustedOrigins(
  env: Record<string, string | undefined> = process.env
): string[] {
  const origins = new Set<string>()

  if (env.BETTER_AUTH_TRUSTED_ORIGINS) {
    for (const part of env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')) {
      const normalized = normalizeTrustedOriginCandidate(part)
      if (normalized) origins.add(normalized)
    }
  }

  for (const rawUrl of [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL]) {
    const normalized = normalizeTrustedOriginCandidate(rawUrl)
    if (normalized) origins.add(normalized)
  }

  const vercelOrigin = normalizeTrustedOriginCandidate(env.VERCEL_URL, true)
  if (vercelOrigin) {
    origins.add(vercelOrigin)
  }

  if (env.NODE_ENV !== 'production') {
    for (const devOrigin of DEV_LOCAL_TRUSTED_ORIGINS) {
      origins.add(devOrigin)
    }
  }

  return Array.from(origins)
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//i, '')}`
      : 'http://localhost:3001'),
  trustedOrigins: resolveTrustedOrigins(),
  secret: resolveBetterAuthSecret(),
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: STAFF_PASSCODE_MIN_LENGTH,
    maxPasswordLength: STAFF_PASSCODE_MAX_LENGTH,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days persistent staff session
    updateAge: 60 * 60 * 24, // 24 hours
    // Cookie cache disabled: every session lookup hits the DB so deleting `session` rows
    // (staff deactivation / passcode reset) revokes access immediately.
    cookieCache: {
      enabled: false,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: DEFAULT_STAFF_ROLE,
        required: true,
      },
      staffId: {
        type: 'string',
        required: true,
      },
      isActive: {
        type: 'boolean',
        defaultValue: true,
        required: true,
      },
      workspaceId: {
        type: 'string',
        required: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (newSession) => {
          // Reject login for deactivated accounts; fail closed on lookup errors.
          await assertStaffCanCreateSession(newSession.userId)
        },
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: 2,
      maxUsernameLength: 50,
      usernameValidator: (val) => /^[a-zA-Z0-9_\-\.]+$/.test(val),
    }),
  ],
})

export type SessionWithStaff = {
  session: {
    id: string
    userId: string
    expiresAt: Date
  }
  user: AuthUser
}

/**
 * Retrieves the current staff session from incoming request headers.
 */
export async function getStaffSession(customHeaders?: Headers): Promise<SessionWithStaff | null> {
  try {
    let reqHeaders = customHeaders
    if (!reqHeaders) {
      const { headers } = await import('next/headers')
      reqHeaders = await headers()
    }

    // Resilient fallback: ensure cookie header is present from next/headers cookies()
    if (!reqHeaders.get('cookie')) {
      try {
        const { cookies } = await import('next/headers')
        const cookieStore = await cookies()
        const cookieString = cookieStore
          .getAll()
          .map((c) => `${c.name}=${c.value}`)
          .join('; ')
        if (cookieString) {
          const newHeaders = new Headers(reqHeaders)
          newHeaders.set('cookie', cookieString)
          reqHeaders = newHeaders
        }
      } catch {
        // cookies() may not be available in non-request execution contexts
      }
    }

    const sessionRes = await auth.api.getSession({
      headers: reqHeaders,
    })

    if (!sessionRes || !sessionRes.user) {
      return null
    }

    return sessionRes as unknown as SessionWithStaff
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] getStaffSession error:', err)
    }
    return null
  }
}

/**
 * Server guard: requires an active manager session.
 * Throws or returns null if not authenticated as manager.
 */
export async function requireManager(customHeaders?: Headers): Promise<AuthUser> {
  const staffSession = await getStaffSession(customHeaders)
  if (!staffSession || !staffSession.user) {
    throw new APIError('UNAUTHORIZED', { message: 'Authentication required.' })
  }
  if (!staffSession.user.isActive) {
    throw new APIError('FORBIDDEN', { message: 'Account is deactivated.' })
  }
  if (staffSession.user.role !== 'manager' && staffSession.user.role !== 'admin') {
    throw new APIError('FORBIDDEN', { message: 'Manager privileges required.' })
  }
  return staffSession.user
}

/**
 * Server guard: requires an active staff session (manager or hostess).
 */
export async function requireStaff(customHeaders?: Headers): Promise<AuthUser> {
  const staffSession = await getStaffSession(customHeaders)
  if (!staffSession || !staffSession.user) {
    throw new APIError('UNAUTHORIZED', { message: 'Authentication required.' })
  }
  if (!staffSession.user.isActive) {
    throw new APIError('FORBIDDEN', { message: 'Account is deactivated.' })
  }
  return staffSession.user
}
