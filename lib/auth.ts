import { betterAuth } from 'better-auth'
import { admin, username } from 'better-auth/plugins'
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

/**
 * Trusted public origin for this deployment (env-derived, never the internal
 * `request.url` behind a proxy). Server-side calls into Better Auth must carry
 * this origin so its trustedOrigins check passes in every environment.
 */
export const baseURL =
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

// The v0 sandbox frames this app cross-origin inside an https iframe, where
// cookies must be SameSite=None; Secure. Everywhere else (localhost dev, the
// iPad hitting a LAN IP, direct Vercel browsing) browsers REJECT that
// combination over plain http — the session cookie is silently dropped after
// sign-in and the user loops back to the login screen forever. Defaults
// (SameSite=Lax, secure derived from the baseURL scheme) are correct there.
const inV0IframePreview = Boolean(
  process.env.V0_RUNTIME_URL
  || process.env.V0_DEV_APP_URL
  || process.env.V0_BUILD_URL
  || process.env.V0_SANDBOX_URL,
)

// Better Auth already trusts the `baseURL` origin on its own. The entries
// below add: the env-derived deployment origins, plus (per request) the
// origin matching the serving Host header — the same rule lib/same-origin.ts
// applies app-wide (the Host header cannot be forged for CSRF). That keeps
// sign-out working from LAN devices (iPad) and Vercel preview hosts without
// enumerating every port and hostname, while a cross-site attacker's Origin
// never matches the serving Host.
function requestHostOrigin(request: Request | undefined): string | undefined {
  const host = request?.headers.get('host')?.toLowerCase().trim()
  if (!request || !host) return undefined

  // Behind a proxy (Vercel, v0) the forwarded header is authoritative; a
  // direct hit (localhost dev, the iPad on a LAN IP) is always plain http.
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const proto = forwardedProto || 'http'
  try {
    return new URL(`${proto}://${host}`).origin
  } catch {
    return undefined
  }
}

export const auth = betterAuth({
  database: pool,
  baseURL,
  trustedOrigins: (request) => [
    ...new Set(isDevelopment ? developmentOrigins : productionOrigins),
    requestHostOrigin(request),
  ].filter((origin): origin is string => Boolean(origin)),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 64,
    requireEmailVerification: false,
  },
  plugins: [
    username({
      displayUsername: false,
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (value) => /^[a-zA-Z0-9._-]{3,30}$/.test(value),
    }),
    admin({
      adminRoles: ['admin'],
      defaultRole: 'user',
      bannedUserMessage: 'This account is inactive. Contact a manager.',
    }),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 8,
    customRules: {
      '/sign-in/username': { window: 60, max: 5 },
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
    },
  },
  ...(inV0IframePreview
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
