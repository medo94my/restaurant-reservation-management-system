'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CustomerProfile, OccasionTag, VisitTier } from '@/lib/restaurant-config'

type Props = {
  customers: CustomerProfile[]
  monthlyVisitsByPhone: Record<string, number>
  visitTiers: VisitTier[]
  occasionTags: OccasionTag[]
  onCustomersChange: (customers: CustomerProfile[]) => void
}

function getTier(visits: number, tiers: VisitTier[]) {
  return [...tiers].sort((left, right) => right.minVisits - left.minVisits).find((tier) => visits >= tier.minVisits) ?? tiers[0]
}

type DrawerMode = { mode: 'create' } | { mode: 'edit'; original: CustomerProfile } | null

export function GuestTagsManager({ customers, monthlyVisitsByPhone, visitTiers, occasionTags, onCustomersChange }: Props) {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [listError, setListError] = useState('')

  const [drawer, setDrawer] = useState<DrawerMode>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formVisits, setFormVisits] = useState(0)
  const [formNote, setFormNote] = useState('')
  const [formTags, setFormTags] = useState<string[]>([])
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CustomerProfile | null>(null)
  const [passcode, setPasscode] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const closeRef = useRef<() => void>(() => undefined)
  const drawerRef = useCallback((node: HTMLDivElement | null) => { node?.focus() }, [])

  const closeDrawer = useCallback(() => {
    setDrawer(null)
    setFormError('')
  }, [])
  const closeConfirm = useCallback(() => {
    setDeleteTarget(null)
    setPasscode('')
    setDeleteError('')
  }, [])
  closeRef.current = drawer ? closeDrawer : deleteTarget ? closeConfirm : () => undefined

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const query = search.trim().toLowerCase()
    if (query && !`${customer.name} ${customer.phone}`.toLowerCase().includes(query)) return false
    if (tierFilter !== 'all') {
      const monthlyVisits = monthlyVisitsByPhone[customer.phone] ?? 0
      if (getTier(monthlyVisits, visitTiers)?.id !== tierFilter) return false
    }
    if (tagFilter !== 'all' && !customer.occasionTags.includes(tagFilter)) return false
    return true
  }), [customers, monthlyVisitsByPhone, search, tagFilter, tierFilter, visitTiers])

  const openCreate = () => {
    setDrawer({ mode: 'create' })
    setFormName('')
    setFormPhone('')
    setFormVisits(0)
    setFormNote('')
    setFormTags([])
    setFormError('')
    setNotice('')
  }

  const openEdit = (customer: CustomerProfile) => {
    setDrawer({ mode: 'edit', original: customer })
    setFormName(customer.name)
    setFormPhone(customer.phone)
    setFormVisits(customer.visits)
    setFormNote(customer.note)
    setFormTags([...customer.occasionTags])
    setFormError('')
    setNotice('')
  }

  const openDelete = (customer: CustomerProfile) => {
    setDeleteTarget(customer)
    setPasscode('')
    setDeleteError('')
    setDrawer(null)
    setNotice('')
  }

  const saveProfile = () => {
    const name = formName.trim()
    const phone = formPhone.replace(/[^\d+]/g, '')
    if (name.length < 2 || name.length > 100 || !/^\+?\d{7,20}$/.test(phone)) {
      setFormError('Add a guest name and a valid phone number (7–20 digits).')
      return
    }
    const digits = phone.replace(/\D/g, '')
    const taken = customers.some((customer) =>
      customer.phone.replace(/\D/g, '') === digits && !(drawer?.mode === 'edit' && customer === drawer.original))
    if (taken) {
      setFormError('A guest profile with this phone number already exists.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const next: CustomerProfile = {
        phone,
        name,
        visits: Math.max(0, Math.min(9999, Math.round(formVisits) || 0)),
        note: formNote.slice(0, 500),
        occasionTags: formTags,
      }
      if (drawer?.mode === 'edit') {
        onCustomersChange(customers.map((customer) => customer === drawer.original ? next : customer))
        setNotice(`Updated ${name}’s profile.`)
      } else {
        onCustomersChange([next, ...customers])
        setNotice(`Created ${name}’s profile.`)
      }
      closeDrawer()
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (!passcode) {
      setDeleteError('Enter your manager passcode to confirm.')
      return
    }
    setBusy(true)
    setDeleteError('')
    try {
      const response = await fetch('/api/staff/verify-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setDeleteError(typeof result?.error === 'string' ? result.error : 'Unable to verify the passcode.')
        return
      }
      onCustomersChange(customers.filter((customer) => customer.phone !== deleteTarget.phone))
      setNotice(`Deleted ${deleteTarget.name}’s profile.`)
      closeConfirm()
    } catch {
      setDeleteError('Unable to verify the passcode.')
    } finally {
      setBusy(false)
    }
  }

  const editTier = drawer?.mode === 'edit'
    ? getTier(monthlyVisitsByPhone[drawer.original.phone] ?? 0, visitTiers)
    : null

  return (
    <div className="guest-manager">
      <section className="guest-panel profiles-panel">
        <div className="guest-panel-heading profiles-heading">
          <div><span className="guest-kicker">Guest book</span><h2>Guest profiles</h2><p>A registry of everyone who books. New reservations register their guests here automatically; profiles stay read-only until you open one.</p></div>
          <button className="guest-button" type="button" onClick={openCreate}>Add guest</button>
        </div>
        <div className="guest-toolbar">
          <label className="guest-search"><span className="sr-only">Search guests by name or phone</span><input value={search} placeholder="Search name or phone" onChange={(event) => setSearch(event.target.value)} /></label>
          <select className="guest-filter" aria-label="Filter by tier" value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
            <option value="all">All tiers</option>
            {visitTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
          </select>
          <select className="guest-filter" aria-label="Filter by tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">All tags</option>
            {occasionTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
          </select>
          <span className="guest-count">{filteredCustomers.length} of {customers.length}</span>
        </div>
        {notice && <p className="guest-notice" role="status">{notice}</p>}
        {listError && <p className="guest-error" role="alert">{listError}</p>}
        <div className="guest-table-wrap">
          <table className="guest-table">
            <thead>
              <tr><th scope="col">Guest</th><th scope="col">Lifetime visits</th><th scope="col">Tier</th><th scope="col">Tags</th><th scope="col">Note</th><th scope="col" className="guest-th-actions">Actions</th></tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const monthlyVisits = monthlyVisitsByPhone[customer.phone] ?? 0
                const tier = getTier(monthlyVisits, visitTiers)
                return (
                  <tr key={customer.phone}>
                    <td data-label="Guest">
                      <div className="guest-identity">
                        <span className="guest-avatar" aria-hidden="true">{customer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                        <span><strong>{customer.name}</strong><small>{customer.phone}</small></span>
                      </div>
                    </td>
                    <td data-label="Visits" className="guest-cell-visits">{customer.visits}</td>
                    <td data-label="Tier"><span className="guest-tier" title={`${monthlyVisits} completed visits this month`} style={{ color: tier?.color, borderColor: `${tier?.color}66`, background: `${tier?.color}14` }}>{tier?.label ?? 'New'}</span></td>
                    <td data-label="Tags">
                      <div className="guest-tags" aria-label={`${customer.name} occasion tags`}>
                        {customer.occasionTags.length === 0 && <span className="guest-muted">—</span>}
                        {customer.occasionTags.map((tagId) => {
                          const tag = occasionTags.find((item) => item.id === tagId)
                          if (!tag) return null
                          return <span className="guest-tag-chip" key={tag.id} style={{ '--tag-color': tag.color } as CSSProperties}>{tag.label}</span>
                        })}
                      </div>
                    </td>
                    <td data-label="Note" className="guest-cell-note"><span title={customer.note || undefined}>{customer.note || '—'}</span></td>
                    <td data-label="Actions" className="guest-cell-actions">
                      <button type="button" className="guest-action-secondary" onClick={() => openEdit(customer)}>Update</button>
                      <button type="button" className="guest-danger" onClick={() => openDelete(customer)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
              {filteredCustomers.length === 0 && <tr><td colSpan={6} className="guest-empty-cell">{customers.length === 0 ? 'No guests yet. They register here automatically with their first booking, or add one above.' : 'No guests match your search or filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {drawer && <div className="drawer-backdrop" onClick={closeDrawer} />}
      {drawer && (
        <aside className="guest-drawer" onClick={(event) => event.stopPropagation()}>
          <div ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={drawer.mode === 'create' ? 'New guest profile' : `${drawer.original.name}’s profile`} className="guest-drawer-inner">
            <header className="guest-drawer-head">
              <div>
                <p className="manager-eyebrow">{drawer.mode === 'create' ? 'GUEST BOOK' : 'GUEST PROFILE'}</p>
                <h2>{drawer.mode === 'create' ? 'New guest profile' : drawer.original.name}</h2>
                {drawer.mode === 'edit' && <p className="guest-drawer-sub">{editTier && <span className="guest-tier" style={{ color: editTier.color, borderColor: `${editTier.color}66`, background: `${editTier.color}14` }}>{editTier.label}</span>}<span>{monthlyVisitsByPhone[drawer.original.phone] ?? 0} completed visits this month</span></p>}
              </div>
              <button type="button" className="guest-drawer-close" onClick={closeDrawer} aria-label="Close">✕</button>
            </header>
            <form className="guest-drawer-form" onSubmit={(event) => { event.preventDefault(); saveProfile() }}>
              <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={formName} onChange={(event) => setFormName(event.target.value)} /></label>
              <label>Phone number<input required inputMode="tel" maxLength={24} autoComplete="off" value={formPhone} onChange={(event) => setFormPhone(event.target.value)} /><small>7–20 digits. The phone number is the profile’s identity.</small></label>
              <label>Lifetime visits<input type="number" min={0} max={9999} value={formVisits} onChange={(event) => setFormVisits(Math.max(0, Math.min(9999, Number(event.target.value) || 0)))} /><small>Manual count — monthly visits are derived from completed reservations.</small></label>
              <label>Service note<textarea maxLength={500} rows={3} placeholder="Allergies, seating preferences, occasions…" value={formNote} onChange={(event) => setFormNote(event.target.value)} /></label>
              <div className="guest-drawer-tags" aria-label="Occasion tags">
                {occasionTags.map((tag) => {
                  const active = formTags.includes(tag.id)
                  return <button
                    type="button"
                    key={tag.id}
                    className={`guest-tag-option ${active ? 'active' : ''}`}
                    aria-pressed={active}
                    style={{ '--tag-color': tag.color } as CSSProperties}
                    onClick={() => setFormTags(active ? formTags.filter((id) => id !== tag.id) : [...formTags, tag.id])}
                  >{tag.label}</button>
                })}
                {occasionTags.length === 0 && <span className="guest-muted">Create tags in Settings first.</span>}
              </div>
              {formError && <p className="guest-drawer-error" role="alert">{formError}</p>}
              <button className="guest-button" disabled={busy}>{busy ? 'Saving…' : drawer.mode === 'create' ? 'Create profile' : 'Save changes'}</button>
            </form>
          </div>
        </aside>
      )}

      {deleteTarget && <div className="drawer-backdrop" onClick={closeConfirm} />}
      {deleteTarget && (
        <div className="guest-confirm-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Delete ${deleteTarget.name}’s profile`}>
          <div ref={drawerRef} tabIndex={-1} className="guest-confirm-inner">
            <header className="guest-drawer-head">
              <div><p className="manager-eyebrow">CONFIRM DELETE</p><h2>Delete guest profile</h2></div>
              <button type="button" className="guest-drawer-close" onClick={closeConfirm} aria-label="Close">✕</button>
            </header>
            <p className="guest-confirm-text">Permanently delete <strong>{deleteTarget.name}</strong>’s profile ({deleteTarget.phone}). Their reservations and service history stay in the log. If they book again, a fresh profile is registered.</p>
            <form className="guest-drawer-form" onSubmit={(event) => { event.preventDefault(); void confirmDelete() }}>
              <label>Manager passcode<input required type="password" autoComplete="current-password" autoFocus value={passcode} onChange={(event) => setPasscode(event.target.value)} /><small>Enter your own passcode to confirm this deletion.</small></label>
              {deleteError && <p className="guest-drawer-error" role="alert">{deleteError}</p>}
              <div className="guest-confirm-actions">
                <button type="button" className="guest-action-secondary" onClick={closeConfirm}>Cancel</button>
                <button className="guest-danger" disabled={busy}>{busy ? 'Verifying…' : 'Delete profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .guest-manager{margin-bottom:20px}.guest-panel{border:1px solid #353d35;background:linear-gradient(150deg,#202521,#191d1a);border-radius:14px;padding:18px}.guest-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.guest-kicker{font-size:0.625rem;color:var(--restaurant-primary,#d6b66f);text-transform:uppercase;letter-spacing:.15em}.guest-panel h2{font:500 1.25rem var(--font-playfair),Georgia,serif;color:#eee9df;margin:6px 0}.guest-panel-heading p{font-size:0.6875rem;color:#9ca397;line-height:1.6;margin:0;max-width:600px}
        .profiles-heading{align-items:center}
        .guest-button,.guest-action-secondary,.guest-danger{min-height:39px;padding:0 14px;border-radius:8px;font:700 0.6875rem inherit;white-space:nowrap;cursor:pointer}.guest-button{border:1px solid #8a7547;background:var(--restaurant-primary,#d7b46a);color:#241e11}.guest-button:hover{background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}.guest-button:disabled{opacity:.45;cursor:not-allowed}.guest-action-secondary{border:1px solid #485447;background:#242c24;color:#e8e5da}.guest-action-secondary:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}.guest-danger{border:1px solid #5f3d36;background:transparent;color:#e07d72}.guest-danger:hover{border-color:#e07d72;color:#f0a99e}.guest-button:focus-visible,.guest-action-secondary:focus-visible,.guest-danger:focus-visible,.guest-tag-option:focus-visible,.guest-filter:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}
        .guest-toolbar{display:flex;align-items:center;gap:9px;margin:14px 0 4px;flex-wrap:wrap}.guest-search{flex:1;min-width:180px}.guest-search input{width:100%;height:39px;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 11px;font:inherit;font-size:0.6875rem;min-width:0}.guest-filter{height:39px;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 9px;font:inherit;font-size:0.6875rem;cursor:pointer}.guest-count{font-size:0.625rem;color:#d5bf7c;border:1px solid #655738;background:#2e2a1f;padding:8px 10px;border-radius:20px;white-space:nowrap}
        .guest-notice{font-size:0.6875rem;color:#9dd3a8;margin:10px 0 0}.guest-error{font-size:0.625rem;color:#ed9c91;margin:8px 0}
        .guest-search input:focus,.guest-filter:focus,.guest-drawer-form input:focus,.guest-drawer-form textarea:focus{outline:none;box-shadow:0 0 0 3px var(--focus-ring);border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}
        .guest-table-wrap{overflow-x:auto}.guest-table{width:100%;border-collapse:collapse;font-size:0.8125rem}.guest-table th{padding:2px 12px 11px;border-bottom:1px solid #3b453b;color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-align:left;white-space:nowrap}.guest-table th.guest-th-actions,.guest-table td.guest-cell-actions{text-align:right}.guest-table td{padding:13px 12px;border-bottom:1px solid #2b322b;vertical-align:middle}.guest-table tbody tr:hover{background:#1c241e}.guest-empty-cell{text-align:center;color:#9eaa9d;font-size:0.75rem;padding:24px 12px}
        .guest-identity{display:flex;align-items:center;gap:9px;min-width:0}.guest-identity>span:last-child{display:flex;flex-direction:column;gap:4px;min-width:0}.guest-identity strong{font-size:0.75rem;color:#ece9e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guest-identity small{font-size:0.625rem;color:#929a90}.guest-avatar{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border:1px solid #6d5a35;border-radius:10px;background:#393222;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 86%,white);font-size:0.625rem;font-weight:700}
        .guest-cell-visits{font-variant-numeric:tabular-nums;color:#e8e5da}.guest-tier{display:inline-flex;align-items:center;gap:6px;border:1px solid;border-radius:20px;padding:6px 9px;font-size:0.625rem;font-weight:600;justify-content:center;white-space:nowrap}
        .guest-tags{display:flex;gap:6px;flex-wrap:wrap;max-width:300px}.guest-tag-chip{display:inline-flex;align-items:center;border:1px solid color-mix(in srgb,var(--tag-color) 55%,transparent);border-radius:20px;padding:5px 9px;font-size:0.625rem;font-weight:600;color:var(--tag-color);background:color-mix(in srgb,var(--tag-color) 12%,transparent)}.guest-muted{color:#8b948a;font-size:0.6875rem}.guest-cell-note{max-width:260px}.guest-cell-note span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b9c0b4;font-size:0.75rem}
        .guest-cell-actions{white-space:nowrap}.guest-cell-actions .guest-action-secondary,.guest-cell-actions .guest-danger{min-height:34px;padding:0 11px}
        .drawer-backdrop{position:fixed;inset:0;background:#080a09c9;z-index:var(--z-backdrop);backdrop-filter:blur(3px)}.guest-drawer{position:fixed;top:0;right:0;bottom:0;z-index:calc(var(--z-backdrop) + 1);width:min(460px,100%);padding:22px;border-left:1px solid #3b453b;background:linear-gradient(145deg,#1d251e,#171d18);color:#f2efe5;overflow-y:auto;animation:guest-drawer-in .22s ease}@keyframes guest-drawer-in{from{transform:translateX(28px);opacity:0}to{transform:translateX(0);opacity:1}}.guest-drawer-inner{outline:none}
        .guest-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.guest-drawer-head h2{margin:6px 0 0;font:500 1.375rem var(--font-playfair),Georgia,serif;letter-spacing:-.02em}.guest-drawer-sub{display:flex;align-items:center;gap:9px;margin:10px 0 0;color:#9daa9a;font-size:0.6875rem}.guest-drawer-close{flex:0 0 auto;min-height:34px;min-width:34px;border:1px solid #485447;border-radius:8px;background:#242c24;color:#e8e5da;font:600 0.9375rem/1 inherit;cursor:pointer}.guest-drawer-close:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}
        .guest-drawer-form{display:grid;gap:14px;margin-top:18px}.guest-drawer-form label{display:grid;gap:7px;color:#e8e6dc;font-size:0.6875rem;font-weight:600}.guest-drawer-form input,.guest-drawer-form textarea{width:100%;padding:9px 11px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;font:inherit;font-size:0.75rem}.guest-drawer-form textarea{resize:vertical;min-height:70px}.guest-drawer-form small{color:#9daa9a;font-size:0.625rem;font-weight:400}.guest-drawer-error{margin:0;font-size:0.6875rem;color:#ffb7aa}
        .guest-drawer-tags{display:flex;gap:6px;flex-wrap:wrap}.guest-tag-option{border:1px solid #454c45;border-radius:20px;background:#202622;color:#abb2a8;padding:5px 8px;font-size:0.625rem;cursor:pointer}.guest-tag-option.active{color:var(--tag-color);border-color:color-mix(in srgb,var(--tag-color) 65%,transparent);background:color-mix(in srgb,var(--tag-color) 12%,transparent)}
        .guest-confirm-card{position:fixed;inset:0;z-index:calc(var(--z-backdrop) + 1);display:grid;place-items:center;padding:18px;pointer-events:none}.guest-confirm-inner{pointer-events:auto;width:min(430px,100%);padding:22px;border:1px solid #3b453b;border-radius:16px;background:linear-gradient(145deg,#1d251e,#171d18);color:#f2efe5;box-shadow:var(--modal-veil,0 24px 90px #0009);outline:none;animation:guest-confirm-in .18s ease}@keyframes guest-confirm-in{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
        .guest-confirm-text{margin:14px 0 0;color:#aeb8ab;font-size:0.75rem;line-height:1.6}.guest-confirm-text strong{color:#f4f1e8}.guest-confirm-actions{display:flex;gap:10px;justify-content:flex-end}
        @media(prefers-reduced-motion:reduce){.guest-drawer,.guest-confirm-inner{animation:none}}
        @media(max-width:860px){.guest-panel{padding:17px}.guest-table thead{display:none}.guest-table tbody tr{display:grid;gap:12px;padding:16px 0;border-bottom:1px solid #2b322b}.guest-table tbody tr:last-child{border-bottom:0}.guest-table tbody tr:hover{background:transparent}.guest-table td{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:0 12px;padding:0;border:0}.guest-table td::before{content:attr(data-label);color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.guest-empty-cell{display:block;text-align:left;padding:0}.guest-empty-cell::before{content:none}.guest-cell-actions{display:flex;justify-content:flex-start;gap:8px}.guest-cell-note span{white-space:normal}}
        @media(max-width:560px){.guest-panel{padding:13px}.guest-panel-heading{align-items:flex-start;flex-direction:column;gap:9px}.guest-search{min-width:100%}.guest-identity strong{font-size:0.6875rem}}
      `}</style>
    </div>
  )
}
