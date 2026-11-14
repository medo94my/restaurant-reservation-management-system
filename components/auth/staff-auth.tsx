'use client'

import { useState, type FormEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

type StaffProfileSummary = { name: string; staffId: string; role: string }

export function StaffEntry() {
  const router = useRouter()
  const [staffId, setStaffId] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staffId.trim(), passcode }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to sign in. Check your staff ID and passcode.')
      }
      router.push('/')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="staff-entry">
      <section className="staff-entry-card" aria-labelledby="staff-entry-title">
        <div className="staff-entry-brand">
          <div className="staff-entry-mark" aria-hidden="true">S</div>
          <div>
            <p className="staff-entry-overline">SAFFRON &amp; CEDAR</p>
            <p className="staff-entry-location">BEIRUT · DINING ROOM</p>
          </div>
        </div>
        <div className="staff-entry-copy">
          <p className="staff-entry-kicker">RESTAURANT OPERATIONS</p>
          <h1 id="staff-entry-title">Welcome back.</h1>
          <p>Sign in with your staff ID to open the right workspace for your role.</p>
        </div>
        <form className="staff-entry-form" onSubmit={handleSubmit}>
          <label>
            <span>Staff ID</span>
            <input autoComplete="username" required minLength={3} maxLength={30} value={staffId} onChange={(event) => setStaffId(event.target.value.toLowerCase())} />
          </label>
          <label>
            <span>Passcode</span>
            <input autoComplete="current-password" type="password" required minLength={8} maxLength={64} value={passcode} onChange={(event) => setPasscode(event.target.value)} />
          </label>
          {error && <p className="staff-entry-error" role="alert">{error}</p>}
          <button className="staff-entry-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="staff-entry-security">Staff accounts are created and managed by a restaurant manager.</p>
      </section>
      <style jsx global>{`
        .staff-entry{min-height:100vh;display:grid;place-items:center;padding:32px 20px;background:radial-gradient(ellipse at 15% 20%,rgba(186,145,79,.17),transparent 34%),linear-gradient(135deg,#111713,#1c241e 58%,#131914);color:#f4f0e7;font-family:var(--font-dm-sans),sans-serif}
        .staff-entry-card{width:min(100%,460px);padding:clamp(28px,6vw,52px);border:1px solid rgba(226,211,179,.18);border-radius:24px;background:rgba(24,31,26,.94);box-shadow:0 28px 80px rgba(0,0,0,.35)}
        .staff-entry-brand{display:flex;align-items:center;gap:13px;margin-bottom:48px}
        .staff-entry-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:#bd9660;color:#1d241e;font-family:var(--font-playfair),Georgia,serif;font-size:1.5625rem;font-weight:700}
        .staff-entry-overline,.staff-entry-location,.staff-entry-kicker{margin:0;font-size:0.625rem;letter-spacing:.17em;font-weight:700}
        .staff-entry-overline{color:#f4efe4}.staff-entry-location{margin-top:5px;color:#aab1a7;font-size:0.625rem;letter-spacing:.12em}
        .staff-entry-kicker{color:#c7a16b}
        .staff-entry-copy h1{margin:12px 0 8px;font-family:var(--font-playfair),Georgia,serif;font-weight:500;font-size:clamp(2.125rem,8vw,3rem);letter-spacing:-.04em;line-height:1.08}
        .staff-entry-copy>p:last-child{margin:0;color:#b5bcb3;font-size:0.875rem;line-height:1.6}
        .staff-entry-form{display:grid;gap:18px;margin-top:32px}
        .staff-entry-form label{display:grid;gap:8px;color:#e7e5dc;font-size:0.75rem;font-weight:600}
        .staff-entry-form input{width:100%;height:48px;padding:0 14px;border:1px solid #485249;border-radius:10px;background:#151b17;color:#f5f3ed;font:inherit;outline:none;transition:border-color .18s,box-shadow .18s}
        .staff-entry-form input:focus{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}
        .staff-entry-submit{height:50px;margin-top:4px;border:0;border-radius:10px;background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 92%,black);color:#1b211b;font-size:0.8125rem;font-weight:750;cursor:pointer;transition:filter .18s,transform .18s}
        .staff-entry-submit:hover:not(:disabled){filter:brightness(1.07);transform:translateY(-1px)}
        .staff-entry-submit:disabled{cursor:wait;opacity:.65}
        .staff-entry-error{margin:0;color:#ffb7aa;font-size:0.75rem;line-height:1.45}
        .staff-entry-security{margin:22px 0 0;color:#8f9b90;font-size:0.625rem;line-height:1.5;text-align:center}
        @media(max-width:480px){.staff-entry-card{border-radius:18px}.staff-entry-brand{margin-bottom:36px}}
      `}</style>
    </main>
  )
}

