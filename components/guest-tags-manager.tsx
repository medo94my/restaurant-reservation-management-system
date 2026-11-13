'use client'

import { useMemo, useState, type CSSProperties } from 'react'
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

export function GuestTagsManager({ customers, monthlyVisitsByPhone, visitTiers, occasionTags, onCustomersChange }: Props) {
  const [search, setSearch] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestError, setGuestError] = useState('')

  const filteredCustomers = useMemo(() => customers.filter((customer) =>
    `${customer.name} ${customer.phone}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [customers, search])

  const addGuest = () => {
    const phone = guestPhone.replace(/\D/g, '')
    if (!guestName.trim() || phone.length < 7) {
      setGuestError('Add a guest name and a valid phone number.')
      return
    }
    if (customers.some((customer) => customer.phone.replace(/\D/g, '') === phone)) {
      setGuestError('A guest with this phone number already exists.')
      return
    }
    onCustomersChange([{ phone, name: guestName.trim(), visits: 0, note: '', occasionTags: [] }, ...customers])
    setGuestName('')
    setGuestPhone('')
    setGuestError('')
  }

  const updateCustomer = (phone: string, patch: Partial<CustomerProfile>) => {
    onCustomersChange(customers.map((customer) => customer.phone === phone ? { ...customer, ...patch } : customer))
  }

  return (
    <div className="guest-manager">
      <section className="guest-panel profiles-panel">
        <div className="guest-panel-heading profiles-heading">
          <div><span className="guest-kicker">Guest book</span><h2>Guest profiles</h2><p>Update visit counts, notes, and the tags that help your team make each visit personal.</p></div>
          <label className="guest-search"><span className="sr-only">Search guest profiles</span><input value={search} placeholder="Search name or phone" onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        <form className="guest-create" onSubmit={(event) => { event.preventDefault(); addGuest() }}>
          <label><span className="sr-only">Guest name</span><input value={guestName} maxLength={100} placeholder="New guest name" onChange={(event) => setGuestName(event.target.value)} /></label>
          <label><span className="sr-only">Guest phone</span><input value={guestPhone} inputMode="tel" maxLength={24} placeholder="Phone number" onChange={(event) => setGuestPhone(event.target.value)} /></label>
          <button className="guest-button" type="submit">Add guest</button>
        </form>
        {guestError && <p className="guest-error" role="alert">{guestError}</p>}
        <div className="guest-table-wrap">
          <table className="guest-table">
            <thead>
              <tr><th scope="col">Guest</th><th scope="col">Lifetime visits</th><th scope="col">Tier</th><th scope="col">Tags</th><th scope="col">Note</th></tr>
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
                    <td data-label="Visits"><input className="guest-visits-input" type="number" min={0} max={9999} aria-label={`${customer.name} lifetime visit count`} value={customer.visits} onChange={(event) => updateCustomer(customer.phone, { visits: Math.max(0, Math.min(9999, Number(event.target.value) || 0)) })} /></td>
                    <td data-label="Tier"><span className="guest-tier" title={`${monthlyVisits} completed visits this month`} style={{ color: tier?.color, borderColor: `${tier?.color}66`, background: `${tier?.color}14` }}>{tier?.label ?? 'New'}</span></td>
                    <td data-label="Tags">
                      <div className="guest-tags" aria-label={`${customer.name} occasion tags`}>
                        {occasionTags.map((tag) => {
                          const active = customer.occasionTags.includes(tag.id)
                          return <button
                            type="button"
                            key={tag.id}
                            className={`guest-tag-option ${active ? 'active' : ''}`}
                            aria-pressed={active}
                            style={{ '--tag-color': tag.color } as CSSProperties}
                            onClick={() => updateCustomer(customer.phone, { occasionTags: active ? customer.occasionTags.filter((id) => id !== tag.id) : [...customer.occasionTags, tag.id] })}
                          >{tag.label}</button>
                        })}
                        {occasionTags.length === 0 && <span className="guest-empty">Create tags in Settings first.</span>}
                      </div>
                    </td>
                    <td data-label="Note"><input className="guest-note-input" value={customer.note} maxLength={500} placeholder="Service note" aria-label={`Service note for ${customer.name}`} onChange={(event) => updateCustomer(customer.phone, { note: event.target.value })} /></td>
                  </tr>
                )
              })}
              {filteredCustomers.length === 0 && <tr><td colSpan={5} className="guest-empty-cell">{customers.length === 0 ? 'No guests yet. Add your first guest above.' : 'No guests match your search.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <style jsx global>{`
        .guest-manager{margin-bottom:20px}.guest-panel{border:1px solid #353d35;background:linear-gradient(150deg,#202521,#191d1a);border-radius:14px;padding:18px}.guest-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.guest-kicker{font-size:0.625rem;color:var(--restaurant-primary,#d6b66f);text-transform:uppercase;letter-spacing:.15em}.guest-panel h2{font:500 1.25rem var(--font-playfair),Georgia,serif;color:#eee9df;margin:6px 0}.guest-panel-heading p{font-size:0.6875rem;color:#9ca397;line-height:1.6;margin:0;max-width:600px}
        .profiles-heading{align-items:center}.guest-search input{width:min(250px,48vw);height:39px;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 11px;font:inherit;font-size:0.6875rem;min-width:0}.guest-create{display:flex;gap:8px;margin:15px 0 7px}.guest-create label{flex:1;min-width:0}.guest-create input{width:100%;height:39px;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 11px;font:inherit;font-size:0.6875rem;min-width:0}.guest-create input:focus,.guest-search input:focus,.guest-visits-input:focus,.guest-note-input:focus{outline:none;box-shadow:0 0 0 3px var(--focus-ring);border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}.guest-button{min-height:39px;padding:0 13px;border:1px solid #8a7547;border-radius:8px;background:var(--restaurant-primary,#d7b46a);color:#241e11;font-size:0.6875rem;font-weight:700;white-space:nowrap;cursor:pointer}.guest-button:hover{background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}.guest-button:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}.guest-error{font-size:0.625rem;color:#ed9c91;margin:8px 0}
        .guest-table-wrap{overflow-x:auto}.guest-table{width:100%;border-collapse:collapse;font-size:0.8125rem}.guest-table th{padding:2px 12px 11px;border-bottom:1px solid #3b453b;color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-align:left;white-space:nowrap}.guest-table td{padding:13px 12px;border-bottom:1px solid #2b322b;vertical-align:middle}.guest-table tbody tr:hover{background:#1c241e}.guest-empty-cell{text-align:center;color:#9eaa9d;font-size:0.75rem;padding:24px 12px}
        .guest-identity{display:flex;align-items:center;gap:9px;min-width:0}.guest-identity>span:last-child{display:flex;flex-direction:column;gap:4px;min-width:0}.guest-identity strong{font-size:0.75rem;color:#ece9e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guest-identity small{font-size:0.625rem;color:#929a90}.guest-avatar{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border:1px solid #6d5a35;border-radius:10px;background:#393222;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 86%,white);font-size:0.625rem;font-weight:700}
        .guest-visits-input{width:76px;height:33px;border:1px solid #414840;border-radius:7px;background:#141916;color:#eee9df;padding:0 8px;font:inherit;font-size:0.6875rem;font-variant-numeric:tabular-nums}.guest-tier{display:inline-flex;align-items:center;gap:6px;border:1px solid;border-radius:20px;padding:6px 9px;font-size:0.625rem;font-weight:600;justify-content:center;white-space:nowrap}
        .guest-tags{display:flex;gap:6px;flex-wrap:wrap;max-width:360px}.guest-tag-option{border:1px solid #454c45;border-radius:20px;background:#202622;color:#abb2a8;padding:5px 8px;font-size:0.625rem;cursor:pointer}.guest-tag-option.active{color:var(--tag-color);border-color:color-mix(in srgb,var(--tag-color) 65%,transparent);background:color-mix(in srgb,var(--tag-color) 12%,transparent)}.guest-tag-option:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}.guest-note-input{width:100%;min-width:120px;height:33px;border:1px solid #414840;border-radius:7px;background:#141916;color:#eee9df;padding:0 11px;font:inherit;font-size:0.6875rem}.guest-empty{font-size:0.6875rem;color:#9eaa9d}
        @media(max-width:860px){.guest-panel{padding:17px}.guest-table thead{display:none}.guest-table tbody tr{display:grid;gap:12px;padding:16px 0;border-bottom:1px solid #2b322b}.guest-table tbody tr:last-child{border-bottom:0}.guest-table tbody tr:hover{background:transparent}.guest-table td{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:0 12px;padding:0;border:0}.guest-table td::before{content:attr(data-label);color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.guest-empty-cell{display:block;text-align:left;padding:0}.guest-empty-cell::before{content:none}.guest-tags{max-width:none}}
        @media(max-width:560px){.guest-panel{padding:13px}.guest-panel-heading{align-items:flex-start;flex-direction:column;gap:9px}.profiles-heading{align-items:stretch}.guest-search input{width:100%}.guest-create{flex-wrap:wrap}.guest-create label{flex:1 1 44%}.guest-create .guest-button{flex:1}.guest-identity strong{font-size:0.6875rem}}
      `}</style>
    </div>
  )
}
