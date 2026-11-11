'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Unit } from '@/lib/restaurant-config'

const SHAPES = [
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'oval', label: 'Oval' },
  { value: 'long', label: 'Long' },
] as const

const statusColors: Record<Unit['status'], { fill: string; stroke: string; label: string }> = {
  available: { fill: '#263c30', stroke: '#78b38a', label: 'Available' },
  seated: { fill: '#32324a', stroke: '#a5a6ed', label: 'Seated' },
  prep: { fill: '#483c25', stroke: '#e5bd60', label: 'Prep needed' },
  blocked: { fill: '#343a36', stroke: '#89908a', label: 'Out of service' },
}

type Props = {
  tables: Unit[]
  editable?: boolean
  onChange?: (tables: Unit[]) => void
  onActivate?: (table: Unit) => void
}

export function EditableFloorPlan({ tables, editable = false, onChange, onActivate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(tables[0]?.id ?? null)
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingId = useRef<string | null>(null)
  const moved = useRef(false)
  const selected = tables.find((table) => table.id === selectedId) ?? null
  const visibleTables = tables.filter((table) => !table.archived)

  useEffect(() => {
    if (!tables.some((table) => table.id === selectedId)) setSelectedId(tables[0]?.id ?? null)
  }, [selectedId, tables])

  const updateTable = (id: string, patch: Partial<Unit>) => {
    if (patch.id && tables.some((table) => table.id !== id && table.id.trim().toLowerCase() === patch.id?.trim().toLowerCase())) return
    onChange?.(tables.map((table) => table.id === id ? { ...table, ...patch } : table))
    if (patch.id && selectedId === id) setSelectedId(patch.id)
  }

  const addTable = () => {
    const nextNumber = Math.max(0, ...tables.map((table) => Number(table.id.match(/\d+/)?.[0] ?? 0))) + 1
    const table: Unit = {
      id: `Table ${nextNumber}`,
      kind: 'Table',
      tableType: 'round',
      capacity: 4,
      status: 'available',
      x: 500,
      y: 300,
      rotation: 0,
    }
    onChange?.([...tables, table])
    setSelectedId(table.id)
  }

  const handlePointerDown = (event: PointerEvent<SVGGElement>, table: Unit) => {
    setSelectedId(table.id)
    if (!editable) return
    event.preventDefault()
    draggingId.current = table.id
    moved.current = false
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!editable || !draggingId.current || !svgRef.current) return
    const bounds = svgRef.current.getBoundingClientRect()
    const x = Math.min(945, Math.max(55, ((event.clientX - bounds.left) / bounds.width) * 1000))
    const y = Math.min(545, Math.max(55, ((event.clientY - bounds.top) / bounds.height) * 600))
    moved.current = true
    updateTable(draggingId.current, { x, y })
  }

  const handlePointerUp = () => {
    draggingId.current = null
    window.setTimeout(() => { moved.current = false }, 0)
  }

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, table: Unit) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (editable) setSelectedId(table.id)
    else onActivate?.(table)
  }

  return (
    <section className={`floor-plan ${editable ? 'is-editable' : ''}`} aria-label={editable ? 'Editable dining table floor plan' : 'Dining table floor plan'}>
      <div className="floor-plan-main">
        {editable && (
          <div className="floor-plan-toolbar">
            <div>
              <strong>Dining room</strong>
              <span>Drag tables to arrange the floor. Select a table to edit its details.</span>
            </div>
            <button className="floor-action" type="button" onClick={addTable}><span aria-hidden="true">＋</span> Add table</button>
          </div>
        )}
        <div className="floor-svg-wrap">
          <svg
            ref={svgRef}
            viewBox="0 0 1000 600"
            role="group"
            aria-label="Dining room table positions"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c9cbbf" strokeOpacity="0.055" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="1000" height="600" rx="18" fill="#151a16" />
            <rect width="1000" height="600" rx="18" fill="url(#floor-grid)" />
            <rect x="24" y="24" width="952" height="552" rx="12" fill="none" stroke="#81877b" strokeOpacity="0.16" strokeWidth="2" />
            <text x="48" y="52" fill="#899188" fontSize="12" letterSpacing="2">SAFFRON &amp; CEDAR · DINING ROOM</text>
            <text x="48" y="565" fill="#6e776e" fontSize="11">ENTRANCE</text>
            <path d="M 40 545 L 40 490 Q 40 460 70 460 L 105 460" fill="none" stroke="#81877b" strokeOpacity="0.35" strokeWidth="2" />
            {visibleTables.map((table) => {
              const palette = statusColors[table.status]
              const isSelected = editable && selectedId === table.id
              const common = { fill: palette.fill, stroke: isSelected ? '#f0d68e' : palette.stroke, strokeWidth: isSelected ? 3 : 2 }
              return (
                <g
                  key={table.id}
                  transform={`translate(${table.x} ${table.y}) rotate(${table.rotation})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${table.id}, ${SHAPES.find((shape) => shape.value === table.tableType)?.label ?? table.tableType} table for ${table.capacity}, ${palette.label}`}
                  className={`floor-table ${isSelected ? 'selected' : ''}`}
                  onPointerDown={(event) => handlePointerDown(event, table)}
                  onClick={() => {
                    if (moved.current) return
                    if (editable) setSelectedId(table.id)
                    else onActivate?.(table)
                  }}
                  onKeyDown={(event) => handleKeyDown(event, table)}
                >
                  {table.tableType === 'round' && <circle r="36" {...common} />}
                  {table.tableType === 'square' && <rect x="-34" y="-34" width="68" height="68" rx="10" {...common} />}
                  {table.tableType === 'rectangle' && <rect x="-48" y="-30" width="96" height="60" rx="11" {...common} />}
                  {table.tableType === 'oval' && <ellipse rx="49" ry="31" {...common} />}
                  {table.tableType === 'long' && <rect x="-62" y="-27" width="124" height="54" rx="10" {...common} />}
                  <text y="-2" textAnchor="middle" fill="#f0eee6" fontSize="13" fontWeight="700" pointerEvents="none">{table.id}</text>
                  <text y="15" textAnchor="middle" fill="#c1c9bd" fontSize="10" pointerEvents="none">{table.capacity} seats</text>
                  <circle cx="25" cy="-25" r="5" fill={palette.stroke} stroke="#151a16" strokeWidth="2" pointerEvents="none" />
                </g>
              )
            })}
          </svg>
        </div>
        <div className="floor-legend" aria-label="Table status legend">
          {Object.entries(statusColors).map(([status, palette]) => (
            <span key={status}><i style={{ background: palette.stroke }} />{palette.label}</span>
          ))}
          <span className="floor-availability">{visibleTables.filter((table) => table.status === 'available').length} of {visibleTables.length} tables available</span>
          <span className="floor-swipe-hint">Swipe across the floor to view all tables.</span>
        </div>
      </div>

      {editable && (
        <aside className="floor-inspector" aria-label="Selected table settings">
          {selected ? (
            <>
              <div className="inspector-eyebrow">Table settings</div>
              <h3>{selected.id}</h3>
              <label className="floor-field">Table name
                <input value={selected.id} maxLength={80} onChange={(event) => updateTable(selected.id, { id: event.target.value })} />
              </label>
              <label className="floor-field">Shape
                <select value={selected.tableType} onChange={(event) => updateTable(selected.id, { tableType: event.target.value as Unit['tableType'] })}>
                  {SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
                </select>
              </label>
              <label className="floor-field">Seats
                <input type="number" min={1} max={30} value={selected.capacity} onChange={(event) => updateTable(selected.id, { capacity: Math.min(30, Math.max(1, Number(event.target.value) || 1)) })} />
              </label>
              <label className="floor-field">Service status
                <select value={selected.status} onChange={(event) => updateTable(selected.id, { status: event.target.value as Unit['status'] })}>
                  <option value="available">Available</option>
                  <option value="seated">Seated</option>
                  <option value="prep">Prep needed</option>
                  <option value="blocked">Out of service</option>
                </select>
              </label>
              <div className="floor-inspector-actions">
                <button className="floor-action secondary" type="button" onClick={() => updateTable(selected.id, { rotation: (selected.rotation + 45) % 360 })}>Rotate</button>
                <button className="floor-action remove" type="button" onClick={() => {
                  const next = tables.filter((table) => table.id !== selected.id)
                  onChange?.(next)
                  setSelectedId(next[0]?.id ?? null)
                }}>Remove</button>
              </div>
              <p className="floor-hint">Position: {Math.round(selected.x)}, {Math.round(selected.y)} · drag the table to move it.</p>
            </>
          ) : (
            <div className="floor-empty">Add or select a table to edit the floor.</div>
          )}
        </aside>
      )}

      <style jsx>{`
        .floor-plan{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:14px;margin:0 0 18px;align-items:start}
        .floor-plan:not(.is-editable){display:block}
        .floor-plan-main{min-width:0;border:1px solid #343b35;background:#191e1a;border-radius:14px;padding:14px}
        .floor-plan-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:13px}
        .floor-plan-toolbar div{display:flex;flex-direction:column;gap:4px}.floor-plan-toolbar strong{font:500 17px Georgia,serif;color:#e6d19a}.floor-plan-toolbar span{font-size:11px;color:#92998f}
        .floor-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 12px;border:1px solid #806d42;border-radius:9px;background:#d7b46a;color:#241e11;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}
        .floor-action:hover{background:#e5c981}.floor-action.secondary{background:#242a25;color:#e3dfd3;border-color:#434a42}.floor-action.remove{background:transparent;color:#e19385;border-color:#69413b}
        .floor-svg-wrap{width:100%;overflow:auto;border-radius:12px}.floor-svg-wrap svg{display:block;width:100%;height:auto;touch-action:pan-x pan-y}.floor-table{outline:none;cursor:pointer;touch-action:none;transition:filter .15s}.floor-table:hover{filter:brightness(1.14)}.floor-table:focus-visible{filter:brightness(1.2)}.floor-table.selected{cursor:grab}.floor-table.selected:active{cursor:grabbing}
        .floor-legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 2px 1px;color:#a0a79d;font-size:10px}.floor-legend span{display:flex;align-items:center;gap:6px}.floor-legend i{width:8px;height:8px;border-radius:50%}.floor-availability{margin-left:auto;color:#d1bb7d}.floor-swipe-hint{display:none;color:#8b9488}
        .floor-inspector{border:1px solid #353d35;background:#1d231e;border-radius:13px;padding:15px}.inspector-eyebrow{font-size:9px;color:#d6b66f;text-transform:uppercase;letter-spacing:.14em}.floor-inspector h3{font:500 19px Georgia,serif;color:#f0ece1;margin:7px 0 16px}.floor-field{display:flex;flex-direction:column;gap:6px;margin:12px 0;color:#a4aa9e;font-size:10px}.floor-field input,.floor-field select{width:100%;height:37px;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 9px;font:inherit;font-size:12px}.floor-inspector-actions{display:flex;gap:7px;margin-top:16px}.floor-inspector-actions .floor-action{flex:1;padding:0 8px}.floor-hint,.floor-empty{font-size:10px;line-height:1.6;color:#858e84;margin:13px 0 0}.floor-empty{padding:12px 2px}
        @media(max-width:900px){.floor-plan.is-editable{grid-template-columns:1fr}.floor-inspector{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}.floor-inspector h3,.inspector-eyebrow,.floor-inspector-actions,.floor-hint,.floor-empty{grid-column:1/-1}.floor-inspector h3{margin-bottom:7px}}
        @media(max-width:560px){.floor-plan-main{padding:8px}.floor-plan-toolbar{align-items:flex-start;flex-direction:column}.floor-plan-toolbar span{line-height:1.5}.floor-svg-wrap svg{min-width:700px}.floor-legend{gap:9px;font-size:9px}.floor-availability{margin-left:0}.floor-swipe-hint{display:flex}.floor-inspector{grid-template-columns:1fr 1fr}.floor-field{font-size:9px}}
      `}</style>
    </section>
  )
}