export function StaffAccountActions({ profile, compact = false }: { profile: StaffProfileSummary; compact?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  if (compact) {
    return (
      <div className="staff-account-actions compact">
        <span className="staff-account-avatar" aria-hidden="true">{profile.name.trim().charAt(0).toUpperCase()}</span>
        <button type="button" className="icon-only" onClick={signOut} disabled={busy} aria-label={busy ? 'Signing out…' : 'Sign out'} title={busy ? 'Signing out…' : 'Sign out'}>
          <span className="material-symbols-outlined" aria-hidden="true">logout</span>
        </button>
        <style jsx global>{`
          .staff-account-actions{display:flex;align-items:center;gap:10px}
          .staff-account-actions.compact{flex-direction:column;align-items:center;gap:12px;padding-top:14px;border-top:1px solid rgba(127,138,127,.16);width:100%}
          .staff-account-avatar{width:34px;height:34px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;border:1px solid #475248;background:#1f2721;color:#e7e5dc;font:600 0.8125rem Georgia,serif}
          .staff-account-actions button{padding:7px 11px;border:1px solid #475248;border-radius:7px;background:transparent;color:#e7e5dc;font:0.6875rem var(--font-dm-sans),sans-serif;cursor:pointer}
          .staff-account-actions button:hover:not(:disabled){border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 92%,black);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 83%,white)}
          .staff-account-actions button:disabled{opacity:.55;cursor:wait}
          .staff-account-actions button.icon-only{width:34px;height:34px;padding:0;display:grid;place-items:center}
          .staff-account-actions button.icon-only .material-symbols-outlined{font-size:17px}
        `}</style>
      </div>
    )
  }

  return (
    <div className="staff-account-actions">
      <span className="staff-account-identity"><strong>{profile.name}</strong><span>{profile.staffId} · {profile.role}</span></span>
      {profile.role === 'manager' && !pathname.startsWith('/manager') && <button type="button" onClick={() => router.push('/manager')}>Manager workspace</button>}
      <button type="button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
      <style jsx global>{`
        .staff-account-actions{display:flex;align-items:center;gap:10px}
        .staff-account-identity{display:grid;gap:2px;text-align:right}.staff-account-identity strong{color:#f1eee5;font-size:0.75rem}.staff-account-identity span{color:#aab1a7;font-size:0.625rem;text-transform:capitalize}
        .staff-account-actions button{padding:7px 11px;border:1px solid #475248;border-radius:7px;background:transparent;color:#e7e5dc;font:0.6875rem var(--font-dm-sans),sans-serif;cursor:pointer}
        .staff-account-actions button:hover:not(:disabled){border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 92%,black);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 83%,white)}
        .staff-account-actions button:disabled{opacity:.55;cursor:wait}
      `}</style>
    </div>
  )
}

export function StaffAccountBar({ profile }: { profile: StaffProfileSummary }) {
  return (
    <div className="staff-account-bar">
      <StaffAccountActions profile={profile} />
      <style jsx global>{`
        .staff-account-bar{min-height:48px;display:flex;align-items:center;justify-content:flex-end;gap:16px;padding:8px clamp(16px,3vw,36px);border-bottom:1px solid rgba(127,138,127,.18);background:#151b17;color:#bdc5bb;font:0.6875rem var(--font-dm-sans),sans-serif}
      `}</style>
    </div>
  )
}
