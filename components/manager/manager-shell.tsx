'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { StaffAccountActions } from '@/components/auth/staff-auth'

type Props = { staff: { name: string; staffId: string; role: string }; children: ReactNode }

const NAV_ITEMS = [
  { href: '/manager', label: 'Operations', icon: 'monitoring' },
  { href: '/manager/staff', label: 'Staff', icon: 'badge' },
  { href: '/manager/branding', label: 'Branding', icon: 'palette' },
  { href: '/hostess', label: 'Host stand', icon: 'event_seat' },
]

export function ManagerShell({ staff, children }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className={`manager-shell${open ? ' sidebar-open' : ''}`}>
      <aside className="manager-sidebar" aria-label="Manager workspace">
        <div className="sidebar-head">
          <Link className="manager-shell-brand" href="/manager" aria-label="Saffron &amp; Cedar — Operations">
            <span className="manager-shell-mark" aria-hidden="true">S</span>
            {open && <span className="sidebar-brand-text"><strong>Saffron &amp; Cedar</strong><small>Manager workspace</small></span>}
          </Link>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="material-symbols-outlined" aria-hidden="true">{open ? 'menu_open' : 'menu'}</span>
          </button>
        </div>

        <nav className="manager-nav" aria-label="Manager workspace">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/manager'
              ? pathname.startsWith('/manager') && !pathname.startsWith('/manager/staff') && !pathname.startsWith('/manager/branding')
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'active' : undefined}
                aria-current={active ? 'page' : undefined}
                title={open ? undefined : item.label}
                aria-label={open ? undefined : item.label}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <StaffAccountActions profile={staff} compact={!open} />
        </div>
      </aside>

      <div className="manager-shell-content">{children}</div>

      <style jsx global>{`
        .manager-shell{display:grid;grid-template-columns:68px minmax(0,1fr);min-height:100vh;background:#111713;color:#f1eee5;font-family:var(--font-dm-sans),sans-serif;transition:grid-template-columns .18s ease}
        .manager-sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:16px;padding:16px 12px;background:#171e18;border-right:1px solid #30392f;overflow:hidden}
        .manager-shell.sidebar-open{grid-template-columns:250px minmax(0,1fr)}
        .sidebar-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .manager-shell:not(.sidebar-open) .sidebar-head{flex-direction:column;gap:12px}
        .manager-shell-brand{display:flex;align-items:center;gap:12px;min-width:0;color:inherit;text-decoration:none}
        .sidebar-brand-text{display:grid;gap:3px;min-width:0}
        .sidebar-brand-text strong{font:600 0.9375rem Georgia,serif;white-space:nowrap}
        .sidebar-brand-text small{color:#9eaa9d;font-size:0.625rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
        .manager-shell-mark{width:38px;height:38px;flex:0 0 auto;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 66%,black);border-radius:12px;background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 9.4%,transparent);color:var(--restaurant-primary,#d7b46a);font:700 1.25rem Georgia,serif}
        .sidebar-toggle{width:32px;height:32px;flex:0 0 auto;display:grid;place-items:center;padding:0;border:1px solid #475248;border-radius:8px;background:transparent;color:#bdc5bb;cursor:pointer}
        .sidebar-toggle:hover{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 92%,black);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 83%,white)}
        .sidebar-toggle .material-symbols-outlined{font-size:18px}
        .manager-nav{display:flex;flex-direction:column;gap:4px}
        .manager-nav a{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;color:#bdc5bb;font-size:0.8125rem;text-decoration:none;white-space:nowrap}
        .manager-nav a .material-symbols-outlined{font-size:19px;flex:0 0 auto}
        .manager-nav a:hover,.manager-nav a:focus-visible{background:#293229;color:#f4e4bb;outline:none}
        .manager-nav a.active{background:#293229;color:#f4e4bb}
        .manager-shell:not(.sidebar-open) .manager-nav a{justify-content:center;padding:10px 0}
        .manager-shell:not(.sidebar-open) .sidebar-label{display:none}
        .sidebar-foot{margin-top:auto}
        .manager-shell.sidebar-open .sidebar-foot .staff-account-actions{align-items:flex-start}
        .manager-shell.sidebar-open .staff-account-identity{text-align:left}
        .manager-shell-content{min-width:0;max-width:1500px;margin:0 auto;padding:28px clamp(16px,3vw,36px) 48px}
        @media(max-width:700px){.manager-shell-content{padding-top:20px}}
      `}</style>
    </div>
  )
}
