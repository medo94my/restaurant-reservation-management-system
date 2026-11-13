'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'

type StaffMember = { id: string; staffId: string; name: string; role: 'manager' | 'hostess'; active: boolean; createdAt: string }
type StaffResponse = { staff: StaffMember[] }

async function fetchStaff(url: string): Promise<StaffResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load staff accounts.')
  return response.json()
}

async function updateStaff(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to update staff account.')
}

export function StaffManagement() {
  const { data, error, isLoading, mutate } = useSWR('/api/staff', fetchStaff)
  const [name, setName] = useState('')
  const [staffId, setStaffId] = useState('')
  const [role, setRole] = useState<'manager' | 'hostess'>('hostess')
  const [passcode, setPasscode] = useState('')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    setNotice('')
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, staffId: staffId.toLowerCase(), role, passcode }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to create staff account.')
      setName('')
      setStaffId('')
      setPasscode('')
      setNotice(`Created ${result.staff.name}’s ${result.staff.role} account.`)
      await mutate()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Unable to create staff account.')
    } finally {
      setBusy(false)
    }
  }

  async function removeStaff(member: StaffMember) {
    if (!window.confirm(`Permanently delete ${member.name}’s staff account? Their restaurant reservations and service history will remain.`)) return
    setBusy(true)
    setFormError('')
    setNotice('')
    try {
      const response = await fetch(`/api/staff/${encodeURIComponent(member.id)}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to delete staff account.')
      setNotice(`Deleted ${member.name}’s staff account.`)
      await mutate()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Unable to delete staff account.')
    } finally {
      setBusy(false)
    }
  }

  async function applyUpdate(member: StaffMember, body: Record<string, unknown>) {
    setBusy(true)
    setFormError('')
    setNotice('')
    try {
      await updateStaff(member.id, body)
      setNotice(`Updated ${member.name}’s account.`)
      await mutate()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Unable to update staff account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="staff-admin">
      <header className="staff-admin-heading"><div><p className="manager-eyebrow">PEOPLE &amp; ACCESS</p><h1>Staff accounts</h1><p>Create individual logins, assign roles, and deactivate access when a teammate leaves.</p></div><span className="staff-count">{data?.staff.length ?? 0} accounts</span></header>
      <div className="staff-admin-grid">
        <section className="staff-create-card" aria-labelledby="staff-create-title">
          <p className="manager-eyebrow">NEW TEAMMATE</p><h2 id="staff-create-title">Create an account</h2>
          <form onSubmit={createStaff} className="staff-create-form">
            <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Staff ID<input required pattern="[a-zA-Z0-9._-]{3,30}" minLength={3} maxLength={30} autoComplete="off" value={staffId} onChange={(event) => setStaffId(event.target.value.toLowerCase())} /><small>3–30 letters, numbers, dots, underscores, or hyphens.</small></label>
            <label>Role<select value={role} onChange={(event) => setRole(event.target.value as 'manager' | 'hostess')}><option value="hostess">Hostess</option><option value="manager">Manager</option></select></label>
            <label>Temporary passcode<input required type="password" minLength={8} maxLength={64} autoComplete="new-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /><small>At least 8 characters. Share it privately and ask them to change it.</small></label>
            {formError && <p className="staff-admin-error" role="alert">{formError}</p>}
            {notice && <p className="staff-admin-notice" role="status">{notice}</p>}
            <button className="manager-action-primary" disabled={busy}>{busy ? 'Saving…' : 'Create staff account'}</button>
          </form>
        </section>
        <section className="staff-list-card" aria-labelledby="staff-list-title">
          <div className="staff-list-heading"><div><p className="manager-eyebrow">WORKSPACE ACCESS</p><h2 id="staff-list-title">Team roster</h2></div><button className="manager-action-secondary" onClick={() => void mutate()} disabled={isLoading}>Refresh</button></div>
          {isLoading && <p className="staff-state">Loading staff…</p>}
          {error && <p className="staff-admin-error" role="alert">{error.message}</p>}
          {!isLoading && data?.staff.length === 0 && <p className="staff-state">No staff accounts found.</p>}
          <div className="staff-roster">{data?.staff.map((member) => <StaffRow key={member.id} member={member} disabled={busy} onUpdate={applyUpdate} onDelete={removeStaff} />)}</div>
        </section>
      </div>
      <style jsx global>{`
        .staff-admin{color:#f2efe5}.staff-admin-heading,.staff-list-heading{display:flex;align-items:center;justify-content:space-between;gap:18px}.staff-admin-heading{margin:0 0 24px}.staff-admin-heading h1,.staff-list-heading h2,.staff-create-card h2{margin:6px 0;font:500 clamp(1.5625rem,4vw,2.25rem)/1.1 var(--font-playfair),Georgia,serif;letter-spacing:-.025em}.staff-admin-heading>div>p:last-child{margin:9px 0 0;color:#aeb8ab;font-size:0.8125rem;line-height:1.6}.manager-eyebrow{margin:0;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 93%,black);font-size:0.625rem;font-weight:700;letter-spacing:.16em}.staff-count{padding:9px 12px;border:1px solid #465044;border-radius:999px;color:#c5cdbf;font-size:0.6875rem;white-space:nowrap}
        .staff-admin-grid{display:grid;grid-template-columns:minmax(280px,.82fr) minmax(0,1.5fr);gap:18px;align-items:start}.staff-create-card,.staff-list-card{padding:22px;border:1px solid #3b453b;border-radius:16px;background:linear-gradient(145deg,#1d251e,#171d18)}.staff-create-card h2,.staff-list-heading h2{font-size:1.375rem}.staff-create-form{display:grid;gap:15px;margin-top:18px}.staff-create-form label,.staff-inline-form label{display:grid;gap:7px;color:#e8e6dc;font-size:0.6875rem;font-weight:600}.staff-create-form input,.staff-create-form select,.staff-inline-form input,.staff-row select{min-height:42px;width:100%;padding:0 11px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;font:inherit}.staff-create-form input:focus,.staff-create-form select:focus,.staff-inline-form input:focus,.staff-row select:focus{outline:3px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 20%,transparent);border-color:var(--restaurant-primary,#d7b46a)}.staff-create-form small{color:#9daa9a;font-size:0.625rem;font-weight:400}.manager-action-primary,.manager-action-secondary,.staff-row button{min-height:38px;padding:0 12px;border:1px solid #485447;border-radius:8px;background:#242c24;color:#e8e5da;font:600 0.6875rem inherit;cursor:pointer}.manager-action-primary{min-height:44px;border-color:var(--restaurant-primary,#d7b46a);background:var(--restaurant-primary,#d7b46a);color:#241d0c}.manager-action-secondary:hover,.staff-row button:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}.manager-action-primary:disabled,.manager-action-secondary:disabled,.staff-row button:disabled{opacity:.55;cursor:wait}.staff-admin-error,.staff-admin-notice{margin:0;font-size:0.6875rem;line-height:1.5}.staff-admin-error{color:#ffb7aa}.staff-admin-notice{color:#9dd3a8}.staff-list-heading{margin-bottom:16px}.staff-roster{display:grid;gap:10px}.staff-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #354034;border-radius:11px;background:#161c17}.staff-row-main{display:grid;gap:4px}.staff-row-main strong{font-size:0.8125rem}.staff-row-main span{color:#9eaa9d;font-size:0.625rem}.staff-row-controls{display:flex;align-items:center;gap:8px}.staff-row select{width:auto;min-width:110px;min-height:35px;font-size:0.6875rem}.staff-row button{min-height:35px}.staff-row button[data-active="false"]{border-color:#79493e;color:#efaaa0}.staff-row .staff-delete-button{border-color:#79493e;color:#efaaa0}.staff-inline-form{grid-column:1/-1;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;padding-top:10px;border-top:1px solid #303a30}.staff-inline-form input{min-height:36px}.staff-state{color:#aeb8ab;font-size:0.75rem}
        @media(max-width:860px){.staff-admin-grid{grid-template-columns:1fr}}@media(max-width:600px){.staff-admin-heading{align-items:flex-start;flex-direction:column}.staff-create-card,.staff-list-card{padding:17px}.staff-row{grid-template-columns:1fr}.staff-row-controls{justify-content:space-between}.staff-inline-form{grid-template-columns:1fr}}
      `}</style>
    </main>
  )
}

function StaffRow({ member, disabled, onUpdate, onDelete }: { member: StaffMember; disabled: boolean; onUpdate: (member: StaffMember, body: Record<string, unknown>) => void; onDelete: (member: StaffMember) => void }) {
  const [role, setRole] = useState(member.role)
  const [passcode, setPasscode] = useState('')
  return (
    <article className="staff-row">
      <div className="staff-row-main"><strong>{member.name}</strong><span>{member.staffId} · {member.active ? 'Active' : 'Inactive'} · added {new Date(member.createdAt).toLocaleDateString()}</span></div>
      <div className="staff-row-controls">
        <label className="sr-only" htmlFor={`role-${member.id}`}>Role for {member.name}</label>
        <select id={`role-${member.id}`} value={role} onChange={(event) => setRole(event.target.value as 'manager' | 'hostess')}><option value="hostess">Hostess</option><option value="manager">Manager</option></select>
        {role !== member.role && <button disabled={disabled} onClick={() => onUpdate(member, { role })}>Save role</button>}
        <button data-active={member.active} disabled={disabled} onClick={() => onUpdate(member, { active: !member.active })}>{member.active ? 'Deactivate' : 'Reactivate'}</button>
        <button className="staff-delete-button" disabled={disabled} onClick={() => onDelete(member)}>Delete</button>
      </div>
      <form className="staff-inline-form" onSubmit={(event) => { event.preventDefault(); onUpdate(member, { passcode }); setPasscode('') }}>
        <label htmlFor={`passcode-${member.id}`}>Reset passcode<input id={`passcode-${member.id}`} type="password" minLength={8} maxLength={64} autoComplete="new-password" placeholder="At least 8 characters" value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label>
        <button disabled={disabled || passcode.length < 8}>Set passcode</button>
      </form>
    </article>
  )
}
