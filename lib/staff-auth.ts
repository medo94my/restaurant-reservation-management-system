import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, restaurantStaffProfiles, staffLoginAttempts } from '@/lib/db'

export type StaffRole = 'manager' | 'hostess'

export function staffAuthUsername(restaurantId: string, staffId: string) {
  const digest = createHash('sha256').update(`${restaurantId}:${staffId.toLowerCase()}`).digest('hex').slice(0, 24)
  return `staff_${digest}`
}

export async function getStaffContext(requestHeaders?: Headers) {
  const session = await auth.api.getSession({ headers: requestHeaders ?? await headers() })
  if (!session?.user) return null

  const [profile] = await db
    .select()
    .from(restaurantStaffProfiles)
    .where(and(
      eq(restaurantStaffProfiles.authUserId, session.user.id),
      eq(restaurantStaffProfiles.active, true),
    ))
    .limit(1)

  if (!profile) return null
  return { session, profile }
}

export type StaffContext = NonNullable<Awaited<ReturnType<typeof getStaffContext>>>

export function isManager(context: Awaited<ReturnType<typeof getStaffContext>>): context is StaffContext {
  return context?.profile.role === 'manager'
}

export function loginThrottleKeys(request: Request, staffId: string) {
  const forwarded = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ipHash = createHash('sha256').update(forwarded).digest('hex')
  const staffHash = createHash('sha256').update(`${staffId.toLowerCase()}\u0000${forwarded}`).digest('hex')
  return [`ip:${ipHash}`, `staff:${staffHash}`]
}

export async function consumeLoginThrottle(key: string) {
  const now = new Date()
  const windowDuration = 15 * 60_000
  await db.insert(staffLoginAttempts)
    .values({ bucketKey: key, attempts: 0, lockoutLevel: 0, windowStartedAt: now, updatedAt: now })
    .onConflictDoNothing()

  return db.transaction(async (transaction) => {
    const [entry] = await transaction.select().from(staffLoginAttempts)
      .where(eq(staffLoginAttempts.bucketKey, key))
      .for('update')
    if (!entry) return false
    if (entry.lockedUntil && entry.lockedUntil.getTime() > now.getTime()) return true

    const windowExpired = entry.windowStartedAt.getTime() <= now.getTime() - windowDuration
    const attempts = windowExpired ? 1 : entry.attempts + 1
    if (attempts >= 6) {
      const lockoutLevel = Math.min(entry.lockoutLevel + 1, 4)
      const lockedUntil = new Date(now.getTime() + 15 * 2 ** (lockoutLevel - 1) * 60_000)
      await transaction.update(staffLoginAttempts).set({
        attempts: 0,
        lockoutLevel,
        windowStartedAt: now,
        lockedUntil,
        updatedAt: now,
      }).where(eq(staffLoginAttempts.bucketKey, key))
      return true
    }

    await transaction.update(staffLoginAttempts).set({
      attempts,
      windowStartedAt: windowExpired ? now : entry.windowStartedAt,
      lockedUntil: null,
      updatedAt: now,
    }).where(eq(staffLoginAttempts.bucketKey, key))
    return false
  })
}

export async function clearLoginThrottle(keys: string[]) {
  if (keys.length) await db.delete(staffLoginAttempts).where(inArray(staffLoginAttempts.bucketKey, keys))
}
