import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import {
  auth,
  assertStaffCanCreateSession,
  DEFAULT_STAFF_ROLE,
  DEV_LOCAL_TRUSTED_ORIGINS,
  getStaffSession,
  normalizeStaffAccountRole,
  requireManager,
  requireStaff,
  resolveBetterAuthSecret,
  resolveTrustedOrigins,
  STAFF_PASSCODE_MIN_LENGTH,
  validateStaffPasscode,
} from './auth.ts'
import { db } from '../db.ts'
import * as schema from '../schema.ts'

/**
 * Retries a Better Auth sign-in call if a concurrent test file (e.g. onboarding-service.test.ts)
 * momentarily deletes and re-inserts seeded "user" rows inside a transaction, causing PostgreSQL
 * to raise 23503 (foreign_key_violation) on the old tuple CTID during session insert.
 */
async function signInWithRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const code =
        (err as { cause?: { code?: string }; code?: string })?.cause?.code ||
        (err as { code?: string })?.code
      if (code === '23503' && attempt < retries) {
        await new Promise((r) => setTimeout(r, 30))
        continue
      }
      throw err
    }
  }
}

describe('Better Auth - Staff ID and Passcode Authentication', () => {
  test('staff can authenticate with Staff ID and Passcode via signInUsername', async () => {
    // Test signing in as seeded manager MGR-01
    const result = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'MGR-01',
          password: process.env.INITIAL_MANAGER_PASSCODE || 'manager123',
        },
      })
    )

    assert.ok(result, 'Sign in result should exist')
    assert.ok(result.user, 'User object should exist')
    const userObj = result.user as Record<string, unknown>
    assert.strictEqual(userObj.name, 'Head Manager')
    assert.strictEqual(userObj.role, 'manager')
    assert.strictEqual(userObj.staffId, 'MGR-01')
    assert.ok(result.token, 'Session token should be issued')
  })

  test('hostess can authenticate with Staff ID and Passcode', async () => {
    const result = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'HOST-01',
          password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
        },
      })
    )

    assert.ok(result, 'Sign in result should exist')
    const userObj = result.user as Record<string, unknown>
    assert.strictEqual(userObj.name, 'Head Hostess')
    assert.strictEqual(userObj.role, 'hostess')
    assert.strictEqual(userObj.staffId, 'HOST-01')
  })

  test('invalid passcode is rejected with authentication failure', async () => {
    await assert.rejects(
      async () => {
        await auth.api.signInUsername({
          body: {
            username: 'MGR-01',
            password: 'wrong_password_999',
          },
        })
      },
      (err: { status?: string; statusCode?: number }) => {
        return err.statusCode === 400 || err.statusCode === 401 || err.status === 'BAD_REQUEST'
      }
    )
  })

  test('non-existent Staff ID is rejected with authentication failure', async () => {
    await assert.rejects(
      async () => {
        await auth.api.signInUsername({
          body: {
            username: 'GHOST-99',
            password: 'any_passcode',
          },
        })
      },
      (err: { status?: string; statusCode?: number }) => {
        return err.statusCode === 400 || err.statusCode === 401 || err.status === 'BAD_REQUEST'
      }
    )
  })

  test('empty Staff ID or empty passcode is rejected', async () => {
    await assert.rejects(
      async () => {
        await auth.api.signInUsername({
          body: {
            username: '',
            password: 'manager123',
          },
        })
      },
      (err: { status?: string; statusCode?: number; message?: string }) => {
        return (
          err.statusCode === 400 ||
          err.statusCode === 401 ||
          err.statusCode === 422 ||
          err.status === 'BAD_REQUEST' ||
          err.status === 'UNAUTHORIZED' ||
          /invalid username or password/i.test(err.message || '')
        )
      }
    )

    await assert.rejects(
      async () => {
        await auth.api.signInUsername({
          body: {
            username: 'MGR-01',
            password: '',
          },
        })
      },
      (err: { status?: string; statusCode?: number; message?: string }) => {
        return (
          err.statusCode === 400 ||
          err.statusCode === 401 ||
          err.statusCode === 422 ||
          err.status === 'BAD_REQUEST' ||
          err.status === 'UNAUTHORIZED' ||
          /invalid/i.test(err.message || '')
        )
      }
    )
  })

  test('signing in with lowercase staff ID succeeds via case normalization', async () => {
    const result = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'mgr-01',
          password: process.env.INITIAL_MANAGER_PASSCODE || 'manager123',
        },
      })
    )

    assert.ok(result, 'Sign in result should exist')
    assert.ok(result.user, 'User object should exist')
    const userObj = result.user as Record<string, unknown>
    assert.strictEqual(userObj.staffId, 'MGR-01')
  })

  test('deactivated staff account is blocked from signing in', async () => {
    // Temporarily deactivate HOST-01
    await db
      .update(schema.user)
      .set({ isActive: false })
      .where(eq(schema.user.staffId, 'HOST-01'))

    try {
      await assert.rejects(
        async () => {
          await auth.api.signInUsername({
            body: {
              username: 'HOST-01',
              password: 'hostess123',
            },
          })
        },
        /deactivated/i
      )
    } finally {
      // Re-activate
      await db
        .update(schema.user)
        .set({ isActive: true })
        .where(eq(schema.user.staffId, 'HOST-01'))
    }
  })

  test('session token expires in ~30 days (durable staff terminal session)', async () => {
    const result = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'HOST-01',
          password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
        },
      })
    )

    assert.ok(result.token, 'Session token should exist')

    // Verify exact session record in PostgreSQL session table
    const [exactSession] = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.token, result.token))

    assert.ok(exactSession, 'Session record should exist in DB for issued token')
    const remainingDays = (new Date(exactSession.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    assert.ok(
      remainingDays >= 28 && remainingDays <= 31,
      `Session remaining days (${remainingDays}) should be ~30 days`
    )
  })

  test('getStaffSession resolves session from incoming cookie headers', async () => {
    const signInRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'HOST-01',
          password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
        },
        asResponse: true,
      })
    )

    // Extract session cookie from Set-Cookie header
    const setCookie = signInRes.headers.get('set-cookie') || ''
    const tokenMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
    assert.ok(tokenMatch, 'Set-Cookie header must contain better-auth.session_token')
    const token = tokenMatch[1]

    const customHeaders = new Headers({
      cookie: `better-auth.session_token=${token}`,
    })

    const staffSession = await getStaffSession(customHeaders)
    assert.ok(staffSession, 'getStaffSession should return active session')
    assert.strictEqual(staffSession.user.staffId, 'HOST-01')
    assert.strictEqual(staffSession.user.role, 'hostess')
    assert.strictEqual(staffSession.user.isActive, true)
  })

  test('getStaffSession returns null when cookie header is missing or empty', async () => {
    const emptyHeaders = new Headers()
    const session = await getStaffSession(emptyHeaders)
    assert.strictEqual(session, null)

    const blankCookieHeaders = new Headers({ cookie: '' })
    const session2 = await getStaffSession(blankCookieHeaders)
    assert.strictEqual(session2, null)
  })

  test('getStaffSession returns null when token is forged or malformed', async () => {
    const invalidHeaders = new Headers({
      cookie: 'better-auth.session_token=forged-unauthorized-fake-token-xyz',
    })
    const session = await getStaffSession(invalidHeaders)
    assert.strictEqual(session, null)
  })

  test('getStaffSession cleanly extracts session token amidst multiple surrounding cookies', async () => {
    const signInRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'MGR-01',
          password: process.env.INITIAL_MANAGER_PASSCODE || 'manager123',
        },
        asResponse: true,
      })
    )

    const setCookie = signInRes.headers.get('set-cookie') || ''
    const tokenMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
    assert.ok(tokenMatch)
    const token = tokenMatch[1]

    const multiCookieHeaders = new Headers({
      cookie: `theme=dark; ga_client=12345; better-auth.session_token=${token}; dining_pref=booth`,
    })

    const staffSession = await getStaffSession(multiCookieHeaders)
    assert.ok(staffSession)
    assert.strictEqual(staffSession.user.staffId, 'MGR-01')
    assert.strictEqual(staffSession.user.role, 'manager')
  })

  // =========================================================================
  // Seam 3: Role & Privilege Guarding (requireManager & requireStaff)
  // =========================================================================
  test('requireManager succeeds when authenticated as manager', async () => {
    const signInRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'MGR-01',
          password: process.env.INITIAL_MANAGER_PASSCODE || 'manager123',
        },
        asResponse: true,
      })
    )
    const setCookie = signInRes.headers.get('set-cookie') || ''
    const token = setCookie.match(/better-auth\.session_token=([^;]+)/)![1]
    const headers = new Headers({ cookie: `better-auth.session_token=${token}` })

    const managerUser = await requireManager(headers)
    assert.ok(managerUser)
    assert.strictEqual(managerUser.staffId, 'MGR-01')
    assert.strictEqual(managerUser.role, 'manager')
  })

  test('requireManager throws FORBIDDEN when authenticated as hostess', async () => {
    const signInRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'HOST-01',
          password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
        },
        asResponse: true,
      })
    )
    const setCookie = signInRes.headers.get('set-cookie') || ''
    const token = setCookie.match(/better-auth\.session_token=([^;]+)/)![1]
    const headers = new Headers({ cookie: `better-auth.session_token=${token}` })

    await assert.rejects(
      async () => {
        await requireManager(headers)
      },
      (err: { status?: string; statusCode?: number; message?: string }) => {
        return (
          err.status === 'FORBIDDEN' ||
          err.statusCode === 403 ||
          /manager privileges required/i.test(err.message || '')
        )
      }
    )
  })

  test('requireManager and requireStaff throw UNAUTHORIZED when unauthenticated', async () => {
    const emptyHeaders = new Headers()
    await assert.rejects(
      async () => {
        await requireManager(emptyHeaders)
      },
      (err: { status?: string; statusCode?: number; message?: string }) => {
        return (
          err.status === 'UNAUTHORIZED' ||
          err.statusCode === 401 ||
          /authentication required/i.test(err.message || '')
        )
      }
    )

    await assert.rejects(
      async () => {
        await requireStaff(emptyHeaders)
      },
      (err: { status?: string; statusCode?: number; message?: string }) => {
        return (
          err.status === 'UNAUTHORIZED' ||
          err.statusCode === 401 ||
          /authentication required/i.test(err.message || '')
        )
      }
    )
  })

  test('requireStaff permits both hostess and manager roles', async () => {
    // 1. Hostess
    const hostRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'HOST-01',
          password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
        },
        asResponse: true,
      })
    )
    const hostToken = (hostRes.headers.get('set-cookie') || '').match(/better-auth\.session_token=([^;]+)/)![1]
    const hostHeaders = new Headers({ cookie: `better-auth.session_token=${hostToken}` })
    const hostUser = await requireStaff(hostHeaders)
    assert.strictEqual(hostUser.role, 'hostess')

    // 2. Manager
    const mgrRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'MGR-01',
          password: process.env.INITIAL_MANAGER_PASSCODE || 'manager123',
        },
        asResponse: true,
      })
    )
    const mgrToken = (mgrRes.headers.get('set-cookie') || '').match(/better-auth\.session_token=([^;]+)/)![1]
    const mgrHeaders = new Headers({ cookie: `better-auth.session_token=${mgrToken}` })
    const mgrUser = await requireStaff(mgrHeaders)
    assert.strictEqual(mgrUser.role, 'manager')
  })

  // =========================================================================
  // Seam 4: Session Invalidation & Sign-Out (auth.api.signOut)
  // =========================================================================
  test('signOut invalidates the session token in the database and clears the cookie', async () => {
    const signInRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'HOST-01',
          password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
        },
        asResponse: true,
      })
    )
    const setCookie = signInRes.headers.get('set-cookie') || ''
    const token = setCookie.match(/better-auth\.session_token=([^;]+)/)![1]
    const headers = new Headers({ cookie: `better-auth.session_token=${token}` })

    // Verify session is initially active
    const activeSession = await getStaffSession(headers)
    assert.ok(activeSession, 'Session should be valid prior to sign out')

    // Perform sign out
    const signOutRes = await auth.api.signOut({
      headers,
      asResponse: true,
    })

    // Assert Set-Cookie in sign-out response expires or clears the session token
    const signOutSetCookie = signOutRes.headers.get('set-cookie') || ''
    assert.ok(
      signOutSetCookie.includes('better-auth.session_token') ||
        signOutSetCookie.includes('Max-Age=0') ||
        signOutSetCookie.includes('Expires='),
      'Sign-out response must expire or clear the session cookie'
    )

    // Assert that getStaffSession now returns null for this token
    const revokedSession = await getStaffSession(headers)
    assert.strictEqual(revokedSession, null, 'Revoked session token must resolve to null')
  })
})

