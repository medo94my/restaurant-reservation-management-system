'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { BrandingEditor } from '@/components/manager/branding-editor'
import { OccasionTagsEditor, VisitTiersEditor } from '@/components/manager/guest-config-panels'
import type { CustomerProfile, OccasionTag, RestaurantConfig, Unit, VisitTier } from '@/lib/restaurant-config'

type SettingsTab = 'branding' | 'tiers' | 'tags'
type ConfigResponse = { config: (Omit<RestaurantConfig, 'customers'> & { customers?: CustomerProfile[] }) | null }

async function fetchConfig(url: string): Promise<ConfigResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load restaurant settings.')
  return response.json()
}

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'branding', label: 'Branding' },
  { id: 'tiers', label: 'Visit tiers' },
  { id: 'tags', label: 'Occasion tags' },
]

const SAVE_DEBOUNCE_MS = 650

export function SettingsEditor() {
  const { data, error, isLoading } = useSWR('/api/restaurant-config', fetchConfig)
  const [tab, setTab] = useState<SettingsTab>('branding')
  const [visitTiers, setVisitTiers] = useState<VisitTier[]>([])
  const [occasionTags, setOccasionTags] = useState<OccasionTag[]>([])
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const floorItems = useRef<Unit[]>([])
  const lastSaved = useRef('')
  const configApplied = useRef(false)

  useEffect(() => {
    if (!data?.config || configApplied.current) return
    configApplied.current = true
    floorItems.current = data.config.floorItems
    setVisitTiers(data.config.visitTiers)
    setOccasionTags(data.config.occasionTags)
    setCustomers(data.config.customers ?? [])
    lastSaved.current = JSON.stringify({ visitTiers: data.config.visitTiers, occasionTags: data.config.occasionTags, customers: data.config.customers ?? [] })
  }, [data])

  // Auto-save: the PUT validates the whole workspace config, so every save
  // carries the untouched floor plan + guest book along with the edited slices.
  useEffect(() => {
    if (!configApplied.current) return
    const snapshot = JSON.stringify({ visitTiers, occasionTags, customers })
    if (snapshot === lastSaved.current) return
    const payload: RestaurantConfig = { floorItems: floorItems.current, customers, visitTiers, occasionTags }
    const timer = window.setTimeout(() => {
      setSaveStatus('saving')
      fetch('/api/restaurant-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = await response.json().catch(() => null)
            throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to save restaurant settings.')
          }
          lastSaved.current = snapshot
          setSaveStatus('saved')
        })
        .catch(() => setSaveStatus('error'))
    }, SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [visitTiers, occasionTags, customers])

  const statusLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'All changes saved' : saveStatus === 'error' ? 'Save failed' : 'Synced'

  return (
    <main className="settings-editor">
      <header className="settings-heading">
        <div><p className="manager-eyebrow">WORKSPACE SETUP</p><h1>Settings</h1><p>Brand identity and guest segmentation for your restaurant, saved as you edit.</p></div>
        <span className="settings-state" data-status={saveStatus}>{statusLabel}</span>
      </header>
      {isLoading && <p className="settings-note">Loading restaurant settings…</p>}
      {error && <p className="settings-error" role="alert">{error.message}</p>}
      {saveStatus === 'error' && <p className="settings-error" role="alert">Your last change could not be saved. Edit again to retry.</p>}
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      {tab === 'branding' && <BrandingEditor />}
      {tab === 'tiers' && !isLoading && !error && (
        <VisitTiersEditor visitTiers={visitTiers} customerCount={customers.length} onVisitTiersChange={setVisitTiers} />
      )}
      {tab === 'tags' && !isLoading && !error && (
        <OccasionTagsEditor occasionTags={occasionTags} customers={customers} onOccasionTagsChange={setOccasionTags} onCustomersChange={setCustomers} />
      )}
      <style jsx global>{`
        .settings-editor{color:#f2efe5}
        .settings-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.settings-heading h1{margin:6px 0;font:500 clamp(1.625rem,4vw,2.25rem)/1.1 var(--font-playfair),Georgia,serif;letter-spacing:-.025em}.settings-heading>div>p:last-child{margin:8px 0 0;color:#aeb8ab;font-size:0.8125rem;line-height:1.6}
        .settings-state{padding:8px 11px;border:1px solid #4b5548;border-radius:999px;color:#c6cfbf;font-size:0.625rem;white-space:nowrap}.settings-state[data-status="saved"]{border-color:#3f5a45;color:#9dd3a8}.settings-state[data-status="error"]{border-color:#5f3d36;color:#e07d72}
        .settings-note{color:#9eaa9d;font-size:0.75rem}.settings-error{color:#ffb7aa;font-size:0.6875rem;margin:0 0 12px}
        .settings-tabs{display:flex;gap:8px;margin:0 0 20px;flex-wrap:wrap}.settings-tabs button{min-height:38px;padding:0 15px;border:1px solid #465044;border-radius:999px;background:transparent;color:#c5cdbf;font:600 0.6875rem inherit;cursor:pointer}.settings-tabs button:hover{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 42%,white)}.settings-tabs button.active{border-color:var(--restaurant-primary,#d7b46a);color:var(--restaurant-primary,#d7b46a);background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 10%,transparent)}.settings-tabs button:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white)}
        @media(max-width:540px){.settings-heading{align-items:flex-start;flex-direction:column}}
      `}</style>
    </main>
  )
}
