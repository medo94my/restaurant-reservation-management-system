'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CustomerProfile, OccasionTag, VisitTier } from '@/lib/restaurant-config'
import { TableCollapseStyles } from '@/components/manager/table-collapse-styles'

type Props = {
  customers: CustomerProfile[]
  monthlyVisitsByPhone: Record<string, number>
  visitTiers: VisitTier[]
  occasionTags: OccasionTag[]
  onCustomersChange: (customers: CustomerProfile[]) => void
  onDeleteCustomer: (phone: string) => Promise<void>
  saveStatus?: 'idle' | 'saved' | 'saving' | 'error'
}

function getTier(visits: number, tiers: VisitTier[]) {
  return [...tiers].sort((left, right) => right.minVisits - left.minVisits).find((tier) => visits >= tier.minVisits) ?? tiers[0]
}

type DrawerMode = { mode: 'create' } | { mode: 'edit'; original: CustomerProfile } | null

export function GuestTagsManager({ customers, monthlyVisitsByPhone, visitTiers, occasionTags, onCustomersChange, onDeleteCustomer, saveStatus = 'idle' }: Props) {
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

  const filtersActive = search.trim() !== '' || tierFilter !== 'all' || tagFilter !== 'all'
  const clearFilters = () => {
    setSearch('')
    setTierFilter('all')
    setTagFilter('all')
  }

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
      // The parent saves the delete to the server immediately (not via the
      // debounced config save) so closing the tab cannot silently lose it.
      await onDeleteCustomer(deleteTarget.phone)
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

  const tierPillStyle = (color: string | undefined): CSSProperties => {
    const ink = color ?? '#9ba198'
    return { color: ink, borderColor: `${ink}66`, background: `${ink}14` }
  }

  return (
    <div className="guest-manager">
      <section className="guest-panel profiles-panel">
        <div className="guest-panel-heading profiles-heading">
          <div>
            <p className="manager-eyebrow">GUEST BOOK</p>
            <h2>Guest profiles</h2>
            <p className="guest-lede">Everyone who books registers here automatically. Profiles stay read-only until you open one.</p>
          </div>
          <button className="manager-action-primary" type="button" onClick={openCreate}>Add guest</button>
        </div>

        <div className="guest-toolbar">
          <label className="guest-search">
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input aria-label="Search guests by name or phone" value={search} placeholder="Search name or phone" onChange={(event) => setSearch(event.target.value)} />
            {search !== '' && (
              <button type="button" className="guest-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            )}
          </label>
          <select className="guest-filter" aria-label="Filter by tier" value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
            <option value="all">All tiers</option>
            {visitTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
          </select>
          <select className="guest-filter" aria-label="Filter by tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">All tags</option>
            {occasionTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
          </select>
          <span className="guest-count">{filteredCustomers.length} of {customers.length} guests</span>
          {saveStatus !== 'idle' && (
            <span className="guest-save-state" data-status={saveStatus} role={saveStatus === 'error' ? 'alert' : 'status'}>
              {saveStatus === 'saving' ? 'Saving changes…' : saveStatus === 'error' ? 'Save failed · check manager access' : 'Changes saved'}
            </span>
          )}
        </div>

        {notice && <p className="guest-notice" role="status">{notice}</p>}
        {listError && <p className="guest-error" role="alert">{listError}</p>}

        <div className="guest-table-wrap">
          <table className="guest-table roster-table">
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
                        <span className="guest-identity-text"><strong>{customer.name}</strong><span className="guest-identity-sub">{customer.phone}</span></span>
                      </div>
                    </td>
                    <td data-label="Visits" className="guest-cell-visits">{customer.visits}</td>
                    <td data-label="Tier"><span className="guest-tier" title={`${monthlyVisits} completed visits this month`} style={tierPillStyle(tier?.color)}>{tier?.label ?? 'New'}</span></td>
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
                      <button type="button" className="manager-action-secondary" onClick={() => openEdit(customer)}>Edit</button>
                      <button type="button" className="guest-danger" onClick={() => openDelete(customer)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="guest-empty-cell">
                    <span className="guest-empty-tile"><span className="material-symbols-outlined" aria-hidden="true">{customers.length === 0 ? 'group' : 'person_search'}</span></span>
                    <strong>{customers.length === 0 ? 'No guests yet' : 'No guests match'}</strong>
                    <p>{customers.length === 0
                      ? 'Guests register here automatically with their first booking. You can also add one by hand.'
                      : 'Try a different name, phone number, tier, or tag.'}</p>
                    {filtersActive && customers.length > 0 && (
                      <button type="button" className="manager-action-secondary" onClick={clearFilters}>Clear filters</button>
                    )}
                  </td>
                </tr>
              )}
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
                <p className="manager-eyebrow">{drawer.mode === 'create' ? 'NEW GUEST' : 'GUEST PROFILE'}</p>
                <h2>{drawer.mode === 'create' ? 'New guest profile' : drawer.original.name}</h2>
                {drawer.mode === 'edit' && (
                  <p className="guest-drawer-sub">
                    {editTier && <span className="guest-tier" style={tierPillStyle(editTier.color)}>{editTier.label}</span>}
                    <span>{monthlyVisitsByPhone[drawer.original.phone] ?? 0} completed visits this month</span>
                  </p>
                )}
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
              <button className="manager-action-primary" disabled={busy}>{busy ? 'Saving…' : drawer.mode === 'create' ? 'Create profile' : 'Save changes'}</button>
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
                <button type="button" className="manager-action-secondary" onClick={closeConfirm}>Cancel</button>
                <button className="guest-danger" disabled={busy}>{busy ? 'Verifying…' : 'Delete profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TableCollapseStyles />
      <style jsx global>{`
        /* Card — mirrors the staff roster card spec */
        .guest-manager{margin-bottom:20px}.guest-panel{padding:22px;border:1px solid #3b453b;border-radius:16px;background:linear-gradient(145deg,#1d251e,#171d18)}
        .guest-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}
        .manager-eyebrow{margin:0;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 93%,black);font-size:0.625rem;font-weight:700;letter-spacing:.16em}
        .guest-panel h2{margin:6px 0 0;font:500 1.375rem var(--font-playfair),Georgia,serif;letter-spacing:-.02em;color:#f2efe5}
        .guest-lede{margin:9px 0 0;color:#9daa9a;font-size:0.75rem;line-height:1.6;max-width:560px}
        /* Buttons — shared manager vocabulary */
        .manager-action-primary,.manager-action-secondary,.guest-danger{min-height:38px;padding:0 12px;border:1px solid #485447;border-radius:8px;background:#242c24;color:#e8e5da;font:600 0.6875rem inherit;cursor:pointer;white-space:nowrap}
        .manager-action-primary{min-height:44px;padding:0 16px;border-color:var(--restaurant-primary,#d7b46a);background:var(--restaurant-primary,#d7b46a);color:#241d0c}
        .manager-action-secondary:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}
        .manager-action-primary:disabled,.manager-action-secondary:disabled,.guest-danger:disabled{opacity:.55;cursor:wait}
        .guest-danger{border-color:#5f3d36;background:transparent;color:var(--terracotta-salmon)}.guest-danger:hover{border-color:var(--terracotta-salmon);color:#f0a99e}
        .manager-action-primary:focus-visible,.manager-action-secondary:focus-visible,.guest-danger:focus-visible,.guest-tag-option:focus-visible,.guest-filter:focus-visible,.guest-search-clear:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white);outline-offset:2px}
        /* Toolbar */
        .guest-toolbar{display:flex;align-items:center;gap:11px;margin:18px 0 6px;flex-wrap:wrap}
        .guest-search{position:relative;flex:1;min-width:220px;display:block}
        .guest-search .material-symbols-outlined{position:absolute;left:12px;top:50%;translate:0 -50%;font-size:17px;color:#9ba198;pointer-events:none}
        .guest-search input{width:100%;min-height:42px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;padding:0 34px 0 37px;font:inherit;font-size:0.75rem}
        .guest-search input::placeholder{color:#8d958b}
        .guest-search input:focus{outline:none;border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}
        .guest-search-clear{position:absolute;right:7px;top:50%;translate:0 -50%;width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#9ba198;cursor:pointer}
        .guest-search-clear:hover{color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 55%,white)}
        .guest-search-clear .material-symbols-outlined{font-size:15px;position:static;translate:none}
        .guest-filter{min-height:42px;min-width:136px;padding:0 11px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;font:inherit;font-size:0.75rem;cursor:pointer}
        .guest-filter:focus{outline:none;border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}
        .guest-count{margin-left:auto;font-size:0.6875rem;color:#9ba198;white-space:nowrap}
        .guest-save-state{font-size:0.6875rem;white-space:nowrap}
        .guest-save-state[data-status="saving"]{color:#9ba198}
        .guest-save-state[data-status="saved"]{color:var(--service-green)}
        .guest-save-state[data-status="error"]{color:var(--terracotta-salmon)}
        .guest-notice,.guest-error{margin:10px 0 0;font-size:0.6875rem;line-height:1.5}
        .guest-notice{color:var(--service-green)}.guest-error{color:var(--terracotta-salmon)}
        /* Table */
        .guest-table-wrap{overflow-x:auto}
        .guest-table{width:100%;border-collapse:collapse;font-size:0.8125rem}
        .guest-table th{padding:2px 12px 11px;border-bottom:1px solid #3b453b;color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-align:left;white-space:nowrap}
        .guest-table th.guest-th-actions{text-align:right}
        .guest-table td{padding:14px 12px;border-bottom:1px solid #2b322b;vertical-align:middle}
        .guest-table tbody tr{transition:background-color .15s ease}
        .guest-table tbody tr:hover{background:#1c241e}
        .guest-identity{display:flex;align-items:center;gap:11px;min-width:0}
        .guest-avatar{width:36px;height:36px;flex:0 0 36px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 40%,transparent);border-radius:9px;background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 9%,transparent);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 92%,white);font-size:0.6875rem;font-weight:700}
        .guest-identity-text{display:block;min-width:0}
        .guest-identity-text strong{display:block;font-size:0.875rem;color:#f4f1e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .guest-identity-sub{display:block;margin-top:3px;color:#9daa9a;font-size:0.6875rem;font-variant-numeric:tabular-nums}
        .guest-cell-visits{font-variant-numeric:tabular-nums;font-weight:600;font-size:0.875rem;color:#e8e5da}
        .guest-tier{display:inline-flex;align-items:center;border:1px solid;border-radius:999px;padding:5px 10px;font-size:0.625rem;font-weight:700;white-space:nowrap}
        .guest-tags{display:flex;gap:6px;flex-wrap:wrap;max-width:240px}
        .guest-tag-chip{display:inline-flex;align-items:center;border:1px solid color-mix(in srgb,var(--tag-color) 55%,transparent);border-radius:999px;padding:4px 9px;font-size:0.625rem;font-weight:700;color:var(--tag-color);background:color-mix(in srgb,var(--tag-color) 12%,transparent)}
        .guest-muted{color:#8b948a;font-size:0.6875rem}
        .guest-cell-note{max-width:260px}
        .guest-cell-note span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b9c0b4;font-size:0.75rem}
        .guest-cell-actions{display:flex;justify-content:flex-end;gap:8px;white-space:nowrap}
        .guest-cell-actions .manager-action-secondary,.guest-cell-actions .guest-danger{min-height:34px;padding:0 11px}
        /* Empty states */
        .guest-empty-cell{padding:34px 16px 30px;text-align:center}
        .guest-empty-tile{width:44px;height:44px;margin:0 auto;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,transparent);border-radius:11px;background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 9%,transparent);color:var(--restaurant-primary,#d7b46a)}
        .guest-empty-tile .material-symbols-outlined{font-size:20px}
        .guest-empty-cell strong{display:block;margin-top:12px;font-size:0.875rem;color:#f4f1e8}
        .guest-empty-cell p{margin:6px auto 0;color:#9daa9a;font-size:0.75rem;line-height:1.6;max-width:46ch}
        .guest-empty-cell .manager-action-secondary{margin-top:14px}
        /* Drawer */
        .drawer-backdrop{position:fixed;inset:0;background:#080a09c9;z-index:var(--z-backdrop);backdrop-filter:blur(3px)}
        .guest-drawer{position:fixed;top:0;right:0;bottom:0;z-index:calc(var(--z-backdrop) + 1);width:min(460px,100%);padding:22px;border-left:1px solid #3b453b;background:linear-gradient(145deg,#1d251e,#171d18);color:#f2efe5;overflow-y:auto;animation:guest-drawer-in .22s ease}
        @keyframes guest-drawer-in{from{transform:translateX(28px);opacity:0}to{transform:translateX(0);opacity:1}}
        .guest-drawer-inner{outline:none}
        .guest-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
        .guest-drawer-head h2{margin:6px 0 0;font:500 1.375rem var(--font-playfair),Georgia,serif;letter-spacing:-.02em}
        .guest-drawer-sub{display:flex;align-items:center;gap:9px;margin:10px 0 0;color:#9daa9a;font-size:0.6875rem}
        .guest-drawer-close{flex:0 0 auto;min-height:34px;min-width:34px;border:1px solid #485447;border-radius:8px;background:#242c24;color:#e8e5da;font:600 0.9375rem/1 inherit;cursor:pointer}
        .guest-drawer-close:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}
        .guest-drawer-form{display:grid;gap:15px;margin-top:18px}
        .guest-drawer-form label{display:grid;gap:7px;color:#e8e6dc;font-size:0.6875rem;font-weight:600}
        .guest-drawer-form input,.guest-drawer-form textarea{width:100%;min-height:42px;padding:9px 11px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;font:inherit;font-size:0.75rem}
        .guest-drawer-form textarea{resize:vertical;min-height:88px}
        .guest-drawer-form input:focus,.guest-drawer-form textarea:focus{outline:none;border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}
        .guest-drawer-form small{color:#9daa9a;font-size:0.625rem;font-weight:400}
        .guest-drawer-error{margin:0;font-size:0.6875rem;color:var(--terracotta-salmon)}
        .guest-drawer-tags{display:flex;gap:8px;flex-wrap:wrap}
        .guest-tag-option{border:1px solid #454c45;border-radius:999px;background:#202622;color:#abb2a8;padding:6px 11px;font-size:0.6875rem;font-weight:700;cursor:pointer;transition:.15s ease}
        .guest-tag-option:hover{border-color:color-mix(in srgb,var(--tag-color) 45%,transparent)}
        .guest-tag-option.active{color:var(--tag-color);border-color:color-mix(in srgb,var(--tag-color) 65%,transparent);background:color-mix(in srgb,var(--tag-color) 12%,transparent)}
        /* Confirm dialog — system modal spec */
        .guest-confirm-card{position:fixed;inset:0;z-index:calc(var(--z-backdrop) + 1);display:grid;place-items:center;padding:18px;pointer-events:none}
        .guest-confirm-inner{pointer-events:auto;width:min(430px,100%);padding:23px;border:1px solid #4b5148;border-radius:17px;background:#1d221e;color:#f2efe5;box-shadow:0 24px 90px #0009;outline:none;animation:guest-confirm-in .18s ease}
        @keyframes guest-confirm-in{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
        .guest-confirm-text{margin:14px 0 0;color:#aeb8ab;font-size:0.75rem;line-height:1.6}
        .guest-confirm-text strong{color:#f4f1e8}
        .guest-confirm-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:20px}
        @media(prefers-reduced-motion:reduce){.guest-drawer,.guest-confirm-inner{animation:none}.guest-table tbody tr{transition:none}}
        /* Mobile — mirrors the staff table collapse */
        @media(max-width:860px){.guest-panel{padding:17px}.guest-panel-heading{align-items:flex-start;flex-direction:column;gap:13px}.guest-search{min-width:100%}.guest-count{margin-left:0}.guest-empty-cell{display:block;text-align:left;padding:0}.guest-empty-cell::before{content:none}.guest-empty-tile{margin:0}.guest-cell-actions{display:flex;justify-content:flex-start;gap:8px}.guest-cell-note span{white-space:normal}}
      `}</style>
    </div>
  )
}
