'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { CouchShape, RoomUnit, TableShape, TableUnit, Unit } from '@/lib/restaurant-config'

const SHAPES: { value: TableShape; label: string }[] = [
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'oval', label: 'Oval' },
  { value: 'long', label: 'Long' },
]

const COUCH_SHAPES: { value: CouchShape; label: string }[] = [
  { value: 'loveseat', label: 'Loveseat' },
  { value: 'sofa', label: 'Sofa' },
]

const statusColors: Record<Unit['status'], { stroke: string; label: string }> = {
  available: { stroke: '#78b38a', label: 'Available' },
  seated: { stroke: '#a5a6ed', label: 'Seated' },
  prep: { stroke: '#e5bd60', label: 'Prep needed' },
  blocked: { stroke: '#89908a', label: 'Out of service' },
}

const TABLE_DIMENSIONS: Record<TableShape, { width: number; height: number }> = {
  round: { width: 72, height: 72 },
  square: { width: 68, height: 68 },
  rectangle: { width: 106, height: 68 },
  oval: { width: 108, height: 68 },
  long: { width: 132, height: 62 },
}

type SeatPosition = { x: number; y: number; rotation: number }

type Props = {
  items: Unit[]
  editable?: boolean
  onChange?: (items: Unit[]) => void
  onActivate?: (item: Unit) => void
}

function getTableSeats(table: Pick<TableUnit, 'tableType' | 'capacity'>): SeatPosition[] {
  const { width, height } = TABLE_DIMENSIONS[table.tableType]

  // Round to 6 decimals: Math.cos/sin/atan2 can differ by 1 ULP between the
  // server's V8 and the browser's engine, and React compares the rendered
  // `transform` string byte-for-byte during hydration.
  const stableSeat = ({ x, y, rotation }: SeatPosition): SeatPosition => ({
    x: Math.round(x * 1e6) / 1e6,
    y: Math.round(y * 1e6) / 1e6,
    rotation: Math.round(rotation * 1e6) / 1e6,
  })

  if (table.tableType === 'round' || table.tableType === 'oval') {
    return Array.from({ length: table.capacity }, (_, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / table.capacity)
      const x = Math.cos(angle) * (width / 2 + 15)
      const y = Math.sin(angle) * (height / 2 + 15)
      return stableSeat({ x, y, rotation: Math.atan2(x, -y) * (180 / Math.PI) })
    })
  }

  const counts = [0, 0, 0, 0]
  for (let index = 0; index < table.capacity; index += 1) counts[index % counts.length] += 1
  const seats: SeatPosition[] = []
  const addSide = (side: number, count: number) => {
    for (let index = 0; index < count; index += 1) {
      const fraction = (index + 1) / (count + 1)
      if (side === 0) seats.push({ x: (fraction - 0.5) * width, y: -height / 2 - 13, rotation: 0 })
      if (side === 1) seats.push({ x: (fraction - 0.5) * width, y: height / 2 + 13, rotation: 180 })
      if (side === 2) seats.push({ x: -width / 2 - 13, y: (fraction - 0.5) * height, rotation: 270 })
      if (side === 3) seats.push({ x: width / 2 + 13, y: (fraction - 0.5) * height, rotation: 90 })
    }
  }
  counts.forEach(addSide)
  return seats.map(stableSeat)
}

function Chair({ seat }: { seat: SeatPosition }) {
  return (
    <g transform={`translate(${seat.x} ${seat.y}) rotate(${seat.rotation})`} aria-hidden="true">
      <rect x="-9" y="-12" width="18" height="7" rx="3" fill="#72543a" stroke="#c7a06a" strokeWidth="1.5" />
      <rect x="-7.5" y="-7" width="15" height="15" rx="3.5" fill="url(#chair-seat)" stroke="#715238" strokeWidth="1.4" />
      <path d="M -5 5 V 10 M 5 5 V 10" fill="none" stroke="#5b4533" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  )
}

