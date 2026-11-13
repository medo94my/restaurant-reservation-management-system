'use client'

import { useState } from 'react'
import type { CustomerProfile, OccasionTag, VisitTier } from '@/lib/restaurant-config'

const tagColors = ['#d69083', '#d7b46a', '#b4a0e0', '#8bb7a0', '#78a9c2', '#d38fae']

function makeTagId(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type VisitTiersProps = {
  visitTiers: VisitTier[]
  customerCount: number
  onVisitTiersChange: (tiers: VisitTier[]) => void
}

/** Visit-tier thresholds — lives on the Settings page, never on the guests page. */
export function VisitTiersEditor({ visitTiers, customerCount, onVisitTiersChange }: VisitTiersProps) {
  const regularMinimum = visitTiers.find((tier) => tier.id === 'regular')?.minVisits ?? 5
  const loyalMinimum = visitTiers.find((tier) => tier.id === 'loyal')?.minVisits ?? 10

  const updateVisitTier = (id: string, patch: Partial<VisitTier>) => {
    onVisitTiersChange(visitTiers.map((tier) => tier.id === id ? { ...tier, ...patch } : tier))
  }

  return (
    <section className="guest-panel tier-panel">
      <div className="guest-panel-heading">
        <div><span className="guest-kicker">Guest segmentation</span><h2>Visit tiers</h2><p>Set the monthly visit count at which a guest becomes a regular or loyal guest.</p></div>
        <span className="guest-count">{customerCount} profiles</span>
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
      <style jsx global>{`
        .guest-panel{border:1px solid #353d35;background:linear-gradient(150deg,#202521,#191d1a);border-radius:14px;padding:18px}.guest-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.guest-kicker{font-size:0.625rem;color:var(--restaurant-primary,#d6b66f);text-transform:uppercase;letter-spacing:.15em}.guest-panel h2{font:500 1.25rem var(--font-playfair),Georgia,serif;color:#eee9df;margin:6px 0}.guest-panel-heading p{font-size:0.6875rem;color:#9ca397;line-height:1.6;margin:0;max-width:600px}.guest-count{font-size:0.625rem;color:#d5bf7c;border:1px solid #655738;background:#2e2a1f;padding:7px 10px;border-radius:20px;white-space:nowrap}
        .tier-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-top:17px}.tier-card{min-height:112px;border:1px solid #3a413a;border-top:2px solid #888;border-radius:11px;background:#191e1a;padding:13px;display:flex;flex-direction:column;gap:8px}.tier-label-input{width:100%;height:24px;border:0;border-bottom:1px solid #414840;background:transparent;color:inherit;font-size:0.8125rem;font-weight:700;padding:0 0 4px;outline:none}.tier-label-input:focus{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black);box-shadow:0 0 0 2px var(--focus-ring)}.tier-input-wrap{font-size:0.6875rem;color:#9ea69a;display:flex;align-items:center;gap:7px}.tier-input-wrap input{width:67px;height:31px;border:1px solid #414840;border-radius:7px;background:#111612;color:#eee9df;padding:0 8px}.tier-fixed{font-size:0.6875rem;color:#c4c9bf}.tier-subtitle{margin-top:auto;font-size:0.625rem;color:#818a80}.tier-note{font-size:0.625rem;color:#828b81;margin-top:12px}
        .guest-button{min-height:39px;padding:0 13px;border:1px solid #8a7547;border-radius:8px;background:var(--restaurant-primary,#d7b46a);color:#241e11;font-size:0.6875rem;font-weight:700;white-space:nowrap;cursor:pointer}.guest-button:hover{background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}.guest-button:disabled{opacity:.45;cursor:not-allowed}.guest-button:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}
        .guest-empty{font-size:0.6875rem;color:#9eaa9d}
        @media(max-width:560px){.guest-panel{padding:13px}.guest-panel-heading{align-items:flex-start;flex-direction:column;gap:9px}.tier-grid{grid-template-columns:1fr;gap:7px}.tier-card{min-height:0;display:grid;grid-template-columns:1fr 1fr;align-items:center}.tier-label-input{grid-column:1/-1}.tier-subtitle{margin:0}}
      `}</style>
    </section>
  )
}

type OccasionTagsProps = {
  occasionTags: OccasionTag[]
  customers: CustomerProfile[]
  onOccasionTagsChange: (tags: OccasionTag[]) => void
  onCustomersChange: (customers: CustomerProfile[]) => void
}

/** Occasion tag catalog — lives on the Settings page; guests only assign these tags. */
export function OccasionTagsEditor({ occasionTags, customers, onOccasionTagsChange, onCustomersChange }: OccasionTagsProps) {
  const [tagLabel, setTagLabel] = useState('')

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

  return (
    <section className="guest-panel occasion-panel">
      <div className="guest-panel-heading">
        <div><span className="guest-kicker">Personal touches</span><h2>Occasion tags</h2><p>Create tags such as birthdays, anniversaries, VIP, and VVIP, then assign them to guest profiles on the guests page.</p></div>
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
      <style jsx global>{`
        .guest-panel{border:1px solid #353d35;background:linear-gradient(150deg,#202521,#191d1a);border-radius:14px;padding:18px}.guest-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.guest-kicker{font-size:0.625rem;color:var(--restaurant-primary,#d6b66f);text-transform:uppercase;letter-spacing:.15em}.guest-panel h2{font:500 1.25rem var(--font-playfair),Georgia,serif;color:#eee9df;margin:6px 0}.guest-panel-heading p{font-size:0.6875rem;color:#9ca397;line-height:1.6;margin:0;max-width:600px}
        .tag-create{display:flex;gap:8px;margin-top:15px}.tag-create input{height:39px;flex:1;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 11px;font:inherit;font-size:0.6875rem;min-width:0}.guest-button{min-height:39px;padding:0 13px;border:1px solid #8a7547;border-radius:8px;background:var(--restaurant-primary,#d7b46a);color:#241e11;font-size:0.6875rem;font-weight:700;white-space:nowrap;cursor:pointer}.guest-button:hover{background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}.guest-button:disabled{opacity:.45;cursor:not-allowed}.guest-button:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}
        .tag-catalog{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.tag-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid;border-radius:20px;padding:6px 9px;font-size:0.625rem;font-weight:600}.tag-chip button{width:17px;height:17px;border:0;border-radius:50%;background:transparent;color:inherit;font-size:0.9375rem;line-height:1;cursor:pointer}.tag-chip button:hover{background:#fff2}
        .guest-empty{font-size:0.6875rem;color:#9eaa9d}
        @media(max-width:560px){.guest-panel{padding:13px}.guest-panel-heading{align-items:flex-start;flex-direction:column;gap:9px}.tag-create{flex-wrap:wrap}}
      `}</style>
    </section>
  )
}
