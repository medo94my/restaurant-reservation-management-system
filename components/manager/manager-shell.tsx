'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { StaffAccountBar } from '@/components/auth/staff-auth'

type Props = { staff: { name: string; staffId: string; role: string }; children: ReactNode }

export function ManagerShell({ staff, children }: Props) {
  return (
    <div className="manager-shell">
      <StaffAccountBar profile={staff} />
      <header className="manager-shell-header">
        <Link className="manager-shell-brand" href="/manager"><span className="manager-shell-mark" aria-hidden="true">S</span><span><strong>Saffron &amp; Cedar</strong><small>Manager workspace</small></span></Link>
        <nav className="manager-nav" aria-label="Manager workspace">
          <Link href="/manager">Operations</Link>
          <Link href="/manager/staff">Staff</Link>
          <Link href="/manager/branding">Branding</Link>
          <Link href="/hostess">Host stand</Link>
        </nav>
      </header>
      <div className="manager-shell-content">{children}</div>
      <style jsx global>{`
        .manager-shell{min-height:100vh;background:#111713;color:#f1eee5;font-family:var(--md-ref-typeface-plain,Arial,sans-serif)}
        .manager-shell-header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:14px clamp(18px,4vw,52px);border-bottom:1px solid #30392f;background:#171e18}
        .manager-shell-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none}.manager-shell-brand>span:last-child{display:grid;gap:3px}.manager-shell-brand strong{font:600 17px Georgia,serif}.manager-shell-brand small{color:#9eaa9d;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
        .manager-shell-mark{width:38px;height:38px;display:grid;place-items:center;border:1px solid #8d7648;border-radius:12px;background:#d7b46a18;color:#d7b46a;font:700 20px Georgia,serif}
        .manager-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.manager-nav a{padding:9px 12px;border-radius:8px;color:#bdc5bb;font-size:12px;text-decoration:none}.manager-nav a:hover,.manager-nav a:focus-visible{background:#293229;color:#f4e4bb;outline:none}
        .manager-shell-content{max-width:1500px;margin:0 auto;padding:28px clamp(16px,3vw,36px) 48px}
        @media(max-width:700px){.manager-shell-header{align-items:flex-start;flex-direction:column;gap:14px}.manager-nav{width:100%;justify-content:space-between}.manager-nav a{padding:8px 6px;font-size:11px}.manager-shell-content{padding-top:20px}}
      `}</style>
    </div>
  )
}
