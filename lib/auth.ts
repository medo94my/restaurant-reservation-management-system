import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

function getOrigin(value?: string) {
  if (!value) return undefined

  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).origin
  } catch {
    return undefined
  }
}

const isDevelopment = process.env.NODE_ENV === 'development'
const baseURL =
  getOrigin(process.env.BETTER_AUTH_URL) ??
  getOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  getOrigin(process.env.VERCEL_URL) ??
  getOrigin(process.env.V0_RUNTIME_URL) ??
  'http://localhost:3000'

const developmentOrigins = [
  'http://localhost:3000',
  process.env.V0_RUNTIME_URL,
  process.env.V0_DEV_APP_URL,
  process.env.V0_BUILD_URL,
  process.env.V0_SANDBOX_URL,
]
  .map(getOrigin)
  .filter((origin): origin is string => Boolean(origin))

const productionOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
]
  .map(getOrigin)
  .filter((origin): origin is string => Boolean(origin))

export const auth = betterAuth({
  database: pool,
  baseURL,
  trustedOrigins: [...new Set(isDevelopment ? developmentOrigins : productionOrigins)],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: false,
  },
  ...(isDevelopment
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
