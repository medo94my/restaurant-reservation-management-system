'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import type { CustomerProfile, OccasionTag, VisitTier } from '@/lib/restaurant-config'

type Props = {
  customers: CustomerProfile[]
  monthlyVisitsByPhone: Record<string, number>
  visitTiers: VisitTier[]
  occasionTags: OccasionTag[]
  onCustomersChange: (customers: CustomerProfile[]) => void
  onVisitTiersChange: (tiers: VisitTier[]) => void
  onOccasionTagsChange: (tags: OccasionTag[]) => void
}

const tagColors = ['#d69083', '#d7b46a', '#b4a0e0', '#8bb7a0', '#78a9c2', '#d38fae']

function getTier(visits: number, tiers: VisitTier[]) {
  return [...tiers].sort((left, right) => right.minVisits - left.minVisits).find((tier) => visits >= tier.minVisits) ?? tiers[0]
}

function makeTagId(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function GuestTagsManager({ customers, monthlyVisitsByPhone, visitTiers, occasionTags, onCustomersChange, onVisitTiersChange, onOccasionTagsChange }: Props) {
  const [search, setSearch] = useState('')
  const [tagLabel, setTagLabel] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestError, setGuestError] = useState('')

  const filteredCustomers = useMemo(() => customers.filter((customer) =>
    `${customer.name} ${customer.phone}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [customers, search])

  const regularMinimum = visitTiers.find((tier) => tier.id === 'regular')?.minVisits ?? 5
  const loyalMinimum = visitTiers.find((tier) => tier.id === 'loyal')?.minVisits ?? 10

  const updateVisitTier = (id: string, patch: Partial<VisitTier>) => {
    onVisitTiersChange(visitTiers.map((tier) => tier.id === id ? { ...tier, ...patch } : tier))
  }

  const addOccasionTag = () => {
    const label = tagLabel.trim()
    const id = makeTagId(label)
    if (!label || !id || occasionTags.some((tag) => tag.id === id)) return
    onOccasionTagsChange([...occasionTags, { id, label, color: tagColors[occasionTags.length % tagColors.length] }])
    setTagLabel('')
  }

  const removeOccasionTag = (tagId: string) => {
    onOccasionTagsChange(occasionTags.filter((tag) => tag.id !== tagId))
    onCustomersChange(customers.map((customer) => ({ ...customer, occasionTags: customer.occasionTags.filter((id) => id !== tagId) })))
  }

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
    <div className="guest-settings">
      <section className="guest-panel tier-panel">
        <div className="guest-panel-heading">
          <div><span className="guest-kicker">Guest segmentation</span><h2>Visit tiers</h2><p>Set the monthly visit count at which a guest becomes a regular or loyal guest.</p></div>
          <span className="guest-count">{customers.length} profiles</span>
        </div>
        <div className="tier-grid">
          {visitTiers.map((tier) => (
            <div className="tier-card" key={tier.id} style={{ borderTopColor: tier.color }}>
              <input className="tier-label-input" aria-label={`${tier.label} tier name`} maxLength={40} value={tier.label} style={{ color: tier.color }} onChange={(event) => updateVisitTier(tier.id, { label: event.target.value })} />
              {tier.id === 'new' ? (
                <span className="tier-fixed">Starting tier · 0 monthly visits</span>
              ) : (
                <span className="tier-input-wrap"><input
                  aria-label={`${tier.label} starts at monthly visits`}
                  type="number"
                  min={tier.id === 'regular' ? 1 : regularMinimum + 1}
                  max={tier.id === 'regular' ? Math.max(1, loyalMinimum - 1) : 999}
                  value={tier.minVisits}
                  onChange={(event) => updateVisitTier(tier.id, { minVisits: tier.id === 'regular' ? Math.min(Math.max(1, loyalMinimum - 1), Math.max(1, Number(event.target.value) || 0)) : Math.max(regularMinimum + 1, Number(event.target.value) || 0) })}
                /> monthly visits</span>
              )}
              <span className="tier-subtitle">{tier.id === 'new' ? 'Getting to know us' : tier.id === 'regular' ? 'A familiar face' : 'A cherished regular'}</span>
            </div>
          ))}
        </div>
        <div className="tier-note">Tier thresholds use completed visits this month. Lifetime guest visits are tracked separately.</div>
      </section>

      <section className="guest-panel occasion-panel">
        <div className="guest-panel-heading">
          <div><span className="guest-kicker">Personal touches</span><h2>Occasion tags</h2><p>Create tags such as birthdays, anniversaries, VIP, and VVIP, then assign them to guest profiles.</p></div>
        </div>
        <form className="tag-create" onSubmit={(event) => { event.preventDefault(); addOccasionTag() }}>
          <label className="sr-only" htmlFor="new-occasion-tag">New occasion tag name</label>
          <input id="new-occasion-tag" value={tagLabel} maxLength={40} placeholder="Add a tag, e.g. Graduation" onChange={(event) => setTagLabel(event.target.value)} />
          <button className="guest-button" type="submit" disabled={!tagLabel.trim()}>Add tag</button>
        </form>
        <div className="tag-catalog" aria-label="Occasion tag catalog">
          {occasionTags.map((tag) => (
            <span className="tag-chip" key={tag.id} style={{ color: tag.color, borderColor: `${tag.color}66`, background: `${tag.color}14` }}>
              {tag.label}<button type="button" aria-label={`Remove ${tag.label} tag`} onClick={() => removeOccasionTag(tag.id)}>×</button>
            </span>
          ))}
          {occasionTags.length === 0 && <span className="guest-empty">No occasion tags yet.</span>}
        </div>
      </section>

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
        <div className="guest-list">
  {filteredCustomers.map((customer) => {
    const monthlyVisits = monthlyVisitsByPhone[customer.phone] ?? 0
    const tier = getTier(monthlyVisits, visitTiers)
            return (
              <article className="guest-row" key={customer.phone}>
                <div className="guest-identity">
                  <span className="guest-avatar" aria-hidden="true">{customer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <span><strong>{customer.name}</strong><small>{customer.phone}</small></span>
                </div>
                <label className="visit-count"><span>Lifetime visits</span><input type="number" min={0} max={9999} aria-label={`${customer.name} visit count`} value={customer.visits} onChange={(event) => updateCustomer(customer.phone, { visits: Math.max(0, Math.min(9999, Number(event.target.value) || 0)) })} /></label>
                <span className="guest-tier" title={`${monthlyVisits} completed visits this month`} style={{ color: tier?.color, borderColor: `${tier?.color}66`, background: `${tier?.color}14` }}>{tier?.label ?? 'New'}</span>
                <label className="guest-note"><span className="sr-only">Notes for {customer.name}</span><input value={customer.note} maxLength={500} placeholder="Service note" onChange={(event) => updateCustomer(customer.phone, { note: event.target.value })} /></label>
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
                  {occasionTags.length === 0 && <span className="guest-empty">Create a tag above to assign one.</span>}
                </div>
              </article>
            )
          })}
          {filteredCustomers.length === 0 && <div className="guest-empty guest-no-results">No guests match your search.</div>}
        </div>
      </section>

      <style jsx>{`
        .guest-settings{display:flex;flex-direction:column;gap:14px;margin-bottom:20px}.guest-panel{border:1px solid #353d35;background:linear-gradient(150deg,#202521,#191d1a);border-radius:14px;padding:18px}.guest-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.guest-kicker{font-size:0.625rem;color:var(--restaurant-primary,#d6b66f);text-transform:uppercase;letter-spacing:.15em}.guest-panel h2{font:500 1.25rem var(--font-playfair),Georgia,serif;color:#eee9df;margin:6px 0}.guest-panel-heading p{font-size:0.6875rem;color:#9ca397;line-height:1.6;margin:0;max-width:600px}.guest-count{font-size:0.625rem;color:#d5bf7c;border:1px solid #655738;background:#2e2a1f;padding:7px 10px;border-radius:20px;white-space:nowrap}
        .tier-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-top:17px}.tier-card{min-height:112px;border:1px solid #3a413a;border-top:2px solid #888;border-radius:11px;background:#191e1a;padding:13px;display:flex;flex-direction:column;gap:8px}.tier-label-input{width:100%;height:24px;border:0;border-bottom:1px solid #414840;background:transparent;color:inherit;font-size:0.8125rem;font-weight:700;padding:0 0 4px;outline:none}.tier-label-input:focus{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black);box-shadow:0 0 0 2px var(--focus-ring)}.tier-input-wrap{font-size:0.6875rem;color:#9ea69a;display:flex;align-items:center;gap:7px}.tier-input-wrap input{width:67px;height:31px;border:1px solid #414840;border-radius:7px;background:#111612;color:#eee9df;padding:0 8px}.tier-fixed{font-size:0.6875rem;color:#c4c9bf}.tier-subtitle{margin-top:auto;font-size:0.625rem;color:#818a80}.tier-note{font-size:0.625rem;color:#828b81;margin-top:12px}
        .tag-create,.guest-create{display:flex;gap:8px;margin-top:15px}.tag-create input,.guest-create input,.guest-search input,.guest-note input{height:39px;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 11px;font:inherit;font-size:0.6875rem;min-width:0}.tag-create input{flex:1}.guest-button{min-height:39px;padding:0 13px;border:1px solid #8a7547;border-radius:8px;background:var(--restaurant-primary,#d7b46a);color:#241e11;font-size:0.6875rem;font-weight:700;white-space:nowrap;cursor:pointer}.guest-button:hover{background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}.guest-button:disabled{opacity:.45;cursor:not-allowed}.tag-catalog{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.tag-chip,.guest-tier{display:inline-flex;align-items:center;gap:6px;border:1px solid;border-radius:20px;padding:6px 9px;font-size:0.625rem;font-weight:600}.tag-chip button{width:17px;height:17px;border:0;border-radius:50%;background:transparent;color:inherit;font-size:0.9375rem;line-height:1;cursor:pointer}.tag-chip button:hover{background:#fff2}
        .profiles-heading{align-items:center}.guest-search input{width:min(250px,48vw)}.guest-create{margin:15px 0 7px}.guest-create label{flex:1;min-width:0}.guest-create input{width:100%}.guest-error{font-size:0.625rem;color:#ed9c91;margin:8px 0}.guest-list{display:flex;flex-direction:column;margin-top:10px}.guest-row{display:grid;grid-template-columns:minmax(145px,1.2fr) 72px 78px minmax(130px,1fr);gap:9px;align-items:center;border-top:1px solid #343b35;padding:12px 0}.guest-identity{display:flex;align-items:center;gap:9px;min-width:0}.guest-identity>span:last-child{display:flex;flex-direction:column;gap:4px;min-width:0}.guest-identity strong{font-size:0.6875rem;color:#ece9e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guest-identity small{font-size:0.625rem;color:#929a90}.guest-avatar{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border:1px solid #6d5a35;border-radius:10px;background:#393222;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 86%,white);font-size:0.625rem;font-weight:700}.visit-count{font-variant-numeric:tabular-nums;display:flex;flex-direction:column;gap:4px;font-size:0.625rem;color:#929a90}.visit-count input{width:100%;height:31px;border:1px solid #414840;border-radius:7px;background:#141916;color:#eee9df;padding:0 7px;font-size:0.6875rem}.guest-tier{justify-content:center;font-size:0.625rem;padding:6px 7px;white-space:nowrap}.guest-note input{width:100%;height:33px}.guest-tags{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;padding-left:43px}.guest-tag-option{border:1px solid #454c45;border-radius:20px;background:#202622;color:#abb2a8;padding:5px 8px;font-size:0.625rem;cursor:pointer}.guest-tag-option.active{color:var(--tag-color);border-color:color-mix(in srgb,var(--tag-color) 65%,transparent);background:color-mix(in srgb,var(--tag-color) 12%,transparent)}.guest-tag-option:focus-visible,.guest-button:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white);outline-offset:2px}.guest-empty{font-size:0.625rem;color:#899187}.guest-no-results{padding:20px 0;border-top:1px solid #343b35}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        @media(max-width:820px){.guest-row{grid-template-columns:minmax(130px,1.2fr) 68px 72px}.guest-note{grid-column:1/-1;padding-left:43px}.guest-tags{grid-column:1/-1}.guest-note input{max-width:none}.guest-search input{width:200px}}
        @media(max-width:560px){.guest-panel{padding:13px}.guest-panel-heading{align-items:flex-start;flex-direction:column;gap:9px}.profiles-heading{align-items:stretch}.guest-search input{width:100%}.tier-grid{grid-template-columns:1fr;gap:7px}.tier-card{min-height:0;display:grid;grid-template-columns:1fr 1fr;align-items:center}.tier-label-input{grid-column:1/-1}.tier-subtitle{margin:0}.tag-create,.guest-create{flex-wrap:wrap}.guest-create label{flex:1 1 44%}.guest-create .guest-button{flex:1}.guest-row{grid-template-columns:minmax(0,1fr) 62px 65px;gap:7px}.guest-tier{font-size:0.625rem}.guest-identity strong{font-size:0.625rem}.guest-tags,.guest-note{padding-left:0}.guest-note{grid-column:1/-1}.guest-tags{grid-column:1/-1}}
      `}</style>
    </div>
  )
}
