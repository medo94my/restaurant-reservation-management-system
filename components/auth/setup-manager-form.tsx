'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export function SetupManagerForm() {
  const router = useRouter()
  const [setupCode, setSetupCode] = useState('')
  const [name, setName] = useState('')
  const [staffId, setStaffId] = useState('')
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (passcode !== confirmPasscode) {
      setError('Passcodes do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/staff/setup-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupCode, name, staffId: staffId.toLowerCase(), passcode }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to create the manager account.')
      setComplete(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the manager account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="setup-page">
      {complete ? (
        <section className="setup-card" aria-labelledby="setup-done-title">
          <p className="setup-eyebrow">FIRST MANAGER CREATED</p>
          <h1 id="setup-done-title">You’re ready to open.</h1>
          <p>Your manager account is set up. Sign in with the staff ID and passcode you just created.</p>
          <button className="setup-submit" onClick={() => router.push('/login')}>Continue to sign in</button>
        </section>
      ) : (
      <section className="setup-card" aria-labelledby="setup-title">
        <p className="setup-eyebrow">ONE-TIME WORKSPACE SETUP</p>
        <h1 id="setup-title">Create the first manager.</h1>
        <p>Use the current manager setup code once, then create a unique staff ID and a strong passcode. The setup code is disabled after this account is created.</p>
        <form className="setup-form" onSubmit={submit}>
          <label>Manager setup code<input required inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          <label>Full name<input required autoComplete="name" minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Staff ID<input required autoComplete="username" pattern="[a-zA-Z0-9._-]{3,30}" minLength={3} maxLength={30} value={staffId} onChange={(event) => setStaffId(event.target.value.toLowerCase())} /></label>
          <label>New passcode<input required type="password" autoComplete="new-password" minLength={8} maxLength={64} value={passcode} onChange={(event) => setPasscode(event.target.value)} /><small>Use at least 8 characters. Passcodes are hashed by Better Auth.</small></label>
          <label>Confirm passcode<input required type="password" autoComplete="new-password" minLength={8} maxLength={64} value={confirmPasscode} onChange={(event) => setConfirmPasscode(event.target.value)} /></label>
          {error && <p className="setup-error" role="alert">{error}</p>}
          <button className="setup-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create manager account'}</button>
        </form>
      </section>
      )}
      <style jsx global>{`
        .setup-page{min-height:100vh;display:grid;place-items:center;padding:28px 16px;background:radial-gradient(ellipse at 20% 0%,#40351e 0,transparent 45%),#111713;color:#f4f0e7;font-family:var(--font-dm-sans),sans-serif}
        .setup-card{width:min(100%,520px);padding:clamp(22px,4vw,32px);border:1px solid #464537;border-radius:20px;background:#1a201b;box-shadow:0 24px 80px #0005}
        .setup-eyebrow{margin:0 0 10px;color:var(--restaurant-primary,#d7b46a);font-size:0.625rem;font-weight:700;letter-spacing:.16em}.setup-card h1{margin:0 0 10px;font:500 clamp(1.875rem,6vw,2.625rem)/1.1 var(--font-playfair),Georgia,serif;letter-spacing:-.03em}.setup-card>p:not(.setup-eyebrow){margin:0;color:#b4bdb1;font-size:0.8125rem;line-height:1.65}
        .setup-form{display:grid;gap:12px;margin-top:22px}.setup-form label{display:grid;gap:7px;color:#e9e6dc;font-size:0.75rem;font-weight:600}.setup-form input{height:45px;padding:0 12px;border:1px solid #4b554b;border-radius:9px;background:#141a15;color:#f5f3ed;font:inherit}.setup-form input:focus{outline:3px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 20%,transparent);border-color:var(--restaurant-primary,#d7b46a)}.setup-form small{color:#9ba79a;font-weight:400;font-size:0.625rem}.setup-error{margin:0;color:#ffb7aa;font-size:0.75rem}.setup-submit{min-height:48px;padding:0 16px;border:0;border-radius:9px;background:var(--restaurant-primary,#d7b46a);color:#251f13;font-size:0.8125rem;font-weight:700;cursor:pointer}.setup-submit:disabled{opacity:.65;cursor:wait}
      `}</style>
    </main>
  )
}