function TableAsset({ item, showLabel = true }: { item: TableUnit; showLabel?: boolean }) {
  const { width, height } = TABLE_DIMENSIONS[item.tableType]
  return (
    <g aria-hidden="true">
      {getTableSeats(item).map((seat, index) => <Chair key={`${item.id}-seat-${index}`} seat={seat} />)}
      {item.tableType === 'round' && <>
        <circle r="35" fill="url(#table-top)" stroke="#806044" strokeWidth="3" />
        <circle r="29" fill="none" stroke="#efd2a1" strokeOpacity=".26" strokeWidth="1.4" />
        <path d="M -18 -12 Q 0 -18 18 -12" fill="none" stroke="#f1d6aa" strokeOpacity=".22" strokeWidth="1.4" />
      </>}
      {item.tableType === 'square' && <>
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="10" fill="url(#table-top)" stroke="#806044" strokeWidth="3" />
        <rect x={-width / 2 + 6} y={-height / 2 + 6} width={width - 12} height={height - 12} rx="6" fill="none" stroke="#efd2a1" strokeOpacity=".24" />
      </>}
      {item.tableType === 'rectangle' && <>
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="12" fill="url(#table-top)" stroke="#806044" strokeWidth="3" />
        <path d={`M ${-width / 2 + 12} -8 H ${width / 2 - 12}`} stroke="#efd2a1" strokeOpacity=".2" strokeWidth="1.5" />
      </>}
      {item.tableType === 'oval' && <>
        <ellipse rx={width / 2} ry={height / 2} fill="url(#table-top)" stroke="#806044" strokeWidth="3" />
        <ellipse rx={width / 2 - 7} ry={height / 2 - 7} fill="none" stroke="#efd2a1" strokeOpacity=".24" />
      </>}
      {item.tableType === 'long' && <>
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="11" fill="url(#table-top)" stroke="#806044" strokeWidth="3" />
        <path d={`M ${-width / 2 + 12} -9 H ${width / 2 - 12} M ${-width / 2 + 12} 9 H ${width / 2 - 12}`} stroke="#efd2a1" strokeOpacity=".18" />
      </>}
      {showLabel && <>
        <text y="-2" textAnchor="middle" fill="#fff3dc" fontSize="11" fontWeight="700" pointerEvents="none">{item.id}</text>
        <text y="14" textAnchor="middle" fill="#f0ddbc" fontSize="9" pointerEvents="none">{item.capacity} seats</text>
      </>}
    </g>
  )
}

function CouchAsset({ item }: { item: Extract<Unit, { kind: 'Couch' }> }) {
  const width = item.couchType === 'loveseat' ? 104 : Math.max(126, 82 + item.capacity * 24)
  const height = 66
  const armWidth = 14
  const cushionArea = width - armWidth * 2 - 12
  const cushionWidth = cushionArea / item.capacity
  return (
    <g aria-hidden="true">
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="17" fill="#704841" stroke="#bd8a70" strokeWidth="2.5" />
      <rect x={-width / 2 + armWidth} y={-height / 2 + 4} width={width - armWidth * 2} height="19" rx="8" fill="#a86454" stroke="#d09a7d" strokeWidth="1.2" />
      {Array.from({ length: item.capacity }, (_, index) => {
        const x = -width / 2 + armWidth + 6 + index * cushionWidth
        return <g key={`${item.id}-cushion-${index}`}>
          <rect x={x} y="-9" width={cushionWidth - 3} height="28" rx="6" fill="url(#couch-cushion)" stroke="#6a453d" strokeWidth="1.2" />
          <path d={`M ${x + 5} -5 V 12`} stroke="#f0b6a0" strokeOpacity=".35" strokeWidth="1.2" />
        </g>
      })}
      <rect x={-width / 2 + 3} y={-height / 2 + 7} width={armWidth} height={height - 14} rx="6" fill="#915849" stroke="#c68a72" strokeWidth="1.3" />
      <rect x={width / 2 - armWidth - 3} y={-height / 2 + 7} width={armWidth} height={height - 14} rx="6" fill="#915849" stroke="#c68a72" strokeWidth="1.3" />
      <rect x={-width / 2 + 17} y="20" width={width - 34} height="7" rx="3" fill="#5d4039" opacity=".75" />
      <text y={height / 2 + 14} textAnchor="middle" fill="#d5b5a7" fontSize="9" fontWeight="600">{item.id} · {item.capacity} seats</text>
    </g>
  )
}

