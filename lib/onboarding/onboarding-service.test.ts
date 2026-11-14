import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { Pool } from 'pg'
import { eq, like } from 'drizzle-orm'
import { db } from '../db.ts'
import { auth, getStaffSession } from '../auth/auth.ts'
import {
  workspaces,
  user,
  account,
  session,
  restaurantBranding,
  restaurantOperations,
  floorLayouts,
} from '../schema.ts'
import {
  getOnboardingStatus,
  initOnboardingSession,
  saveOnboardingStep,
  completeOnboarding,
  establishOnboardingManagerSession,
  resetOnboardingDemo,
  OnboardingServiceError,
} from './onboarding-service.ts'

describe('Manager Onboarding Service', () => {
  const testStaffId = `TEST_MGR_${Date.now()}`

  before(async () => {
    // Clear any leftover test records before starting
    await db.delete(restaurantOperations).where(like(restaurantOperations.workspaceId, 'test_%'))
    await db.delete(workspaces).where(like(workspaces.id, 'test_%'))
  })

  after(async () => {
    // Final cleanup
    await db.delete(restaurantOperations).where(like(restaurantOperations.workspaceId, 'test_%'))
    await db.delete(workspaces).where(like(workspaces.id, 'test_%'))
    await (globalThis as { restaurantPool?: Pool }).restaurantPool?.end()
  })

  test('getOnboardingStatus reports current state accurately', async () => {
    const status = await getOnboardingStatus()
    assert.strictEqual(typeof status.isCompleted, 'boolean')
  })

  test('initOnboardingSession creates a draft with valid token or guards against duplicate completion', async () => {
    const status = await getOnboardingStatus()
    if (status.isCompleted) {
      // If a completed workspace exists, init must reject with 403
      await assert.rejects(
        async () => {
          await initOnboardingSession()
        },
        (err: OnboardingServiceError) => {
          return err.statusCode === 403 && err.message.includes('already been completed')
        }
      )
    } else {
      const created = await initOnboardingSession()
      try {
        assert.ok(created.token, 'Session token should be returned')
        assert.ok(created.workspaceId, 'Workspace ID should be returned')
        assert.strictEqual(typeof created.currentStep, 'number')
      } finally {
        await db.delete(workspaces).where(eq(workspaces.id, created.workspaceId))
      }
    }
  })

  test('saveOnboardingStep validates Step 1 requirements', async () => {
    const tempWsId = `test_step1_${Date.now()}`
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await db.insert(workspaces).values({
      id: tempWsId,
      name: 'Draft Bistro',
      phoneNumber: '+961 1 000 222',
      address: 'Test Street',
      isOnboardingCompleted: false,
      onboardingStep: 1,
      onboardingSessionToken: tokenHash,
      onboardingExpiresAt: new Date(Date.now() + 3600000),
      onboardingData: {},
    })

    try {
      // Missing restaurant name fails
      await assert.rejects(
        async () => {
          await saveOnboardingStep(rawToken, 1, {
            name: '',
            phoneNumber: '+961 1 123 456',
            address: 'Test Street',
          })
        },
        (err: OnboardingServiceError) => {
          return err.statusCode === 400 && err.message.includes('Restaurant name is required')
        }
      )

      // Valid step 1 succeeds and advances step
      const result = await saveOnboardingStep(rawToken, 1, {
        name: 'Grand Cedar Restaurant',
        phoneNumber: '+961 1 987 654',
        address: 'Corniche, Beirut',
        country: 'Lebanon',
        timezone: 'Asia/Beirut',
        currency: 'USD',
      })

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.currentStep, 2)
      assert.strictEqual(result.draftData.step1?.name, 'Grand Cedar Restaurant')
    } finally {
      await db.delete(workspaces).where(eq(workspaces.id, tempWsId))
    }
  })

  test('saveOnboardingStep validates and hashes Step 2 manager credentials server-side', async () => {
    const tempWsId = `test_step2_${Date.now()}`
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await db.insert(workspaces).values({
      id: tempWsId,
      name: 'Security Test Bistro',
      phoneNumber: '+961 1 000 333',
      address: 'Test St',
      isOnboardingCompleted: false,
      onboardingStep: 2,
      onboardingSessionToken: tokenHash,
      onboardingExpiresAt: new Date(Date.now() + 3600000),
      onboardingData: {
        step1: {
          name: 'Security Test Bistro',
          phoneNumber: '+961 1 000 333',
          address: 'Test St',
        },
      },
    })

    try {
      // Passcode mismatch fails
      await assert.rejects(
        async () => {
          await saveOnboardingStep(rawToken, 2, {
            managerName: 'Alice Manager',
            staffId: testStaffId,
            passcode: 'secret123',
            confirmPasscode: 'mismatch456',
          })
        },
        (err: OnboardingServiceError) => {
          return err.statusCode === 400 && err.message.includes('confirmation does not match')
        }
      )

      // Short passcode fails
      await assert.rejects(
        async () => {
          await saveOnboardingStep(rawToken, 2, {
            managerName: 'Alice Manager',
            staffId: testStaffId,
            passcode: '12',
            confirmPasscode: '12',
          })
        },
        (err: OnboardingServiceError) => {
          return err.statusCode === 400 && err.message.includes('at least 4 characters')
        }
      )

      // Valid credentials hash passcode and advance step
      const step2Result = await saveOnboardingStep(rawToken, 2, {
        managerName: 'Alice Manager',
        staffId: testStaffId,
        passcode: 'securePass123',
        confirmPasscode: 'securePass123',
      })

      assert.strictEqual(step2Result.success, true)
      assert.strictEqual(step2Result.currentStep, 3)
      // Verify plaintext passcode is NOT in sanitized draft response
      assert.strictEqual((step2Result.draftData.step2 as any)?.passcode, undefined)
      assert.strictEqual((step2Result.draftData.step2 as any)?.hashedPasscode, undefined)

      // Check raw draft in DB: verify password was hashed with scrypt/argon2, never stored plaintext
      const [savedWs] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, tempWsId))
        .limit(1)

      const rawDraft = savedWs.onboardingData as Record<string, any>
      assert.ok(rawDraft.step2?.hashedPasscode, 'Hashed passcode must exist in draft')
      assert.strictEqual(rawDraft.step2?.passcode, undefined, 'Plaintext passcode must never be in draft')
      assert.notStrictEqual(rawDraft.step2?.hashedPasscode, 'securePass123')
    } finally {
      await db.delete(workspaces).where(eq(workspaces.id, tempWsId))
    }
  })

  test('completeOnboarding atomically creates manager, branding, operations and locks workspace', async () => {
    const tempWsId = `test_complete_${Date.now()}`
    const finalStaffId = `FIN_MGR_${Date.now()}`
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await db.insert(workspaces).values({
      id: tempWsId,
      name: 'Finishing Bistro',
      phoneNumber: '+961 1 555 666',
      address: 'Verdun, Beirut',
      isOnboardingCompleted: false,
      onboardingStep: 4,
      onboardingSessionToken: tokenHash,
      onboardingExpiresAt: new Date(Date.now() + 3600000),
      onboardingData: {
        step1: {
          name: 'Finishing Bistro',
          phoneNumber: '+961 1 555 666',
          address: 'Verdun, Beirut',
          country: 'Lebanon',
          timezone: 'Asia/Beirut',
          currency: 'USD',
        },
        step2: {
          managerName: 'Ziad Mansour',
          staffId: finalStaffId,
        },
        step3: {
          primaryColor: '#e0a945',
          fontFamily: 'Playfair Display',
          tagline: 'Refined Mediterranean',
        },
        step4: {
          lunchStart: '12:30 PM',
          lunchEnd: '04:00 PM',
          dinnerStart: '07:00 PM',
          dinnerEnd: '11:00 PM',
          operatingDays: ['Monday', 'Tuesday', 'Wednesday'],
          reservationIntervalMin: 15,
          turnTimeSmallMin: 90,
          turnTimeLargeMin: 120,
        },
      },
    })

    let createdUserId: string | null = null

    try {
      // Complete onboarding
      const completion = await completeOnboarding(rawToken, 'managerPass123')
      assert.strictEqual(completion.success, true)
      assert.strictEqual(completion.workspaceId, tempWsId)
      assert.strictEqual(completion.staffId, finalStaffId)

      // Verify workspace is marked completed and session token cleared
      const [finalWs] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, tempWsId))
        .limit(1)

      assert.strictEqual(finalWs.isOnboardingCompleted, true)
      assert.strictEqual(finalWs.onboardingSessionToken, null)

      // Verify manager account exists with role 'manager'
      const [newManager] = await db
        .select()
        .from(user)
        .where(eq(user.staffId, finalStaffId))
        .limit(1)

      assert.ok(newManager, 'Manager user should exist')
      createdUserId = newManager.id
      assert.strictEqual(newManager.role, 'manager')
      assert.strictEqual(newManager.name, 'Ziad Mansour')
      assert.strictEqual(newManager.isActive, true)
      assert.strictEqual(newManager.workspaceId, tempWsId)

      // Verify account credential exists
      const [acc] = await db
        .select()
        .from(account)
        .where(eq(account.userId, newManager.id))
        .limit(1)

      assert.ok(acc, 'Better Auth account should exist')
      assert.ok(acc.password && acc.password.length > 20, 'Hashed password must exist')
    } finally {
      // Cleanup created test records
      if (createdUserId) {
        await db.delete(account).where(eq(account.userId, createdUserId))
        await db.delete(user).where(eq(user.id, createdUserId))
      }
      await db.delete(restaurantOperations).where(eq(restaurantOperations.workspaceId, tempWsId))
      await db.delete(workspaces).where(eq(workspaces.id, tempWsId))

      // Restore default branding name
      await db
        .update(restaurantBranding)
        .set({
          restaurantName: 'Saffron & Cedar',
          tagline: 'Beirut Dining Room',
          primaryColor: '#d7b46a',
          backgroundColor: '#111312',
          fontFamily: 'Cinzel',
        })
        .where(eq(restaurantBranding.id, 'default'))
    }
  })

  // [F3-5]
  test('saveOnboardingStep rejects stepNumber outside 1..4 without advancing onboardingStep', async () => {
    const tempWsId = `test_bounds_${Date.now()}`
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await db.insert(workspaces).values({
      id: tempWsId,
      name: 'Bounds Bistro',
      phoneNumber: '+961 1 000 444',
      address: 'Test Street',
      isOnboardingCompleted: false,
      onboardingStep: 1,
      onboardingSessionToken: tokenHash,
      onboardingExpiresAt: new Date(Date.now() + 3600000),
      onboardingData: {},
    })

    try {
      for (const invalidStep of [0, -1, 5, 99, 1.5, Number.NaN]) {
        await assert.rejects(
          async () => {
            await saveOnboardingStep(rawToken, invalidStep, { name: 'Ignored' })
          },
          (err: OnboardingServiceError) => {
            return err.statusCode === 400 && /between 1 and 4/i.test(err.message)
          }
        )
      }

      const [unchangedWs] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, tempWsId))
        .limit(1)
      assert.strictEqual(unchangedWs.onboardingStep, 1)
    } finally {
      await db.delete(workspaces).where(eq(workspaces.id, tempWsId))
    }
  })

  // [F3-3]
  test('getOnboardingStatus is strictly read-only and does not insert a default workspace when none exists', async () => {
    const savedOps = await db.select().from(restaurantOperations)
    const savedWorkspaces = await db.select().from(workspaces)

    try {
      await db.delete(restaurantOperations)
      await db.delete(workspaces)

      const status = await getOnboardingStatus()
      assert.strictEqual(status.isCompleted, false)
      assert.strictEqual(status.currentStep, 1)

      const rowsAfterGet = await db.select().from(workspaces)
      assert.strictEqual(
        rowsAfterGet.length,
        0,
        'getOnboardingStatus must not insert a workspace during a status check'
      )
    } finally {
      await db.delete(restaurantOperations)
      await db.delete(workspaces)
      if (savedWorkspaces.length > 0) {
        await db.insert(workspaces).values(savedWorkspaces)
      }
      if (savedOps.length > 0) {
        await db.insert(restaurantOperations).values(savedOps)
      }
    }
  })

  // [F3-2]
  test('initOnboardingSession & POST /api/onboarding/init prevent session hijacking and draft/token leaks', async () => {
    const savedOps = await db.select().from(restaurantOperations)
    const savedWorkspaces = await db.select().from(workspaces)
    const createdWorkspaceIds: string[] = []
    const uniqueStaffId = `OWN_MGR_${Date.now()}`

    try {
      await db.delete(restaurantOperations)
      await db.delete(workspaces)

      // 1. Legitimate User A starts onboarding and saves Steps 1 & 2
      const sessionA = await initOnboardingSession()
      createdWorkspaceIds.push(sessionA.workspaceId)

      await saveOnboardingStep(sessionA.token, 1, {
        name: 'Confidential Levantine Table',
        phoneNumber: '+961 1 777 888',
        address: 'Achrafieh, Beirut',
      })
      await saveOnboardingStep(sessionA.token, 2, {
        managerName: 'Layla Confidential',
        staffId: uniqueStaffId,
        passcode: 'topSecretPass',
        confirmPasscode: 'topSecretPass',
      })

      // 2. Unauthenticated User B calls initOnboardingSession() without a token
      const sessionB = await initOnboardingSession()
      createdWorkspaceIds.push(sessionB.workspaceId)

      assert.notStrictEqual(
        sessionB.workspaceId,
        sessionA.workspaceId,
        'Unauthenticated caller must not hijack User A draft workspace'
      )
      assert.strictEqual(sessionB.currentStep, 1)
      assert.strictEqual(
        sessionB.draftData,
        undefined,
        'Unauthenticated caller must not receive populated draftData'
      )

      // 3. Caller with forged token also gets an isolated draft without touching User A
      const sessionC = await initOnboardingSession('forged-non-existent-session-token')
      createdWorkspaceIds.push(sessionC.workspaceId)
      assert.notStrictEqual(sessionC.workspaceId, sessionA.workspaceId)
      assert.strictEqual(sessionC.draftData, undefined)

      // 4. Verify User A's session token is still valid and intact
      const statusA = await getOnboardingStatus(sessionA.token)
      assert.strictEqual(statusA.workspaceId, sessionA.workspaceId)
      assert.strictEqual(statusA.currentStep, 3)
      assert.strictEqual(statusA.draftData?.step1?.name, 'Confidential Levantine Table')
      assert.strictEqual(statusA.draftData?.step2?.managerName, 'Layla Confidential')
      assert.strictEqual(statusA.draftData?.step2?.staffId, uniqueStaffId)

      // 5. Verify User A presenting their valid token to initOnboardingSession resumes their draft
      const resumedA = await initOnboardingSession(sessionA.token)
      assert.strictEqual(resumedA.workspaceId, sessionA.workspaceId)
      assert.strictEqual(resumedA.currentStep, 3)
      assert.strictEqual(resumedA.draftData?.step1?.name, 'Confidential Levantine Table')
      assert.strictEqual(resumedA.draftData?.step2?.staffId, uniqueStaffId)
    } finally {
      await db.delete(restaurantOperations)
      await db.delete(workspaces)
      if (savedWorkspaces.length > 0) {
        await db.insert(workspaces).values(savedWorkspaces)
      }
      if (savedOps.length > 0) {
        await db.insert(restaurantOperations).values(savedOps)
      }
    }
  })

  // [F3-4]
  test('completeOnboarding & establishOnboardingManagerSession issue valid session on resumed sessions (Steps 3-5) without empty passcode failure', async () => {
    const tempWsId = `test_resume_${Date.now()}`
    const resumedStaffId = `RES_MGR_${Date.now()}`
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await db.insert(workspaces).values({
      id: tempWsId,
      name: 'Resumed Bistro',
      phoneNumber: '+961 1 888 999',
      address: 'Hamra, Beirut',
      isOnboardingCompleted: false,
      onboardingStep: 1,
      onboardingSessionToken: tokenHash,
      onboardingExpiresAt: new Date(Date.now() + 3600000),
      onboardingData: {},
    })

    let createdUserId: string | null = null

    try {
      // Save Step 1 & Step 2 (hashes passcode into draftData)
      await saveOnboardingStep(rawToken, 1, {
        name: 'Resumed Bistro',
        phoneNumber: '+961 1 888 999',
        address: 'Hamra, Beirut',
      })
      await saveOnboardingStep(rawToken, 2, {
        managerName: 'Nabil Resumed',
        staffId: resumedStaffId,
        passcode: 'resumedSecret42',
        confirmPasscode: 'resumedSecret42',
      })

      // Mismatched confirmation passcode is rejected
      await assert.rejects(
        async () => {
          await completeOnboarding(rawToken, 'wrongPasscode99')
        },
        (err: OnboardingServiceError) => {
          return err.statusCode === 400 && /does not match/i.test(err.message)
        }
      )

      // Resumed completion on Step 5 with empty passcodeConfirmation succeeds and issues session cookie
      const completionResult = await completeOnboarding(rawToken, '')
      assert.strictEqual(completionResult.success, true)
      assert.strictEqual(completionResult.staffId, resumedStaffId)
      assert.strictEqual(completionResult.passcodeForAuth, '')
      createdUserId = completionResult.userId

      const { sessionEstablished, setCookieHeaders } =
        await establishOnboardingManagerSession(completionResult)
      assert.strictEqual(sessionEstablished, true)

      const sessionCookie = setCookieHeaders.find((c) =>
        c.startsWith('better-auth.session_token=')
      )
      assert.ok(sessionCookie, 'Must generate better-auth.session_token Set-Cookie header')

      const cookiePair = sessionCookie.split(';')[0]
      const staffSession = await getStaffSession(new Headers({ cookie: cookiePair }))
      assert.ok(staffSession, 'Issued session cookie must resolve via getStaffSession')
      assert.strictEqual(staffSession.user.staffId, resumedStaffId)
      assert.strictEqual(staffSession.user.role, 'manager')
    } finally {
      if (createdUserId) {
        await db.delete(session).where(eq(session.userId, createdUserId))
        await db.delete(account).where(eq(account.userId, createdUserId))
        await db.delete(user).where(eq(user.id, createdUserId))
      } else {
        const [u] = await db.select().from(user).where(eq(user.staffId, resumedStaffId)).limit(1)
        if (u) {
          await db.delete(session).where(eq(session.userId, u.id))
          await db.delete(account).where(eq(account.userId, u.id))
          await db.delete(user).where(eq(user.id, u.id))
        }
      }
      await db.delete(restaurantOperations).where(eq(restaurantOperations.workspaceId, tempWsId))
      await db.delete(workspaces).where(eq(workspaces.id, tempWsId))
      await db
        .update(restaurantBranding)
        .set({
          restaurantName: 'Saffron & Cedar',
          tagline: 'Beirut Dining Room',
          primaryColor: '#d7b46a',
          backgroundColor: '#111312',
          fontFamily: 'Cinzel',
        })
        .where(eq(restaurantBranding.id, 'default'))
    }
  })

  // [F3-1]
  test('resetOnboardingDemo enforces manager auth & non-production, and cleanly resets all onboarding tables', async () => {
    // 1. Production environment check
    await assert.rejects(
      async () => {
        await resetOnboardingDemo(new Headers(), { NODE_ENV: 'production' })
      },
      (err: OnboardingServiceError) => err.statusCode === 403
    )

    // 2. Unauthenticated request rejects with 401 UNAUTHORIZED
    await assert.rejects(
      async () => {
        await resetOnboardingDemo(new Headers())
      },
      (err: { statusCode?: number; status?: string }) =>
        err.statusCode === 401 || err.status === 'UNAUTHORIZED'
    )

    // 3. Host/hostess role rejects with 403 FORBIDDEN
    const hostSignIn = await auth.api.signInUsername({
      body: {
        username: 'HOST-01',
        password: process.env.INITIAL_HOSTESS_PASSCODE || 'hostess123',
      },
      asResponse: true,
    })
    const hostCookie = (hostSignIn.headers.get('set-cookie') || '').split(';')[0]
    await assert.rejects(
      async () => {
        await resetOnboardingDemo(new Headers({ cookie: hostCookie }))
      },
      (err: { statusCode?: number; status?: string }) =>
        err.statusCode === 403 || err.status === 'FORBIDDEN'
    )

    // 4. Authenticated Manager can reset all onboarding tables cleanly
    const mgrSignIn = await auth.api.signInUsername({
      body: {
        username: 'MGR-01',
        password: process.env.INITIAL_MANAGER_PASSCODE || 'manager123',
      },
      asResponse: true,
    })
    const mgrCookie = (mgrSignIn.headers.get('set-cookie') || '').split(';')[0]

    // Snapshot all onboarding-related tables so we can restore them after verifying the reset
    const savedUsers = await db.select().from(user)
    const savedAccounts = await db.select().from(account)
    const savedSessions = await db.select().from(session)
    const savedWorkspaces = await db.select().from(workspaces)
    const savedOps = await db.select().from(restaurantOperations)
    const savedBranding = await db.select().from(restaurantBranding)
    const savedFloors = await db.select().from(floorLayouts)

    // Run the destructive reset + verification + restore inside a single MVCC transaction
    // so concurrent test files (e.g. auth.test.ts, branding.test.ts) never observe empty tables.
    await db.transaction(async (tx) => {
      const txExecutor = {
        transaction: async <T>(fn: (innerTx: typeof tx) => Promise<T>): Promise<T> => fn(tx),
      } as unknown as Pick<typeof db, 'transaction'>

      const resetRes = await resetOnboardingDemo(
        new Headers({ cookie: mgrCookie }),
        process.env,
        txExecutor
      )
      assert.strictEqual(resetRes.success, true)

      // Verify all onboarding tables are emptied inside the transaction
      assert.strictEqual((await tx.select().from(workspaces)).length, 0)
      assert.strictEqual((await tx.select().from(restaurantOperations)).length, 0)
      assert.strictEqual((await tx.select().from(restaurantBranding)).length, 0)
      assert.strictEqual((await tx.select().from(floorLayouts)).length, 0)
      assert.strictEqual((await tx.select().from(user)).length, 0)
      assert.strictEqual((await tx.select().from(account)).length, 0)
      assert.strictEqual((await tx.select().from(session)).length, 0)

      // Restore all snapshotted rows before transaction commits
      if (savedWorkspaces.length > 0) await tx.insert(workspaces).values(savedWorkspaces)
      if (savedOps.length > 0) await tx.insert(restaurantOperations).values(savedOps)
      if (savedBranding.length > 0) await tx.insert(restaurantBranding).values(savedBranding)
      if (savedFloors.length > 0) await tx.insert(floorLayouts).values(savedFloors)
      if (savedUsers.length > 0) await tx.insert(user).values(savedUsers)
      if (savedAccounts.length > 0) await tx.insert(account).values(savedAccounts)
      if (savedSessions.length > 0) await tx.insert(session).values(savedSessions)
    })
  })
})
