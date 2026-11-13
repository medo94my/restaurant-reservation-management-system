function firstHeader(value: string | null) {
  const first = value?.split(',')[0]?.trim()
  return first || undefined
}

function hostFrom(value?: string) {
  if (!value) return undefined
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).host
  } catch {
    return undefined
  }
}

/** Hostnames the app itself is served from (deployment env + local dev). */
function trustedHosts() {
  return new Set(
    [
      process.env.BETTER_AUTH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_URL,
      process.env.V0_RUNTIME_URL,
      process.env.V0_DEV_APP_URL,
      process.env.V0_BUILD_URL,
      process.env.V0_SANDBOX_URL,
      'http://localhost:3000',
    ]
      .map(hostFrom)
      .filter((host): host is string => Boolean(host)),
  )
}

/**
 * Origins a same-origin browser request may carry.
 *
 * `new URL(request.url).origin` alone is unreliable behind the V0/Vercel
 * proxy: the internal request URL can report a different scheme or host than
 * the public origin the browser sends. The `Host` header is browser-controlled
 * (a page JS cannot forge it), so it is safe to trust for CSRF checks;
 * `x-forwarded-host` is only trusted when it matches `Host` or a known
 * deployment origin.
 */
export function allowedOrigins(request: Request) {
  const origins = new Set<string>()
  const add = (value?: string) => {
    if (!value) return
    try {
      origins.add(new URL(value).origin)
    } catch {
      // ignore malformed values
    }
  }

  try {
    add(new URL(request.url).origin)
  } catch {
    // ignore malformed request URL
  }

  const host = request.headers.get('host') ?? undefined
  const scheme = firstHeader(request.headers.get('x-forwarded-proto')) ?? 'https'
  if (host) {
    add(`${scheme}://${host}`)
    add(`https://${host}`)
    add(`http://${host}`)
  }

  const forwardedHost = firstHeader(request.headers.get('x-forwarded-host'))
  const trusted = trustedHosts()
  if (forwardedHost && (forwardedHost === host || trusted.has(forwardedHost))) {
    add(`${scheme}://${forwardedHost}`)
    add(`https://${forwardedHost}`)
    add(`http://${forwardedHost}`)
  }

  for (const candidate of trusted) add(`https://${candidate}`)

  return origins
}

/** True when the request's Origin header belongs to this app. */
export function isSameOrigin(request: Request) {
  const origin = firstHeader(request.headers.get('origin'))
  if (!origin || origin === 'null') return false
  return allowedOrigins(request).has(origin)
}