function RoomAsset({ item }: { item: RoomUnit }) {
  const left = -item.roomWidth / 2
  const top = -item.roomHeight / 2
  const table: TableUnit = {
    id: `${item.id} table`,
    kind: 'Table',
    tableType: item.tableType,
    capacity: item.capacity,
    status: item.status,
    x: item.x,
    y: item.y,
    rotation: 0,
  }
  return (
    <g aria-hidden="true">
      <rect x={left + 5} y={top + 5} width={item.roomWidth - 10} height={item.roomHeight - 10} rx="8" fill="#222b24" stroke="#445147" strokeWidth="1" />
      <rect x={left} y={top} width={item.roomWidth} height={item.roomHeight} rx="9" fill="none" stroke="#a8a38a" strokeWidth="8" />
      <rect x={-17} y={item.roomHeight / 2 - 6} width="34" height="12" fill="#222b24" />
      <path d={`M -17 ${item.roomHeight / 2} V ${item.roomHeight / 2 - 26} A 26 26 0 0 1 9 ${item.roomHeight / 2}`} fill="none" stroke="#b8b39a" strokeOpacity=".78" strokeWidth="1.5" />
      <g transform="scale(.72)"><TableAsset item={table} showLabel={false} /></g>
      <text x={left + 12} y={top + 19} fill="#e6d19a" fontSize="10" fontWeight="700">{item.id}</text>
      <text x={left + 12} y={top + 33} fill="#9ea99b" fontSize="8">PRIVATE DINING · {item.capacity} SEATS</text>
    </g>
  )
}

