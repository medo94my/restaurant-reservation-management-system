/**
 * Origin matching the serving Host header — the same rule lib/same-origin.ts
 * applies app-wide (the Host header cannot be forged for CSRF).
 *
 * Better Auth invokes the `trustedOrigins` callback with the incoming request,
 * but some internal paths call it with `undefined`; this helper must tolerate
 * both (an unguarded `request.headers` once crashed every sign-in with an
 * unhandled rejection).
 */
export function requestHostOrigin(request: Request | undefined): string | undefined {
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
