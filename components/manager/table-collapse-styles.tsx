'use client'

/**
 * Shared <860px table-collapse rules for the staff roster and guest list
 * tables. These rules were literal duplicates inside both components'
 * styled-jsx blocks; they key here on the `roster-table` marker class both
 * tables carry. Component-specific mobile rules (headings, action cells,
 * drawers) stay in each file's own media block.
 */
export function TableCollapseStyles() {
  return (
    <style jsx global>{`
      @media(max-width:860px){
        .roster-table thead{display:none}
        .roster-table tbody tr{display:grid;gap:12px;padding:16px 0;border-bottom:1px solid #2b322b}
        .roster-table tbody tr:last-child{border-bottom:0}
        .roster-table tbody tr:hover{background:transparent}
        .roster-table td{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:0 12px;padding:0;border:0}
        .roster-table td[data-label]::before{content:attr(data-label);color:#9ba198;font-size:0.625rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
      }
    `}</style>
  )
}