export function EditableFloorPlan({ items, editable = false, onChange, onActivate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const draggingId = useRef<string | null>(null)
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)
  const moved = useRef(false)
  const selected = items.find((item) => item.id === selectedId) ?? null
  const visibleItems = items.filter((item) => !item.archived)

  useEffect(() => {
    if (!items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null)
  }, [selectedId, items])

  const updateItem = (id: string, patch: Partial<Unit>) => {
    if (patch.id && items.some((item) => item.id !== id && item.id.trim().toLowerCase() === patch.id?.trim().toLowerCase())) return
    onChange?.(items.map((item) => item.id === id ? { ...item, ...patch } as Unit : item))
    if (patch.id && selectedId === id) setSelectedId(patch.id)
  }

  const addItem = (kind: Unit['kind']) => {
    const nextNumber = Math.max(0, ...items.filter((item) => item.kind === kind).map((item) => Number(item.id.match(/\d+/)?.[0] ?? 0))) + 1
    const id = `${kind} ${nextNumber}`
    const position = kind === 'Room' ? { x: 815, y: 470 } : kind === 'Couch' ? { x: 810, y: 390 } : { x: 500, y: 300 }
    const base = { id, status: 'available' as const, capacity: kind === 'Room' ? 4 : 2, ...position, rotation: 0 }
    const item: Unit = kind === 'Table'
      ? { ...base, kind, tableType: 'round' }
      : kind === 'Couch'
        ? { ...base, kind, couchType: 'loveseat' }
        : { ...base, kind, roomWidth: 190, roomHeight: 140, tableType: 'round' }
    onChange?.([...items, item])
    setSelectedId(item.id)
  }

  const handleItemPointerDown = (event: PointerEvent<SVGGElement>, item: Unit) => {
    setSelectedId(item.id)
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    draggingId.current = item.id
    panStart.current = null
    moved.current = false
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const handleCanvasPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!editable || (event.target as Element).closest('.floor-item')) return
    const wrap = wrapRef.current
    if (!wrap) return
    event.preventDefault()
    draggingId.current = null
    moved.current = false
    panStart.current = { x: event.clientX, y: event.clientY, scrollLeft: wrap.scrollLeft, scrollTop: wrap.scrollTop }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!editable || !svgRef.current) return
    const wrap = wrapRef.current
    if (panStart.current && wrap) {
      const deltaX = event.clientX - panStart.current.x
      const deltaY = event.clientY - panStart.current.y
      if (Math.abs(deltaX) + Math.abs(deltaY) > 2) moved.current = true
      wrap.scrollLeft = panStart.current.scrollLeft - deltaX
      wrap.scrollTop = panStart.current.scrollTop - deltaY
      return
    }
    if (!draggingId.current) return
    const item = items.find((candidate) => candidate.id === draggingId.current)
    if (!item) return
    const bounds = svgRef.current.getBoundingClientRect()
    const scaleX = 1000 / bounds.width
    const scaleY = 600 / bounds.height
    const halfWidth = item.kind === 'Room' ? item.roomWidth / 2 + 15 : item.kind === 'Couch' ? 80 : 85
    const halfHeight = item.kind === 'Room' ? item.roomHeight / 2 + 15 : item.kind === 'Couch' ? 50 : 55
    const x = Math.min(1000 - halfWidth, Math.max(halfWidth, (event.clientX - bounds.left) * scaleX))
    const y = Math.min(600 - halfHeight, Math.max(halfHeight, (event.clientY - bounds.top) * scaleY))
    moved.current = true
    updateItem(draggingId.current, { x, y })
  }

  const handlePointerUp = () => {
    draggingId.current = null
    panStart.current = null
    window.setTimeout(() => { moved.current = false }, 0)
  }

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, item: Unit) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (editable) setSelectedId(item.id)
    else onActivate?.(item)
  }

  const handleClick = (item: Unit) => {
    if (moved.current) return
    if (editable) setSelectedId(item.id)
    else onActivate?.(item)
  }

  const availableCount = visibleItems.filter((item) => item.status === 'available').length

  return (
    <section className={`floor-plan ${editable ? 'is-editable' : ''}`} aria-label={editable ? 'Editable restaurant floor plan' : 'Restaurant floor plan'}>
      <div className="floor-plan-main">
        {editable && (
          <div className="floor-plan-toolbar">
            <div>
              <strong>Dining room</strong>
              <span>Drag furniture to move it. Drag the open floor to pan; scrolling pauses while you work.</span>
            </div>
            <div className="floor-add-actions">
              <button className="floor-action" type="button" onClick={() => addItem('Table')}>＋ Table</button>
              <button className="floor-action" type="button" onClick={() => addItem('Couch')}>＋ Couch</button>
              <button className="floor-action" type="button" onClick={() => addItem('Room')}>＋ Room</button>
            </div>
          </div>
        )}
        <div className="floor-svg-wrap" ref={wrapRef}>
          <svg
            ref={svgRef}
            viewBox="0 0 1000 600"
            role="group"
            aria-label={editable ? 'Restaurant floor plan; drag an empty area to pan while editing' : 'Restaurant floor plan; swipe to view all spaces'}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c9cbbf" strokeOpacity="0.055" strokeWidth="1" />
              </pattern>
              <linearGradient id="table-top" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#b98955" />
                <stop offset=".48" stopColor="#9a6d42" />
                <stop offset="1" stopColor="#785134" />
              </linearGradient>
              <linearGradient id="chair-seat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d1ae78" />
                <stop offset="1" stopColor="#9e754b" />
              </linearGradient>
              <linearGradient id="couch-cushion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#cf806b" />
                <stop offset="1" stopColor="#a95f53" />
              </linearGradient>
            </defs>
            <rect width="1000" height="600" rx="18" fill="#151a16" />
            <rect width="1000" height="600" rx="18" fill="url(#floor-grid)" />
            <rect x="24" y="24" width="952" height="552" rx="12" fill="none" stroke="#81877b" strokeOpacity="0.16" strokeWidth="2" />
            <text x="48" y="52" fill="#899188" fontSize="12" letterSpacing="2" pointerEvents="none">SAFFRON &amp; CEDAR · DINING ROOM</text>
            <text x="48" y="565" fill="#6e776e" fontSize="11" pointerEvents="none">ENTRANCE</text>
            <path d="M 40 545 L 40 490 Q 40 460 70 460 L 105 460" fill="none" stroke="#81877b" strokeOpacity="0.35" strokeWidth="2" pointerEvents="none" />
            {visibleItems.map((item) => {
              const palette = statusColors[item.status]
              const isSelected = editable && selectedId === item.id
              const itemLabel = item.kind === 'Table'
                ? `${item.id}, ${SHAPES.find((shape) => shape.value === item.tableType)?.label} table`
                : item.kind === 'Couch'
                  ? `${item.id}, ${item.couchType} couch`
                  : `${item.id}, enclosed private dining room`
              return (
                <g
                  key={item.id}
                  transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${itemLabel} for ${item.capacity} seats, ${palette.label}`}
                  className={`floor-item ${isSelected ? 'selected' : ''}`}
                  onPointerDown={(event) => handleItemPointerDown(event, item)}
                  onClick={() => handleClick(item)}
                  onKeyDown={(event) => handleKeyDown(event, item)}
                >
                  {isSelected && <circle r={item.kind === 'Room' ? Math.max(item.roomWidth, item.roomHeight) / 2 + 12 : item.kind === 'Couch' ? 82 : 82} fill="none" stroke="#f0d68e" strokeOpacity=".7" strokeWidth="1.5" strokeDasharray="5 5" pointerEvents="none" />}
                  {item.kind === 'Table' && <TableAsset item={item} />}
                  {item.kind === 'Couch' && <CouchAsset item={item} />}
                  {item.kind === 'Room' && <RoomAsset item={item} />}
                  <circle cx={item.kind === 'Room' ? item.roomWidth / 2 - 13 : item.kind === 'Couch' ? 38 : 24} cy={item.kind === 'Room' ? -item.roomHeight / 2 + 13 : item.kind === 'Couch' ? -22 : -22} r="5" fill={palette.stroke} stroke="#151a16" strokeWidth="2" pointerEvents="none" />
                </g>
              )
            })}
          </svg>
        </div>
        <div className="floor-legend" aria-label="Space status legend">
          {Object.entries(statusColors).map(([status, palette]) => (
            <span key={status}><i style={{ background: palette.stroke }} />{palette.label}</span>
          ))}
          <span className="floor-availability">{availableCount} of {visibleItems.length} spaces available</span>
          <span className="floor-swipe-hint">{editable ? 'Drag empty floor to pan the plan.' : 'Swipe horizontally to view all spaces.'}</span>
        </div>
      </div>

      {editable && (
        <aside className="floor-inspector" aria-label="Selected space settings">
          {selected ? (
            <>
              <div className="inspector-eyebrow">{selected.kind} settings</div>
              <h3>{selected.id}</h3>
              <label className="floor-field">Name
                <input value={selected.id} maxLength={80} onChange={(event) => updateItem(selected.id, { id: event.target.value })} />
              </label>
              {selected.kind === 'Table' && <label className="floor-field">Table shape
                <select value={selected.tableType} onChange={(event) => updateItem(selected.id, { tableType: event.target.value as TableShape })}>
                  {SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
                </select>
              </label>}
              {selected.kind === 'Couch' && <label className="floor-field">Couch style
                <select value={selected.couchType} onChange={(event) => updateItem(selected.id, { couchType: event.target.value as CouchShape })}>
                  {COUCH_SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
                </select>
              </label>}
              {selected.kind === 'Room' && <>
                <label className="floor-field">Room width
                  <input type="number" min={150} max={320} step={10} value={selected.roomWidth} onChange={(event) => updateItem(selected.id, { roomWidth: Math.min(320, Math.max(150, Number(event.target.value) || 150)) })} />
                </label>
                <label className="floor-field">Room depth
                  <input type="number" min={120} max={240} step={10} value={selected.roomHeight} onChange={(event) => updateItem(selected.id, { roomHeight: Math.min(240, Math.max(120, Number(event.target.value) || 120)) })} />
                </label>
                <label className="floor-field">Dining table shape
                  <select value={selected.tableType} onChange={(event) => updateItem(selected.id, { tableType: event.target.value as TableShape })}>
                    {SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
                  </select>
                </label>
              </>}
              <label className="floor-field">Visible seats
                <input type="number" min={1} max={30} value={selected.capacity} onChange={(event) => updateItem(selected.id, { capacity: Math.min(30, Math.max(1, Number(event.target.value) || 1)) })} />
              </label>
              <label className="floor-field">Service status
                <select value={selected.status} onChange={(event) => updateItem(selected.id, { status: event.target.value as Unit['status'] })}>
                  <option value="available">Available</option>
                  <option value="seated">Seated</option>
                  <option value="prep">Prep needed</option>
                  <option value="blocked">Out of service</option>
                </select>
              </label>
              <div className="floor-inspector-actions">
                <button className="floor-action secondary" type="button" onClick={() => updateItem(selected.id, { rotation: (selected.rotation + 45) % 360 })}>Rotate</button>
                <button className="floor-action remove" type="button" onClick={() => {
                  const next = items.filter((item) => item.id !== selected.id)
                  onChange?.(next)
                  setSelectedId(next[0]?.id ?? null)
                }}>Remove</button>
              </div>
              <p className="floor-hint">Position: {Math.round(selected.x)}, {Math.round(selected.y)} · drag the furniture to move it.</p>
            </>
          ) : (
            <div className="floor-empty">Add or select furniture to edit the floor.</div>
          )}
        </aside>
      )}

      <style jsx>{`
        .floor-plan{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:14px;margin:0 0 18px;align-items:start}
        .floor-plan:not(.is-editable){display:block}
        .floor-plan-main{min-width:0;border:1px solid #343b35;background:#191e1a;border-radius:14px;padding:14px}
        .floor-plan-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:13px}
        .floor-plan-toolbar div:first-child{display:flex;flex-direction:column;gap:4px}.floor-plan-toolbar strong{font:500 1.25rem var(--font-playfair),Georgia,serif;color:#e6d19a}.floor-plan-toolbar span{font-size:0.6875rem;color:#92998f}
        .floor-add-actions{display:flex;gap:7px;flex-wrap:wrap}.floor-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 12px;border:1px solid #806d42;border-radius:9px;background:var(--restaurant-primary,#d7b46a);color:#241e11;font-size:0.6875rem;font-weight:700;white-space:nowrap;cursor:pointer}
        .floor-action:hover{background:#e5c981}.floor-action.secondary{background:#242a25;color:#e3dfd3;border-color:#434a42}.floor-action.remove{background:transparent;color:#e19385;border-color:#69413b}
        .floor-svg-wrap{width:100%;overflow:auto;border-radius:12px;overscroll-behavior:contain}.floor-svg-wrap svg{display:block;width:100%;height:auto;touch-action:pan-x pan-y}.is-editable .floor-svg-wrap svg{touch-action:none;cursor:grab}.is-editable .floor-svg-wrap svg:active{cursor:grabbing}.floor-item{outline:none;cursor:pointer;touch-action:auto;transition:filter .15s}.is-editable .floor-item{touch-action:none}.floor-item:hover{filter:brightness(1.1)}.floor-item:focus-visible{filter:brightness(1.18)}.floor-item.selected{cursor:grab}.floor-item.selected:active{cursor:grabbing}
        .floor-legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 2px 1px;color:#a0a79d;font-size:0.625rem}.floor-legend span{display:flex;align-items:center;gap:6px}.floor-legend i{width:8px;height:8px;border-radius:50%}.floor-availability{margin-left:auto;color:#d1bb7d}.floor-swipe-hint{display:none;color:#8b9488}
        .floor-inspector{border:1px solid #353d35;background:#1d231e;border-radius:13px;padding:15px}.inspector-eyebrow{font-size:0.625rem;color:var(--restaurant-primary,#d6b66f);text-transform:uppercase;letter-spacing:.14em}.floor-inspector h3{font:500 1.25rem var(--font-playfair),Georgia,serif;color:#f0ece1;margin:7px 0 16px}.floor-field{display:flex;flex-direction:column;gap:6px;margin:12px 0;color:#a4aa9e;font-size:0.625rem}.floor-field input,.floor-field select{width:100%;height:37px;border:1px solid #414840;border-radius:8px;background:#141916;color:#eee9df;padding:0 9px;font:inherit;font-size:0.75rem}.floor-inspector-actions{display:flex;gap:7px;margin-top:16px}.floor-inspector-actions .floor-action{flex:1;padding:0 8px}.floor-hint,.floor-empty{font-size:0.625rem;line-height:1.6;color:#858e84;margin:13px 0 0}.floor-empty{padding:12px 2px}
        @media(max-width:900px){.floor-plan.is-editable{grid-template-columns:1fr}.floor-inspector{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}.floor-inspector h3,.inspector-eyebrow,.floor-inspector-actions,.floor-hint,.floor-empty{grid-column:1/-1}.floor-inspector h3{margin-bottom:7px}}
        @media(max-width:560px){.floor-plan-main{padding:8px}.floor-plan-toolbar{align-items:flex-start;flex-direction:column}.floor-plan-toolbar span{line-height:1.5}.floor-svg-wrap svg{min-width:700px}.floor-legend{gap:9px;font-size:0.625rem}.floor-availability{margin-left:0}.floor-swipe-hint{display:flex}.floor-inspector{grid-template-columns:1fr 1fr}.floor-field{font-size:0.625rem}}
      `}</style>
    </section>
  )
}
