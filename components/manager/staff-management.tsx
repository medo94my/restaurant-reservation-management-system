'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import useSWR from 'swr'

type StaffMember = { id: string; staffId: string; name: string; role: 'manager' | 'hostess'; active: boolean; createdAt: string }
type StaffResponse = { staff: StaffMember[] }
type DrawerMode = 'create' | 'passcode'

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
  const [drawerError, setDrawerError] = useState('')
  const [busy, setBusy] = useState(false)
  const [drawer, setDrawer] = useState<DrawerMode | null>(null)
  const [passcodeTarget, setPasscodeTarget] = useState<StaffMember | null>(null)
  const [newPasscode, setNewPasscode] = useState('')

  const openCreate = () => { setDrawer('create'); setDrawerError('') }
  const openPasscode = (member: StaffMember) => { setDrawer('passcode'); setPasscodeTarget(member); setNewPasscode(''); setDrawerError('') }
  const closeDrawer = useCallback(() => { setDrawer(null); setPasscodeTarget(null); setNewPasscode(''); setDrawerError('') }, [])
  const drawerRef = useCallback((node: HTMLDivElement | null) => { node?.focus() }, [])

  useEffect(() => {
    if (!drawer) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDrawer() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, closeDrawer])

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setDrawerError('')
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
      closeDrawer()
      await mutate()
    } catch (caught) {
      setDrawerError(caught instanceof Error ? caught.message : 'Unable to create staff account.')
    } finally {
      setBusy(false)
    }
  }

  async function submitPasscode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!passcodeTarget) return
    setBusy(true)
    setDrawerError('')
    setNotice('')
    try {
      await updateStaff(passcodeTarget.id, { passcode: newPasscode })
      setNotice(`Passcode reset for ${passcodeTarget.name}.`)
      closeDrawer()
      await mutate()
    } catch (caught) {
      setDrawerError(caught instanceof Error ? caught.message : 'Unable to reset passcode.')
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
      <header className="staff-admin-heading">
        <div><p className="manager-eyebrow">PEOPLE &amp; ACCESS</p><h1>Staff accounts</h1><p>Create individual logins, assign roles, and deactivate access when a teammate leaves.</p></div>
        <div className="staff-admin-actions">
          <span className="staff-count">{data?.staff.length ?? 0} accounts</span>
          <button type="button" className="manager-action-primary" onClick={openCreate}>Add staff</button>
        </div>
      </header>
      {notice && <p className="staff-admin-notice" role="status">{notice}</p>}
      {formError && <p className="staff-admin-error" role="alert">{formError}</p>}
      <section className="staff-table-card" aria-labelledby="staff-table-title">
        <div className="staff-table-heading"><div><p className="manager-eyebrow">WORKSPACE ACCESS</p><h2 id="staff-table-title">Team roster</h2></div><button className="manager-action-secondary" onClick={() => void mutate()} disabled={isLoading}>Refresh</button></div>
        {isLoading && <p className="staff-state">Loading staff…</p>}
        {error && <p className="staff-admin-error" role="alert">{error.message}</p>}
        {!isLoading && data?.staff.length === 0 && <p className="staff-state">No staff accounts yet. Add your first teammate.</p>}
        {data && data.staff.length > 0 && (
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr><th scope="col">Staff member</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Added</th><th scope="col" className="staff-th-actions">Actions</th></tr>
              </thead>
              <tbody>
                {data.staff.map((member) => (
                  <tr key={member.id}>
                    <td data-label="Member"><div className="staff-cell-member"><strong>{member.name}</strong><span className="staff-cell-sub">{member.staffId}</span></div></td>
                    <td data-label="Role">
                      <select aria-label={`Role for ${member.name}`} value={member.role} disabled={busy} onChange={(event) => void applyUpdate(member, { role: event.target.value })}>
                        <option value="hostess">Hostess</option>
                        <option value="manager">Manager</option>
                      </select>
                    </td>
                    <td data-label="Status">
                      <button type="button" className="staff-status" data-active={member.active} title={member.active ? 'Deactivate account' : 'Reactivate account'} disabled={busy} onClick={() => void applyUpdate(member, { active: !member.active })}>{member.active ? 'Active' : 'Inactive'}</button>
                    </td>
                    <td data-label="Added">{new Date(member.createdAt).toLocaleDateString()}</td>
                    <td className="staff-cell-actions" data-label="Actions">
                      <button type="button" className="manager-action-secondary" disabled={busy} onClick={() => openPasscode(member)}>Reset passcode</button>
                      <button type="button" className="staff-danger" disabled={busy} onClick={() => removeStaff(member)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {drawer && <div className="drawer-backdrop" onClick={closeDrawer} />}
      {drawer && (
        <aside className="staff-drawer" onClick={(event) => event.stopPropagation()}>
          <div ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={drawer === 'create' ? 'Add staff account' : `Reset passcode for ${passcodeTarget?.name ?? 'staff member'}`} className="staff-drawer-inner">
            <header className="staff-drawer-head">
              <div>
                <p className="manager-eyebrow">{drawer === 'create' ? 'NEW TEAMMATE' : 'ACCESS RESET'}</p>
                <h2>{drawer === 'create' ? 'Create an account' : 'Reset passcode'}</h2>
              </div>
              <button type="button" className="staff-drawer-close" onClick={closeDrawer} aria-label="Close">✕</button>
            </header>
            {drawer === 'create' ? (
              <form onSubmit={createStaff} className="staff-create-form">
                <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label>Staff ID<input required pattern="[a-zA-Z0-9._-]{3,30}" minLength={3} maxLength={30} autoComplete="off" value={staffId} onChange={(event) => setStaffId(event.target.value.toLowerCase())} /><small>3–30 letters, numbers, dots, underscores, or hyphens.</small></label>
                <label>Role<select value={role} onChange={(event) => setRole(event.target.value as 'manager' | 'hostess')}><option value="hostess">Hostess</option><option value="manager">Manager</option></select></label>
                <label>Temporary passcode<input required type="password" minLength={8} maxLength={64} autoComplete="new-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /><small>At least 8 characters. Share it privately and ask them to change it.</small></label>
                {drawerError && <p className="staff-drawer-error" role="alert">{drawerError}</p>}
                <button className="manager-action-primary" disabled={busy}>{busy ? 'Saving…' : 'Create staff account'}</button>
              </form>
            ) : (
              <form onSubmit={submitPasscode} className="staff-create-form">
                <p className="staff-drawer-note">Set a new temporary passcode for <strong>{passcodeTarget?.name}</strong>. Share it privately and ask them to change it on next sign-in.</p>
                <label>New passcode<input required type="password" minLength={8} maxLength={64} autoComplete="new-password" placeholder="At least 8 characters" value={newPasscode} onChange={(event) => setNewPasscode(event.target.value)} /></label>
                {drawerError && <p className="staff-drawer-error" role="alert">{drawerError}</p>}
                <button className="manager-action-primary" disabled={busy || newPasscode.length < 8}>{busy ? 'Saving…' : 'Set passcode'}</button>
              </form>
            )}
          </div>
        </aside>
      )}
      <style jsx global>{`
        .staff-admin{color:#f2efe5}.staff-admin-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 18px}.staff-admin-heading h1{margin:6px 0;font:500 clamp(1.5625rem,4vw,2.25rem)/1.1 var(--font-playfair),Georgia,serif;letter-spacing:-.025em}.staff-admin-heading>div>p:last-child{margin:9px 0 0;color:#aeb8ab;font-size:0.8125rem;line-height:1.6;max-width:560px}.manager-eyebrow{margin:0;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 93%,black);font-size:0.625rem;font-weight:700;letter-spacing:.16em}
        .staff-admin-actions{display:flex;align-items:center;gap:12px;flex:0 0 auto}.staff-count{padding:9px 12px;border:1px solid #465044;border-radius:999px;color:#c5cdbf;font-size:0.6875rem;white-space:nowrap}
        .manager-action-primary,.manager-action-secondary,.staff-danger{min-height:38px;padding:0 12px;border:1px solid #485447;border-radius:8px;background:#242c24;color:#e8e5da;font:600 0.6875rem inherit;cursor:pointer}.manager-action-primary{min-height:44px;padding:0 16px;border-color:var(--restaurant-primary,#d7b46a);background:var(--restaurant-primary,#d7b46a);color:#241d0c}.manager-action-secondary:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}.manager-action-primary:disabled,.manager-action-secondary:disabled,.staff-danger:disabled{opacity:.55;cursor:wait}.staff-danger{border-color:#5f3d36;background:transparent;color:#e07d72}.staff-danger:hover{border-color:#e07d72;color:#f0a99e}
        .staff-admin-notice,.staff-admin-error{margin:0 0 14px;font-size:0.6875rem;line-height:1.5}.staff-admin-error{color:#ffb7aa}.staff-admin-notice{color:#9dd3a8}
        .staff-table-card{padding:22px;border:1px solid #3b453b;border-radius:16px;background:linear-gradient(145deg,#1d251e,#171d18)}.staff-table-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.staff-table-heading h2{margin:6px 0 0;font:500 1.375rem var(--font-playfair),Georgia,serif;letter-spacing:-.02em}.staff-state{margin:6px 0 0;color:#9eaa9d;font-size:0.75rem}
        .staff-table-wrap{overflow-x:auto}.staff-table{width:100%;border-collapse:collapse;font-size:0.8125rem}.staff-table th{padding:2px 12px 11px;border-bottom:1px solid #3b453b;color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-align:left;white-space:nowrap}.staff-table th:last-child{text-align:right}.staff-table td{padding:14px 12px;border-bottom:1px solid #2b322b;vertical-align:middle}.staff-table tbody tr:last-child td{border-bottom:0}.staff-table tbody tr:hover{background:#1c241e}
        .staff-cell-member strong{display:block;font-size:0.875rem;color:#f4f1e8}.staff-cell-sub{display:block;margin-top:3px;color:#9daa9a;font-size:0.6875rem}
        .staff-table select{min-height:36px;min-width:128px;padding:0 9px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;font:inherit;font-size:0.75rem;cursor:pointer}.staff-table select:focus{outline:none;box-shadow:0 0 0 3px var(--focus-ring);border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}
        .staff-status{min-height:30px;padding:4px 12px;border:1px solid #3f5a45;border-radius:999px;background:color-mix(in srgb,#72bd8d 13%,transparent);color:#9dd3a8;font:700 0.6875rem inherit;cursor:pointer;white-space:nowrap}.staff-status[data-active=false]{border-color:#4a4f47;background:transparent;color:#9ba198}.staff-status:hover{border-color:#72bd8d}.staff-status[data-active=false]:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}
        .staff-cell-actions{display:flex;justify-content:flex-end;gap:8px;white-space:nowrap}.staff-cell-actions .manager-action-secondary,.staff-cell-actions .staff-danger{min-height:34px;padding:0 11px}
        .drawer-backdrop{position:fixed;inset:0;background:#080a09c9;z-index:var(--z-backdrop);backdrop-filter:blur(3px)}.staff-drawer{position:fixed;top:0;right:0;bottom:0;z-index:calc(var(--z-backdrop) + 1);width:min(440px,100%);padding:22px;border-left:1px solid #3b453b;background:linear-gradient(145deg,#1d251e,#171d18);color:#f2efe5;overflow-y:auto;animation:drawer-in .22s ease}@keyframes drawer-in{from{transform:translateX(28px);opacity:0}to{transform:translateX(0);opacity:1}}.staff-drawer-inner{outline:none}
        .staff-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.staff-drawer-head h2{margin:6px 0 0;font:500 1.375rem var(--font-playfair),Georgia,serif;letter-spacing:-.02em}.staff-drawer-close{flex:0 0 auto;min-height:34px;min-width:34px;border:1px solid #485447;border-radius:8px;background:#242c24;color:#e8e5da;font:600 0.9375rem/1 inherit;cursor:pointer}.staff-drawer-close:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}.staff-drawer-note{margin:14px 0 0;color:#9daa9a;font-size:0.75rem;line-height:1.55}.staff-drawer-error{margin:0;font-size:0.6875rem;color:#ffb7aa}
        .staff-create-form{display:grid;gap:15px;margin-top:18px}.staff-create-form label{display:grid;gap:7px;color:#e8e6dc;font-size:0.6875rem;font-weight:600}.staff-create-form input,.staff-create-form select{min-height:42px;width:100%;padding:0 11px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;font:inherit}.staff-create-form input:focus,.staff-create-form select:focus{outline:none;box-shadow:0 0 0 3px var(--focus-ring);border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}.staff-create-form small{color:#9daa9a;font-size:0.625rem;font-weight:400}
        @media(prefers-reduced-motion:reduce){.staff-drawer{animation:none}}
        @media(max-width:860px){.staff-admin-heading{align-items:flex-start;flex-direction:column}.staff-table-card{padding:17px}.staff-table thead{display:none}.staff-table tbody tr{display:grid;gap:12px;padding:16px 0;border-bottom:1px solid #2b322b}.staff-table tbody tr:last-child{border-bottom:0}.staff-table tbody tr:hover{background:transparent}.staff-table td{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:0 12px;padding:0;border:0}.staff-table td::before{content:attr(data-label);color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.staff-cell-actions{display:grid;grid-template-columns:88px auto auto;justify-content:start;gap:8px 12px}.staff-drawer{width:100%;border-left:0}}
        @media(max-width:600px){.staff-create-form{margin-top:14px}}
      `}</style>
    </main>
  )
}
