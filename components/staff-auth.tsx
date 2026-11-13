'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

type AuthMode = 'sign-in' | 'sign-up'

export function StaffEntry() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [managerPin, setManagerPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      if (mode === 'sign-in') {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) throw new Error('Sign-in failed. Check your email and password.')
        router.refresh()
        return
      }

      const managerResponse = await fetch('/api/manager-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: managerPin }),
      })

      if (!managerResponse.ok) throw new Error('Manager authorization could not be verified.')

      const registrationResponse = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      if (!registrationResponse.ok) throw new Error('Account creation failed. Check the details or use a different email.')

      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to complete the request. Please try again.')
    } finally {
      if (mode === 'sign-up') {
        await fetch('/api/manager-session', { method: 'DELETE' }).catch(() => undefined)
      }
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
          <h1 id="staff-entry-title">{mode === 'sign-in' ? 'Welcome back.' : 'Join the team.'}</h1>
          <p>{mode === 'sign-in' ? 'Sign in to open the dining room workspace.' : 'A manager must authorize each new staff account.'}</p>
        </div>

        <form className="staff-entry-form" onSubmit={handleSubmit}>
          {mode === 'sign-up' && (
            <>
              <label>
                <span>Full name</span>
                <input autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                <span>Manager PIN</span>
                <input autoComplete="off" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={managerPin} onChange={(event) => setManagerPin(event.target.value.replace(/\D/g, '').slice(0, 6))} />
              </label>
            </>
          )}
          <label>
            <span>Email address</span>
            <input autoComplete="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} type="password" required minLength={mode === 'sign-up' ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
            {mode === 'sign-up' && <small>Use at least 12 characters.</small>}
          </label>
          {error && <p className="staff-entry-error" role="alert">{error}</p>}
          <button className="staff-entry-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create staff account'}
          </button>
        </form>

        <div className="staff-entry-switch">
          {mode === 'sign-in' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError('') }}>
            {mode === 'sign-in' ? 'Create one' : 'Sign in'}
          </button>
        </div>
        {mode === 'sign-up' && <p className="staff-entry-security">Account creation is available only with manager authorization.</p>}
      </section>

      <style jsx global>{`
        .staff-entry{min-height:100vh;display:grid;place-items:center;padding:32px 20px;background:radial-gradient(ellipse at 15% 20%,rgba(186,145,79,.17),transparent 34%),linear-gradient(135deg,#111713,#1c241e 58%,#131914);color:#f4f0e7;font-family:var(--md-ref-typeface-plain,Arial,sans-serif)}
        .staff-entry-card{width:min(100%,460px);padding:clamp(28px,6vw,52px);border:1px solid rgba(226,211,179,.18);border-radius:24px;background:rgba(24,31,26,.94);box-shadow:0 28px 80px rgba(0,0,0,.35)}
        .staff-entry-brand{display:flex;align-items:center;gap:13px;margin-bottom:48px}
        .staff-entry-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:#bd9660;color:#1d241e;font-family:Georgia,serif;font-size:25px;font-weight:700}
        .staff-entry-overline,.staff-entry-location,.staff-entry-kicker{margin:0;font-size:10px;letter-spacing:.17em;font-weight:700}
        .staff-entry-overline{color:#f4efe4}.staff-entry-location{margin-top:5px;color:#aab1a7;font-size:9px;letter-spacing:.12em}
        .staff-entry-kicker{color:#c7a16b}
        .staff-entry-copy h1{margin:12px 0 8px;font-family:Georgia,serif;font-weight:500;font-size:clamp(34px,8vw,48px);letter-spacing:-.04em;line-height:1.08}
        .staff-entry-copy>p:last-child{margin:0;color:#b5bcb3;font-size:14px;line-height:1.6}
        .staff-entry-form{display:grid;gap:18px;margin-top:32px}
        .staff-entry-form label{display:grid;gap:8px;color:#e7e5dc;font-size:12px;font-weight:600}
        .staff-entry-form input{width:100%;height:48px;padding:0 14px;border:1px solid #485249;border-radius:10px;background:#151b17;color:#f5f3ed;font:inherit;outline:none;transition:border-color .18s,box-shadow .18s}
        .staff-entry-form input:focus{border-color:#d2aa72;box-shadow:0 0 0 3px rgba(210,170,114,.16)}
        .staff-entry-form small{color:#aab1a7;font-size:11px;font-weight:400}
        .staff-entry-submit{height:50px;margin-top:4px;border:0;border-radius:10px;background:#c6a06a;color:#1b211b;font-size:13px;font-weight:750;cursor:pointer;transition:filter .18s,transform .18s}
        .staff-entry-submit:hover:not(:disabled){filter:brightness(1.07);transform:translateY(-1px)}
        .staff-entry-submit:disabled{cursor:wait;opacity:.65}
        .staff-entry-error{margin:0;color:#ffb7aa;font-size:12px;line-height:1.45}
        .staff-entry-switch{margin-top:24px;color:#aeb5ac;font-size:12px;text-align:center}
        .staff-entry-switch button{padding:0;border:0;background:transparent;color:#dfbd88;font:inherit;font-weight:700;cursor:pointer}
        .staff-entry-switch button:hover{text-decoration:underline}
        .staff-entry-security{margin:18px 0 0;color:#8f9b90;font-size:10px;line-height:1.5;text-align:center}
        @media(max-width:480px){.staff-entry-card{border-radius:18px}.staff-entry-brand{margin-bottom:36px}}
      `}</style>
    </main>
  )
}

export function StaffAccountBar({ email }: { email: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    await authClient.signOut()
    router.refresh()
  }

  return (
    <div className="staff-account-bar">
      <span>{email}</span>
      <button type="button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
      <style jsx global>{`
        .staff-account-bar{min-height:42px;display:flex;align-items:center;justify-content:flex-end;gap:14px;padding:8px clamp(16px,3vw,36px);border-bottom:1px solid rgba(127,138,127,.18);background:#151b17;color:#bdc5bb;font:11px var(--md-ref-typeface-plain,Arial,sans-serif)}
        .staff-account-bar button{padding:5px 10px;border:1px solid #475248;border-radius:7px;background:transparent;color:#e7e5dc;font:inherit;cursor:pointer}
        .staff-account-bar button:hover:not(:disabled){border-color:#c6a06a;color:#dfbd88}
        .staff-account-bar button:disabled{opacity:.55;cursor:wait}
        @media(max-width:480px){.staff-account-bar{font-size:10px}}
      `}</style>
    </div>
  )
}
