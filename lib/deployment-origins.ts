/**
 * v0 sandbox origin variables — set only when this app is deployed inside a
 * v0 https iframe preview. This is the single list both lib/auth.ts (cookie
 * attributes, trusted origins, baseURL fallback) and lib/same-origin.ts
 * (trusted hosts) derive from, so adding a new v0 variable is a one-line
 * change here instead of three scattered edits.
 */
const V0_SANDBOX_VARS = ['V0_RUNTIME_URL', 'V0_DEV_APP_URL', 'V0_BUILD_URL', 'V0_SANDBOX_URL'] as const

/** Raw values of the v0 sandbox origin variables (entries are undefined when unset). */
export function v0OriginValues(): (string | undefined)[] {
  return V0_SANDBOX_VARS.map((name) => process.env[name])
}

/** True only inside a v0 https iframe preview deployment. */
export function inV0IframePreview(): boolean {
  return v0OriginValues().some((value) => Boolean(value))
}
