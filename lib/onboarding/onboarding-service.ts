import crypto from 'node:crypto'
import { eq, and, gt, inArray } from 'drizzle-orm'
import { db } from '../db.ts'
import { auth, requireManager } from '../auth/auth.ts'
import {
  workspaces,
  user,
  account,
  session,
  restaurantBranding,
  restaurantOperations,
  floorLayouts,
} from '../schema.ts'
import { DEFAULT_FLOOR_ITEMS } from '../restaurant-config.ts'

export interface Step1Data {
  name: string
  description?: string
  phoneNumber: string
  email?: string
  address: string
  country?: string
  timezone?: string
  currency?: string
}

export interface Step2Data {
  managerName: string
  staffId: string
  passcode?: string
  hashedPasscode?: string
}

export interface Step3Data {
  logoUrl?: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  fontFamily: string
  tagline: string
}

export interface Step4Data {
  operatingDays: string[]
  lunchStart: string
  lunchEnd: string
  dinnerStart: string
  dinnerEnd: string
  reservationIntervalMin: number
  turnTimeSmallMin: number
  turnTimeLargeMin: number
}

export interface OnboardingDraftData {
  step1?: Step1Data
  step2?: Omit<Step2Data, 'passcode' | 'hashedPasscode'>
  step3?: Step3Data
  step4?: Step4Data
}

export interface InternalDraftData extends OnboardingDraftData {
  step2?: Step2Data
}

export interface OnboardingStatus {
  isCompleted: boolean
  workspaceId?: string
  workspaceName?: string
  currentStep?: number
  draftData?: OnboardingDraftData
}

export class OnboardingServiceError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'OnboardingServiceError'
    this.statusCode = statusCode
  }
}

function sanitizeDraftData(internalData: InternalDraftData): OnboardingDraftData {
  return {
    step1: internalData.step1,
    step2: internalData.step2
      ? {
          managerName: internalData.step2.managerName,
          staffId: internalData.step2.staffId,
        }
      : undefined,
    step3: internalData.step3,
    step4: internalData.step4,
  }
}

/**
 * Checks whether the restaurant workspace has completed initial onboarding.
 * Strictly read-only — never mutates database state during status checks.
 */
export async function getOnboardingStatus(
  sessionToken?: string
): Promise<OnboardingStatus> {
  // 1. Check for any workspace that has completed onboarding
  const [completedWs] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.isOnboardingCompleted, true))
    .limit(1)

  if (completedWs) {
    // Verify at least one active manager/admin exists
    const [manager] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.role, ['manager', 'admin']), eq(user.isActive, true)))
      .limit(1)

    if (manager) {
      return {
        isCompleted: true,
        workspaceId: completedWs.id,
        workspaceName: completedWs.name,
      }
    }
  }

  // 2. If not completed, check if an active in-flight onboarding session exists
  if (sessionToken) {
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
    const [inFlight] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.isOnboardingCompleted, false),
          eq(workspaces.onboardingSessionToken, tokenHash),
          gt(workspaces.onboardingExpiresAt, new Date())
        )
      )
      .limit(1)

    if (inFlight) {
      const internalData = (inFlight.onboardingData || {}) as InternalDraftData
      return {
        isCompleted: false,
        workspaceId: inFlight.id,
        currentStep: inFlight.onboardingStep,
        draftData: sanitizeDraftData(internalData),
      }
    }
  }

  return {
    isCompleted: false,
    currentStep: 1,
  }
}

/**
 * Initializes or resumes an onboarding session.
 * - Only resumes an existing in-flight draft if the caller presents a valid
 *   non-expired `existingSessionToken` proving ownership of that draft.
 * - Unauthenticated callers (no token or invalid/expired token) get an isolated
 *   new draft workspace without overwriting or reading any other session's draft.
 */