describe('Better Auth - session revocation, secrets, fail-closed hook & passcode policy', () => {
  const extractToken = (res: Response): string => {
    const setCookie = res.headers.get('set-cookie') || ''
    const match = setCookie.match(/better-auth\.session_token=([^;]+)/)
    assert.ok(match, 'Set-Cookie header must contain better-auth.session_token')
    return match[1]
  }

  // [F2-1]
  test('cookieCache is disabled so session lookups always hit the database', () => {
    assert.equal(auth.options.session?.cookieCache?.enabled, false)
  })

  test('deleting session rows revokes an active session cookie immediately', async () => {
    const signInRes = await signInWithRetry(() =>
      auth.api.signInUsername({
        body: {
          username: 'HOST-01',
          password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
        },
        asResponse: true,
      })
    )
    const cookieToken = extractToken(signInRes)
    // Pass along every cookie Better Auth set (incl. any session_data cache cookie) to prove
    // revocation does not depend on the client discarding cached session data.
    const allCookies = signInRes.headers
      .getSetCookie()
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ')
    const headers = new Headers({ cookie: allCookies || `better-auth.session_token=${cookieToken}` })

    const active = await getStaffSession(headers)
    assert.ok(active, 'Session should be valid before revocation')

    // Same operation PUT /api/staff/[id] performs on deactivation / passcode reset
    // (scoped to this one session so concurrent tests are unaffected).
    await db.delete(schema.session).where(eq(schema.session.id, active.session.id))

    const revoked = await getStaffSession(headers)
    assert.equal(revoked, null, 'Deleted session must not be served from a cookie cache')
  })

  // [F2-2]
  test('resolveBetterAuthSecret has no hardcoded fallback and throws in production when unset', () => {
    assert.equal(resolveBetterAuthSecret({ BETTER_AUTH_SECRET: 'configured-secret-value' }), 'configured-secret-value')
    assert.equal(resolveBetterAuthSecret({ AUTH_SECRET: 'fallback-auth-secret' }), 'fallback-auth-secret')

    assert.throws(
      () => resolveBetterAuthSecret({ NODE_ENV: 'production' }),
      /BETTER_AUTH_SECRET must be set in production/
    )
    assert.throws(
      () => resolveBetterAuthSecret({ NODE_ENV: 'production', BETTER_AUTH_SECRET: '   ' }),
      /BETTER_AUTH_SECRET must be set in production/
    )

    const devSecret = resolveBetterAuthSecret({ NODE_ENV: 'development' })
    assert.notEqual(devSecret, 'dev-super-secret-key-for-restaurant-staff-auth-min-32-chars')
    assert.match(devSecret, /^[0-9a-f]{64}$/)
    assert.equal(resolveBetterAuthSecret({}), devSecret)
  })

  // [F2-3]
  test('assertStaffCanCreateSession fails closed when the status lookup throws', async () => {
    const originalError = console.error
    console.error = () => {}
    try {
      await assert.rejects(
        assertStaffCanCreateSession('user-1', async () => {
          throw new Error('connection refused')
        }),
        (err: { status?: string; statusCode?: number }) =>
          err.status === 'SERVICE_UNAVAILABLE' || err.statusCode === 503
      )
    } finally {
      console.error = originalError
    }
  })

  test('assertStaffCanCreateSession rejects unknown and deactivated accounts, allows active ones', async () => {
    await assert.rejects(
      assertStaffCanCreateSession('missing', async () => undefined),
      (err: { status?: string }) => err.status === 'UNAUTHORIZED'
    )
    await assert.rejects(
      assertStaffCanCreateSession('inactive', async () => ({ isActive: false })),
      /deactivated/i
    )
    await assert.doesNotReject(assertStaffCanCreateSession('active', async () => ({ isActive: true })))
  })

  // [F2-4]
  test('passcode policy is shared between Better Auth and the staff API', () => {
    assert.equal(STAFF_PASSCODE_MIN_LENGTH, 4)
    assert.equal(auth.options.emailAndPassword?.minPasswordLength, STAFF_PASSCODE_MIN_LENGTH)
    assert.equal(validateStaffPasscode('1234'), null)
    assert.match(validateStaffPasscode('123') || '', /at least 4/)
    assert.match(validateStaffPasscode(undefined) || '', /at least 4/)
    assert.match(validateStaffPasscode('x'.repeat(129)) || '', /at most 128/)
  })

  test('a 4-character staff passcode can sign up and sign in via Better Auth', async () => {
    const staffId = `T4-${Date.now().toString(36).toUpperCase()}`
    const passcode = '4821'
    try {
      const created = await auth.api.signUpEmail({
        body: {
          email: `${staffId.toLowerCase()}@staff.internal`,
          username: staffId,
          password: passcode,
          name: 'Short Passcode Tester',
          role: DEFAULT_STAFF_ROLE,
          staffId,
          isActive: true,
        },
      })
      assert.ok(created.user, 'signUpEmail must accept a 4-char passcode')

      const signedIn = await auth.api.signInUsername({ body: { username: staffId, password: passcode } })
      assert.ok(signedIn.token)
      assert.equal((signedIn.user as Record<string, unknown>).role, 'host')

      await assert.rejects(
        auth.api.signUpEmail({
          body: {
            email: `${staffId.toLowerCase()}-b@staff.internal`,
            username: `${staffId}-B`,
            password: '123',
            name: 'Too Short',
            role: DEFAULT_STAFF_ROLE,
            staffId: `${staffId}-B`,
            isActive: true,
          },
        }),
        (err: { statusCode?: number; status?: string }) =>
          err.statusCode === 400 || err.status === 'BAD_REQUEST'
      )
    } finally {
      await db.delete(schema.user).where(eq(schema.user.staffId, staffId))
      await db.delete(schema.user).where(eq(schema.user.staffId, `${staffId}-B`))
    }
  })

  // [F1-3]
  test('staff account roles normalize to the canonical staff_role values', () => {
    assert.equal(DEFAULT_STAFF_ROLE, 'host')
    assert.equal(normalizeStaffAccountRole(undefined), 'host')
    assert.equal(normalizeStaffAccountRole('host'), 'host')
    assert.equal(normalizeStaffAccountRole('hostess'), 'host')
    assert.equal(normalizeStaffAccountRole('manager'), 'manager')
    assert.equal(normalizeStaffAccountRole('admin'), null)
    assert.equal(normalizeStaffAccountRole('superuser'), null)
  })

  // [F2-7]
  test('resolveTrustedOrigins resolves configured env origins and excludes localhost in production', () => {
    // Non-production includes dev local origins + configured env origins
    const devOrigins = resolveTrustedOrigins({
      NODE_ENV: 'development',
      BETTER_AUTH_TRUSTED_ORIGINS: 'https://pos.saffron.lb, https://kiosk.saffron.lb/floor/',
      BETTER_AUTH_URL: 'https://auth.saffron.lb/api/auth',
      NEXT_PUBLIC_APP_URL: 'https://app.saffron.lb/',
      VERCEL_URL: 'saffron-preview-123.vercel.app',
    })

    assert.deepEqual(devOrigins, [
      'https://pos.saffron.lb',
      'https://kiosk.saffron.lb',
      'https://auth.saffron.lb',
      'https://app.saffron.lb',
      'https://saffron-preview-123.vercel.app',
      ...DEV_LOCAL_TRUSTED_ORIGINS,
    ])

    // Production excludes localhost/127.0.0.1 defaults unless explicitly configured, deduplicates, and ignores invalid schemes
    const prodOrigins = resolveTrustedOrigins({
      NODE_ENV: 'production',
      BETTER_AUTH_TRUSTED_ORIGINS:
        'https://saffron.lb, https://admin.saffron.lb/settings, https://*.saffron.lb/, javascript:alert(1), not-a-url',
      BETTER_AUTH_URL: 'https://saffron.lb/api/auth',
      NEXT_PUBLIC_APP_URL: 'https://app.saffron.lb',
      VERCEL_URL: 'https://saffron-prod.vercel.app/',
    })

    assert.deepEqual(prodOrigins, [
      'https://saffron.lb',
      'https://admin.saffron.lb',
      'https://*.saffron.lb',
      'https://app.saffron.lb',
      'https://saffron-prod.vercel.app',
    ])
    for (const localOrigin of DEV_LOCAL_TRUSTED_ORIGINS) {
      assert.equal(prodOrigins.includes(localOrigin), false, `Production must not include ${localOrigin}`)
    }
  })
})

after(async () => {
  await (globalThis as { restaurantPool?: Pool }).restaurantPool?.end()
})
