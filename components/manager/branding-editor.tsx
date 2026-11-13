'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import useSWR from 'swr'
import { DEFAULT_BRANDING, hasAccessibleBrandingContrast, type RestaurantBranding } from '@/lib/branding'

async function fetchBranding(url: string): Promise<{ branding: RestaurantBranding }> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load branding settings.')
  return response.json()
}

export function BrandingEditor() {
  const { data, error, isLoading, mutate } = useSWR('/api/branding', fetchBranding)
  const [draft, setDraft] = useState<RestaurantBranding>(DEFAULT_BRANDING)
  const [isDirty, setIsDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (data && !isDirty) setDraft(data.branding)
  }, [data, isDirty])

  function updateDraft(patch: Partial<RestaurantBranding>) {
    setDraft((current) => ({ ...current, ...patch }))
    setIsDirty(true)
    setNotice('')
  }

  async function save(action: 'save' | 'publish') {
    setBusy(true)
    setFormError('')
    setNotice('')
    try {
      const response = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, branding: draft }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to save branding.')
      setIsDirty(false)
      setNotice(action === 'publish' ? 'Branding is now published to the hostess portal.' : 'Draft saved. The hostess portal still shows the published brand.')
      await mutate({ branding: draft }, { revalidate: false })
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Unable to save branding.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setFormError('')
    setNotice('')
    try {
      const formData = new FormData()
      formData.set('file', file)
      const response = await fetch('/api/branding/logo', { method: 'POST', body: formData })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to upload logo.')
      updateDraft({ logo: result.logo })
      setNotice('Logo uploaded. Save the draft to keep it, then publish when ready.')
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Unable to upload logo.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const palette = draft.palette
  const paletteAccessible = hasAccessibleBrandingContrast(draft)
  const fontFamily = draft.font === 'serif' ? 'Georgia, serif' : draft.font === 'system' ? 'system-ui, sans-serif' : 'var(--font-dm-sans), sans-serif'

  return (
    <main className="branding-editor">
      <header className="branding-heading"><div><p className="manager-eyebrow">PUBLISHED EXPERIENCE</p><h1>Restaurant branding</h1><p>Shape the hostess portal, preview every change, and publish only when you’re ready.</p></div><span className="draft-state">{isDirty ? 'Unsaved draft' : 'Synced'}</span></header>
      {isLoading && <p className="branding-state">Loading current branding…</p>}
      {error && <p className="branding-error" role="alert">{error.message}</p>}
      <div className="branding-grid">
        <section className="branding-form-card" aria-labelledby="identity-title">
          <div className="branding-section-heading"><div><p className="manager-eyebrow">01 · IDENTITY</p><h2 id="identity-title">Restaurant details</h2></div></div>
          <label>Restaurant name<input maxLength={80} value={draft.restaurantName} onChange={(event) => updateDraft({ restaurantName: event.target.value })} /></label>
          <label>Tagline<input maxLength={120} value={draft.tagline} onChange={(event) => updateDraft({ tagline: event.target.value })} /></label>
          <div className="branding-divider" />
          <div className="branding-section-heading"><div><p className="manager-eyebrow">02 · LOGO</p><h2>Logo asset</h2></div></div>
          {draft.logo ? <div className="logo-current"><img src={draft.logo.url} alt="Current restaurant logo" /><div><strong>Logo ready</strong><span>{Math.round(draft.logo.size / 1024)} KB · {draft.logo.contentType}</span></div><button type="button" onClick={() => updateDraft({ logo: null })}>Remove</button></div> : <p className="branding-hint">Upload a PNG, JPEG, WebP, or AVIF image, up to 2 MB.</p>}
          <label className="upload-control">{busy ? 'Working…' : draft.logo ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={uploadLogo} disabled={busy} /></label>
          <div className="branding-divider" />
          <div className="branding-section-heading"><div><p className="manager-eyebrow">03 · VISUAL SYSTEM</p><h2>Color palette</h2></div></div>
          <div className="color-fields">{([['primary', 'Primary'], ['background', 'Background'], ['surface', 'Surface'], ['text', 'Text']] as const).map(([key, label]) => <label className="color-field" key={key}><span>{label}</span><span className="color-picker"><input type="color" value={palette[key]} aria-label={`${label} color`} onChange={(event) => updateDraft({ palette: { ...palette, [key]: event.target.value } })} /><code>{palette[key].toUpperCase()}</code></span></label>)}</div>
          <label className="font-select">Typography<select value={draft.font} onChange={(event) => updateDraft({ font: event.target.value as RestaurantBranding['font'] })}><option value="sans">Clean sans</option><option value="serif">Editorial serif</option><option value="system">System default</option></select></label>
          {!paletteAccessible && <p className="branding-error" role="alert">Adjust the palette until text and buttons meet a 4.5:1 contrast ratio before saving.</p>}
          {formError && <p className="branding-error" role="alert">{formError}</p>}
          {notice && <p className="branding-notice" role="status">{notice}</p>}
          <div className="branding-actions"><button type="button" className="branding-save" disabled={busy || isLoading || !paletteAccessible} onClick={() => void save('save')}>Save draft</button><button type="button" className="branding-publish" disabled={busy || isLoading || !paletteAccessible} onClick={() => void save('publish')}>{busy ? 'Saving…' : 'Publish to hostess portal'}</button></div>
        </section>
        <section className="branding-preview-card" aria-labelledby="preview-title">
          <div className="branding-preview-heading"><div><p className="manager-eyebrow">LIVE PREVIEW</p><h2 id="preview-title">Host stand</h2></div><span className="preview-badge">DRAFT</span></div>
          <div className="brand-preview" style={{ background: palette.background, color: palette.text, fontFamily }}>
            <div className="preview-top"><div className="preview-brand-mark" style={{ background: palette.primary, color: palette.background }}>{draft.logo ? <img src={draft.logo.url} alt="Restaurant logo preview" /> : draft.restaurantName.slice(0, 1).toUpperCase()}</div><div><strong>{draft.restaurantName || 'Restaurant name'}</strong><span>{draft.tagline || 'Your tagline'}</span></div></div>
            <div className="preview-content"><span className="preview-eyebrow" style={{ color: palette.primary }}>EVENING SERVICE · LIVE</span><h3>Your floor,<br />beautifully in rhythm.</h3><p>Reservations, arrivals, and guest details in one clear view.</p><button style={{ background: palette.primary, color: palette.background }}>New reservation</button></div>
            <div className="preview-surface" style={{ background: palette.surface }}><span>TONIGHT’S ARRIVALS</span><strong>06:30 PM <em>Table 04 · 2 guests</em></strong><strong>07:00 PM <em>Garden room · 4 guests</em></strong></div>
          </div>
          <p className="branding-preview-note">Previewing the draft. The hostess portal changes only after publishing.</p>
        </section>
      </div>
      <style jsx global>{`
        .branding-editor{color:#f2efe5}.branding-heading,.branding-preview-heading,.branding-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.branding-heading{margin-bottom:24px}.branding-heading h1{margin:6px 0;font:500 clamp(1.625rem,4vw,2.25rem)/1.1 var(--font-playfair),Georgia,serif;letter-spacing:-.025em}.branding-heading>div>p:last-child{margin:8px 0 0;color:#aeb8ab;font-size:0.8125rem;line-height:1.6}.draft-state,.preview-badge{padding:8px 11px;border:1px solid #4b5548;border-radius:999px;color:#c6cfbf;font-size:0.625rem;white-space:nowrap}.branding-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.9fr);gap:clamp(18px,2vw,32px);align-items:start}.branding-form-card,.branding-preview-card{padding:22px;border:1px solid #3b453b;border-radius:16px;background:#1a211b}.branding-section-heading h2,.branding-preview-heading h2{margin:5px 0 16px;font:500 1.25rem var(--font-playfair),Georgia,serif}.branding-form-card>label:not(.upload-control),.font-select{display:grid;gap:7px;margin-bottom:15px;color:#e8e6dc;font-size:0.6875rem;font-weight:600}.branding-form-card input:not([type="file"]):not([type="color"]),.branding-form-card select{min-height:42px;padding:0 11px;border:1px solid #4a554b;border-radius:8px;background:#141a15;color:#f4f1e8;font:inherit}.branding-form-card input:focus,.branding-form-card select:focus{outline:none;box-shadow:0 0 0 3px var(--focus-ring);border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black)}.branding-divider{height:1px;margin:21px 0;background:#354034}.branding-hint,.branding-state{color:#9eaa9d;font-size:0.6875rem;line-height:1.5}.logo-current{display:flex;align-items:center;gap:12px;margin:12px 0}.logo-current img{width:54px;height:54px;object-fit:contain;border:1px solid #414d41;border-radius:10px;background:#111713}.logo-current div{display:grid;gap:4px;flex:1}.logo-current strong{font-size:0.75rem}.logo-current span{color:#9eaa9d;font-size:0.625rem}.logo-current button{border:0;background:transparent;color:#e7a79a;font-size:0.625rem;cursor:pointer}.upload-control{position:relative;display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:1px solid #485447;border-radius:8px;color:#d8dfd3;font-size:0.6875rem;font-weight:600;cursor:pointer}.upload-control input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.color-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.color-field{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;border:1px solid #354034;border-radius:9px;color:#d3d9ce;font-size:0.625rem}.color-picker{display:flex;align-items:center;gap:7px}.color-picker input{width:26px;height:26px;padding:0;border:0;background:transparent}.color-picker code{color:#aeb9aa;font-size:0.625rem}.font-select{margin-top:16px}.branding-actions{display:flex;gap:10px;margin-top:18px}.branding-save,.branding-publish{min-height:42px;padding:0 13px;border:1px solid #4b5649;border-radius:8px;background:transparent;color:#e7e6dc;font-size:0.6875rem;font-weight:700;cursor:pointer}.branding-publish{flex:1;border-color:var(--restaurant-primary,#d7b46a);background:var(--restaurant-primary,#d7b46a);color:#211b0d}.branding-actions button:disabled{opacity:.55;cursor:wait}.branding-error,.branding-notice{font-size:0.6875rem;line-height:1.5}.branding-error{color:#ffb7aa}.branding-notice{color:#9dd3a8}.branding-preview-card{position:sticky;top:20px}.branding-preview-heading h2{margin-bottom:0}.preview-badge{color:#e1c17c;border-color:#78633c}.brand-preview{min-height:430px;margin-top:18px;padding:20px;border:1px solid #40483e;border-radius:14px;overflow:hidden}.preview-top{display:flex;align-items:center;gap:11px}.preview-brand-mark{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;font:700 18px Georgia,serif;overflow:hidden}.preview-brand-mark img{width:100%;height:100%;object-fit:contain}.preview-top>div:last-child{display:grid;gap:3px}.preview-top strong{font-size:13px}.preview-top span{opacity:.62;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.preview-content{max-width:350px;margin:54px auto 30px}.preview-eyebrow{font-size:9px;font-weight:700;letter-spacing:.14em}.preview-content h3{margin:13px 0 10px;font:500 clamp(27px,3vw,38px)/1.08 Georgia,serif;letter-spacing:-.03em}.preview-content p{max-width:270px;opacity:.72;font-size:11px;line-height:1.6}.preview-content button{min-height:37px;margin-top:8px;padding:0 13px;border:0;border-radius:8px;font:600 10px inherit}.preview-surface{display:grid;gap:10px;padding:15px;border-radius:10px}.preview-surface>span{opacity:.55;font-size:8px;font-weight:700;letter-spacing:.14em}.preview-surface strong{display:flex;justify-content:space-between;gap:12px;font-size:0.625rem}.preview-surface em{opacity:.62;font-style:normal;font-weight:400}.branding-preview-note{margin:12px 0 0;color:#99a497;font-size:0.625rem;line-height:1.5}
        @media(max-width:900px){.branding-grid{grid-template-columns:1fr}.branding-preview-card{position:static}}@media(max-width:540px){.branding-form-card,.branding-preview-card{padding:16px}.branding-heading{align-items:flex-start;flex-direction:column}.color-fields{grid-template-columns:1fr}.branding-actions{flex-direction:column}}
      `}</style>
    </main>
  )
}