export async function initOnboardingSession(
  existingSessionToken?: string
): Promise<{
  token: string
  workspaceId: string
  currentStep: number
  draftData?: OnboardingDraftData
}> {
  const status = await getOnboardingStatus(existingSessionToken)
  if (status.isCompleted) {
    throw new OnboardingServiceError(
      'Restaurant onboarding has already been completed.',
      403
    )
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours TTL

  // Only resume an existing draft if the caller proves ownership via existingSessionToken
  if (existingSessionToken && typeof existingSessionToken === 'string') {
    const existingTokenHash = crypto
      .createHash('sha256')
      .update(existingSessionToken)
      .digest('hex')

    const [ownedDraft] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.isOnboardingCompleted, false),
          eq(workspaces.onboardingSessionToken, existingTokenHash),
          gt(workspaces.onboardingExpiresAt, new Date())
        )
      )
      .limit(1)

    if (ownedDraft) {
      await db
        .update(workspaces)
        .set({
          onboardingSessionToken: tokenHash,
          onboardingExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, ownedDraft.id))

      const internalData = (ownedDraft.onboardingData || {}) as InternalDraftData
      return {
        token: rawToken,
        workspaceId: ownedDraft.id,
        currentStep: ownedDraft.onboardingStep,
        draftData: sanitizeDraftData(internalData),
      }
    }
  }

  // Create new isolated workspace draft
  const newWorkspaceId = `ws_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const initialDraft: InternalDraftData = {
    step1: {
      name: 'Saffron & Cedar',
      phoneNumber: '+961 1 234 567',
      address: 'Gouraud Street, Gemmayzeh, Beirut',
      country: 'Lebanon',
      timezone: 'Asia/Beirut',
      currency: 'USD',
    },
    step3: {
      primaryColor: '#d7b46a',
      secondaryColor: '#bfa15f',
      backgroundColor: '#111312',
      surfaceColor: '#171a18',
      textColor: '#f4efe6',
      fontFamily: 'Cinzel',
      tagline: 'Beirut Dining Room',
    },
    step4: {
      operatingDays: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      lunchStart: '12:00 PM',
      lunchEnd: '04:30 PM',
      dinnerStart: '06:30 PM',
      dinnerEnd: '11:30 PM',
      reservationIntervalMin: 15,
      turnTimeSmallMin: 90,
      turnTimeLargeMin: 120,
    },
  }

  await db.insert(workspaces).values({
    id: newWorkspaceId,
    name: initialDraft.step1?.name || 'Saffron & Cedar',
    description: 'Levantine dining and culinary excellence.',
    phoneNumber: initialDraft.step1?.phoneNumber,
    address: initialDraft.step1?.address,
    country: 'Lebanon',
    timezone: 'Asia/Beirut',
    currency: 'USD',
    isOnboardingCompleted: false,
    onboardingStep: 1,
    onboardingSessionToken: tokenHash,
    onboardingExpiresAt: expiresAt,
    onboardingData: initialDraft,
  })

  return {
    token: rawToken,
    workspaceId: newWorkspaceId,
    currentStep: 1,
  }
}

/**
 * Saves non-sensitive progress for a specific onboarding step (1..4).
 */
export async function saveOnboardingStep(
  sessionToken: string,
  stepNumber: number,
  payload: Record<string, unknown>
): Promise<{ success: true; currentStep: number; draftData: OnboardingDraftData }> {
  if (!sessionToken) {
    throw new OnboardingServiceError('Missing onboarding session token.', 401)
  }

  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 4) {
    throw new OnboardingServiceError(
      'Invalid step number. Must be between 1 and 4.',
      400
    )
  }

  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.isOnboardingCompleted, false),
        eq(workspaces.onboardingSessionToken, tokenHash),
        gt(workspaces.onboardingExpiresAt, new Date())
      )
    )
    .limit(1)

  if (!workspace) {
    throw new OnboardingServiceError(
      'Onboarding session has expired or is invalid. Please start again.',
      401
    )
  }

  const currentData = (workspace.onboardingData || {}) as InternalDraftData

  if (stepNumber === 1) {
    const { name, phoneNumber, address, country, timezone, currency, email, description } =
      payload as Record<string, unknown>

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new OnboardingServiceError('Restaurant name is required.', 400)
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      throw new OnboardingServiceError('Restaurant phone number is required.', 400)
    }
    if (!address || typeof address !== 'string' || !address.trim()) {
      throw new OnboardingServiceError('Restaurant address is required.', 400)
    }

    currentData.step1 = {
      name: name.trim(),
      phoneNumber: String(phoneNumber).trim(),
      address: address.trim(),
      country: typeof country === 'string' && country.trim() ? country.trim() : 'Lebanon',
      timezone: typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'Asia/Beirut',
      currency: typeof currency === 'string' && currency.trim() ? currency.trim() : 'USD',
      email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
      description:
        typeof description === 'string' && description.trim() ? description.trim() : undefined,
    }
  } else if (stepNumber === 2) {
    const { managerName, staffId, passcode, confirmPasscode } = payload as Record<string, unknown>

    if (!managerName || typeof managerName !== 'string' || !managerName.trim()) {
      throw new OnboardingServiceError('Manager full name is required.', 400)
    }
    if (!staffId || typeof staffId !== 'string' || !staffId.trim()) {
      throw new OnboardingServiceError('Staff ID is required.', 400)
    }

    const cleanStaffId = staffId.trim().toUpperCase()

    // Validate staffId format
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanStaffId)) {
      throw new OnboardingServiceError(
        'Staff ID may only contain letters, numbers, and dashes/underscores.',
        400
      )
    }

    // Check staffId uniqueness
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.staffId, cleanStaffId))
      .limit(1)

    if (existingUser) {
      throw new OnboardingServiceError(
        `Staff ID '${cleanStaffId}' is already registered. Please choose another.`,
        409
      )
    }

    if (passcode !== undefined) {
      if (typeof passcode !== 'string' || passcode.length < 4) {
        throw new OnboardingServiceError('Passcode must be at least 4 characters long.', 400)
      }
      if (confirmPasscode !== undefined && passcode !== confirmPasscode) {
        throw new OnboardingServiceError('Passcode confirmation does not match.', 400)
      }

      // Hash passcode securely using Better Auth password hasher
      const authCtx = await auth.$context
      const hashedPassword = await authCtx.password.hash(passcode)

      currentData.step2 = {
        managerName: managerName.trim(),
        staffId: cleanStaffId,
        hashedPasscode: hashedPassword,
      }
    } else if (currentData.step2?.hashedPasscode) {
      // Retain already hashed passcode
      currentData.step2.managerName = managerName.trim()
      currentData.step2.staffId = cleanStaffId
    } else {
      throw new OnboardingServiceError('Passcode is required.', 400)
    }
  } else if (stepNumber === 3) {
    const {
      logoUrl,
      primaryColor,
      secondaryColor,
      backgroundColor,
      surfaceColor,
      textColor,
      fontFamily,
      tagline,
    } = payload as Record<string, unknown>

    currentData.step3 = {
      logoUrl: typeof logoUrl === 'string' ? logoUrl : '',
      primaryColor:
        typeof primaryColor === 'string' && primaryColor.trim() ? primaryColor.trim() : '#d7b46a',
      secondaryColor:
        typeof secondaryColor === 'string' && secondaryColor.trim()
          ? secondaryColor.trim()
          : '#bfa15f',
      backgroundColor:
        typeof backgroundColor === 'string' && backgroundColor.trim()
          ? backgroundColor.trim()
          : '#111312',
      surfaceColor:
        typeof surfaceColor === 'string' && surfaceColor.trim()
          ? surfaceColor.trim()
          : '#171a18',
      textColor:
        typeof textColor === 'string' && textColor.trim() ? textColor.trim() : '#f4efe6',
      fontFamily:
        typeof fontFamily === 'string' && fontFamily.trim() ? fontFamily.trim() : 'Cinzel',
      tagline: typeof tagline === 'string' && tagline.trim() ? tagline.trim() : 'Dining Room',
    }
  } else if (stepNumber === 4) {
    const {
      operatingDays,
      lunchStart,
      lunchEnd,
      dinnerStart,
      dinnerEnd,
      reservationIntervalMin,
      turnTimeSmallMin,
      turnTimeLargeMin,
    } = payload as Record<string, unknown>

    currentData.step4 = {
      operatingDays: Array.isArray(operatingDays)
        ? operatingDays.map(String)
        : [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
      lunchStart: typeof lunchStart === 'string' ? lunchStart : '12:00 PM',
      lunchEnd: typeof lunchEnd === 'string' ? lunchEnd : '04:30 PM',
      dinnerStart: typeof dinnerStart === 'string' ? dinnerStart : '06:30 PM',
      dinnerEnd: typeof dinnerEnd === 'string' ? dinnerEnd : '11:30 PM',
      reservationIntervalMin: Number(reservationIntervalMin) || 15,
      turnTimeSmallMin: Number(turnTimeSmallMin) || 90,
      turnTimeLargeMin: Number(turnTimeLargeMin) || 120,
    }
  }

  const nextStep = Math.max(workspace.onboardingStep, stepNumber + 1)

  await db
    .update(workspaces)
    .set({
      name: currentData.step1?.name || workspace.name,
      phoneNumber: currentData.step1?.phoneNumber || workspace.phoneNumber,
      address: currentData.step1?.address || workspace.address,
      country: currentData.step1?.country || workspace.country,
      timezone: currentData.step1?.timezone || workspace.timezone,
      currency: currentData.step1?.currency || workspace.currency,
      onboardingStep: nextStep,
      onboardingData: currentData,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id))

  const sanitizedDraft: OnboardingDraftData = {
    step1: currentData.step1,
    step2: currentData.step2
      ? {
          managerName: currentData.step2.managerName,
          staffId: currentData.step2.staffId,
        }
      : undefined,
    step3: currentData.step3,
    step4: currentData.step4,
  }

  return {
    success: true,
    currentStep: nextStep,
    draftData: sanitizedDraft,
  }
}

/**
 * Atomically finalizes onboarding, creates the manager account, establishes
 * branding and operations, and invalidates the setup token.
 */
export async function completeOnboarding(
  sessionToken: string,
  passcodeConfirmation?: string
): Promise<{
  success: true
  workspaceId: string
  userId: string
  staffId: string
  passcodeForAuth: string
}> {
  if (!sessionToken) {
    throw new OnboardingServiceError('Missing onboarding session token.', 401)
  }

  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.isOnboardingCompleted, false),
        eq(workspaces.onboardingSessionToken, tokenHash),
        gt(workspaces.onboardingExpiresAt, new Date())
      )
    )
    .limit(1)

  if (!workspace) {
    throw new OnboardingServiceError(
      'Onboarding session has expired or is invalid. Please start again.',
      401
    )
  }

  const currentData = (workspace.onboardingData || {}) as InternalDraftData

  if (!currentData.step1?.name || !currentData.step1?.phoneNumber) {
    throw new OnboardingServiceError('Incomplete restaurant information (Step 1).', 400)
  }
  if (!currentData.step2?.staffId || !currentData.step2?.managerName) {
    throw new OnboardingServiceError('Incomplete manager account credentials (Step 2).', 400)
  }

  const staffId = currentData.step2.staffId
  const managerName = currentData.step2.managerName
  let hashedPassword = currentData.step2.hashedPasscode

  const authCtx = await auth.$context

  const trimmedConfirmation =
    typeof passcodeConfirmation === 'string' && passcodeConfirmation.trim().length > 0
      ? passcodeConfirmation
      : undefined
  let plaintextForSession = trimmedConfirmation || ''

  if (trimmedConfirmation !== undefined) {
    if (trimmedConfirmation.length < 4) {
      throw new OnboardingServiceError('Passcode must be at least 4 characters long.', 400)
    }
    if (hashedPassword) {
      const matches = await authCtx.password.verify({
        hash: hashedPassword,
        password: trimmedConfirmation,
      })
      if (!matches) {
        throw new OnboardingServiceError(
          'Passcode confirmation does not match the passcode configured in Step 2.',
          400
        )
      }
    } else {
      hashedPassword = await authCtx.password.hash(trimmedConfirmation)
    }
  }

  if (!hashedPassword) {
    throw new OnboardingServiceError('Passcode was not provided or hashed.', 400)
  }

  // Check uniqueness again before transaction commit
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.staffId, staffId))
    .limit(1)

  if (existingUser) {
    throw new OnboardingServiceError(
      `Staff ID '${staffId}' is already registered. Please choose another.`,
      409
    )
  }

  const newUserId = crypto.randomUUID()
  const now = new Date()

  // Execute database transaction
  await db.transaction(async (tx) => {
    // 1. Mark workspace completed
    await tx
      .update(workspaces)
      .set({
        name: currentData.step1!.name,
        description: currentData.step1?.description || null,
        phoneNumber: currentData.step1!.phoneNumber,
        email: currentData.step1?.email || null,
        address: currentData.step1!.address,
        country: currentData.step1?.country || 'Lebanon',
        timezone: currentData.step1?.timezone || 'Asia/Beirut',
        currency: currentData.step1?.currency || 'USD',
        isOnboardingCompleted: true,
        onboardingStep: 5,
        onboardingSessionToken: null,
        onboardingExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(workspaces.id, workspace.id))

    // 2. Insert Manager User in Better Auth tables
    await tx.insert(user).values({
      id: newUserId,
      name: managerName,
      email: `${staffId.toLowerCase()}@staff.internal`,
      emailVerified: true,
      username: staffId,
      displayUsername: staffId,
      role: 'manager', // Server-enforced role
      staffId: staffId,
      isActive: true,
      workspaceId: workspace.id,
      createdAt: now,
      updatedAt: now,
    })

    // 3. Insert Better Auth Account with password
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: newUserId,
      providerId: 'credential',
      userId: newUserId,
      password: hashedPassword!,
      createdAt: now,
      updatedAt: now,
    })

    // 4. Upsert Published Restaurant Branding
    const step3 = currentData.step3
    await tx
      .insert(restaurantBranding)
      .values({
        id: 'default',
        workspaceId: workspace.id,
        restaurantName: currentData.step1!.name,
        tagline: step3?.tagline || 'Beirut Dining Room',
        logoUrl: step3?.logoUrl || '',
        primaryColor: step3?.primaryColor || '#d7b46a',
        secondaryColor: step3?.secondaryColor || '#bfa15f',
        backgroundColor: step3?.backgroundColor || '#111312',
        surfaceColor: step3?.surfaceColor || '#171a18',
        textColor: step3?.textColor || '#f4efe6',
        fontFamily: step3?.fontFamily || 'Cinzel',
        isPublished: true,
        updatedByStaffId: newUserId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: restaurantBranding.id,
        set: {
          workspaceId: workspace.id,
          restaurantName: currentData.step1!.name,
          tagline: step3?.tagline || 'Beirut Dining Room',
          logoUrl: step3?.logoUrl || '',
          primaryColor: step3?.primaryColor || '#d7b46a',
          secondaryColor: step3?.secondaryColor || '#bfa15f',
          backgroundColor: step3?.backgroundColor || '#111312',
          surfaceColor: step3?.surfaceColor || '#171a18',
          textColor: step3?.textColor || '#f4efe6',
          fontFamily: step3?.fontFamily || 'Cinzel',
          isPublished: true,
          updatedByStaffId: newUserId,
          updatedAt: now,
        },
      })

    // 5. Upsert Restaurant Operations
    const step4 = currentData.step4
    await tx
      .insert(restaurantOperations)
      .values({
        id: 'default',
        workspaceId: workspace.id,
        lunchStart: step4?.lunchStart || '12:00 PM',
        lunchEnd: step4?.lunchEnd || '04:30 PM',
        dinnerStart: step4?.dinnerStart || '06:30 PM',
        dinnerEnd: step4?.dinnerEnd || '11:30 PM',
        operatingDays: step4?.operatingDays || [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        reservationIntervalMin: step4?.reservationIntervalMin || 15,
        turnTimeSmallMin: step4?.turnTimeSmallMin || 90,
        turnTimeLargeMin: step4?.turnTimeLargeMin || 120,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: restaurantOperations.id,
        set: {
          workspaceId: workspace.id,
          lunchStart: step4?.lunchStart || '12:00 PM',
          lunchEnd: step4?.lunchEnd || '04:30 PM',
          dinnerStart: step4?.dinnerStart || '06:30 PM',
          dinnerEnd: step4?.dinnerEnd || '11:30 PM',
          operatingDays: step4?.operatingDays || [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          reservationIntervalMin: step4?.reservationIntervalMin || 15,
          turnTimeSmallMin: step4?.turnTimeSmallMin || 90,
          turnTimeLargeMin: step4?.turnTimeLargeMin || 120,
          updatedAt: now,
        },
      })

    // 6. Seed starter floor layout if not present
    const [existingFloor] = await tx
      .select({ id: floorLayouts.id })
      .from(floorLayouts)
      .where(eq(floorLayouts.id, 'default'))
      .limit(1)

    if (!existingFloor) {
      await tx.insert(floorLayouts).values({
        id: 'default',
        name: 'Main Dining Room',
        layoutItems: DEFAULT_FLOOR_ITEMS,
        updatedByStaffId: newUserId as unknown as string,
        updatedAt: now,
      })
    }
  })

  return {
    success: true,
    workspaceId: workspace.id,
    userId: newUserId,
    staffId,
    passcodeForAuth: plaintextForSession,
  }
}

/**
 * Establishes an authenticated Better Auth session for the newly created manager
 * upon completing onboarding. Works both when the client provides `passcodeForAuth`
 * and when resuming at Steps 3-5 where only the Step 2 hash was stored.
 */
export async function establishOnboardingManagerSession(result: {
  userId: string
  staffId: string
  passcodeForAuth: string
}): Promise<{ sessionEstablished: boolean; setCookieHeaders: string[] }> {
  const setCookieHeaders: string[] = []
  let sessionEstablished = false

  if (result.passcodeForAuth) {
    try {
      const authRes = await auth.api.signInUsername({
        body: {
          username: result.staffId,
          password: result.passcodeForAuth,
        },
        asResponse: true,
      })

      const cookiesFromAuth = authRes.headers.getSetCookie?.() || []
      for (const cookieStr of cookiesFromAuth) {
        setCookieHeaders.push(cookieStr)
      }
      sessionEstablished = setCookieHeaders.length > 0
    } catch (authErr) {
      console.warn('Auto-login session generation warning:', authErr)
    }
  }

  if (!sessionEstablished && result.userId) {
    try {
      const ctx = await auth.$context
      const createdSession = await ctx.internalAdapter.createSession(result.userId)
      if (createdSession) {
        const signature = crypto
          .createHmac('sha256', ctx.secret)
          .update(createdSession.token)
          .digest('base64')
        const signedValue = `${createdSession.token}.${encodeURIComponent(signature)}`
        const cookieCfg = ctx.authCookies.sessionToken
        const maxAge = cookieCfg.attributes.maxAge || 30 * 24 * 60 * 60
        const path = cookieCfg.attributes.path || '/'
        const secureFlag = cookieCfg.attributes.secure ? '; Secure' : ''
        setCookieHeaders.push(
          `${cookieCfg.name}=${signedValue}; Max-Age=${maxAge}; Path=${path}; HttpOnly; SameSite=Lax${secureFlag}`
        )
        sessionEstablished = true
      }
    } catch (sessionErr) {
      console.warn('Resumed session creation warning:', sessionErr)
    }
  }

  return { sessionEstablished, setCookieHeaders }
}

/**
 * Resets all onboarding-related tables cleanly in non-production environments.
 * Requires an authenticated manager/admin session so unauthenticated or non-manager
 * callers cannot wipe workspace state.
 */
export async function resetOnboardingDemo(
  customHeaders?: Headers,
  env: Record<string, string | undefined> = process.env,
  executor: Pick<typeof db, 'transaction'> = db
): Promise<{ success: true }> {
  if (env.NODE_ENV === 'production') {
    throw new OnboardingServiceError('Not available in production', 403)
  }

  await requireManager(customHeaders)

  await executor.transaction(async (tx) => {
    await tx.delete(session)
    await tx.delete(account)
    await tx.delete(user)
    await tx.delete(restaurantOperations)
    await tx.delete(restaurantBranding)
    await tx.delete(floorLayouts)
    await tx.delete(workspaces)
  })

  return { success: true }
}
