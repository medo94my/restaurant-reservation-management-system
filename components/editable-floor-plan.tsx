'use client'

import React, { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type TouchEvent } from 'react'
import {
  FloorLayoutEngine,
  getDynamicTableDimensions,
  getCouchDimensions,
  snapToGrid,
  clampUnitPosition,
  calculateFloorBoundingBox,
  type SeatPosition,
} from '@/lib/floor-layout'
import type { CouchShape, RoomUnit, TableShape, TableUnit, Unit } from '@/lib/restaurant-config'
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Slider,
  Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import GridOnIcon from '@mui/icons-material/GridOn'
import GridOffIcon from '@mui/icons-material/GridOff'

const SHAPES: { value: TableShape; label: string }[] = [
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'oval', label: 'Oval' },
  { value: 'long', label: 'Long Table' },
]

const COUCH_SHAPES: { value: CouchShape; label: string }[] = [
  { value: 'loveseat', label: 'Loveseat' },
  { value: 'sofa', label: '3-Seat Sofa' },
  { value: 'l-sectional', label: 'L-Sectional' },
  { value: 'banquette', label: 'Banquette' },
]

const statusColors: Record<Unit['status'], { stroke: string; fill: string; label: string }> = {
  available: { stroke: '#78b38a', fill: '#223828', label: 'Available' },
  seated: { stroke: '#a5a6ed', fill: '#272945', label: 'Seated' },
  prep: { stroke: '#e5bd60', fill: '#45371b', label: 'Prep needed' },
  blocked: { stroke: '#89908a', fill: '#2b2e2b', label: 'Out of service' },
}

type Props = {
  items: Unit[]
  editable?: boolean
  onChange?: (items: Unit[]) => void
  onActivate?: (item: Unit) => void
  statusFilter?: Unit['status'] | 'all'
}

/**
 * Realistic Armchair / Dining Chair with cushioned pad, curved backrest & frame
 */
function RealisticChair({ seat }: { seat: SeatPosition }) {
  return (
    <g transform={`translate(${seat.x} ${seat.y}) rotate(${seat.rotation})`} aria-hidden="true">
      {/* Chair Backrest */}
      <rect
        x="-10"
        y="-15"
        width="20"
        height="8"
        rx="4"
        fill="#5a3d28"
        stroke="#c7a06a"
        strokeWidth="1.2"
      />
      {/* Side Armrests */}
      <rect x="-11" y="-12" width="3" height="12" rx="1.5" fill="#4d3320" />
      <rect x="8" y="-12" width="3" height="12" rx="1.5" fill="#4d3320" />
      {/* Cushioned Seat Pad */}
      <rect
        x="-8"
        y="-8"
        width="16"
        height="16"
        rx="4"
        fill="url(#chair-seat)"
        stroke="#755033"
        strokeWidth="1.2"
      />
      {/* Center Cushion Stitch Accent */}
      <circle cx="0" cy="0" r="1.5" fill="#5a3d28" opacity="0.6" />
      {/* Shadow under seat */}
      <ellipse cx="0" cy="9" rx="6" ry="2" fill="#000000" opacity="0.25" />
    </g>
  )
}

/**
 * Realistic Dining Table with dynamic seats, place settings, and live status
 */
function RealisticTable({
  item,
  showLabel = true,
}: {
  item: TableUnit
  showLabel?: boolean
}) {
  const { width, height } = getDynamicTableDimensions(item.tableType, item.capacity)
  const seats = FloorLayoutEngine.computeSeatLayout(item)

  return (
    <g aria-hidden="true">
      {/* Dynamic Seats around Perimeter */}
      {seats.map((seat, index) => (
        <RealisticChair key={`${item.id}-seat-${index}`} seat={seat} />
      ))}

      {/* Table Drop Shadow */}
      {item.tableType === 'round' && (
        <circle r={width / 2 + 3} cy="4" fill="#000000" opacity="0.35" filter="blur(3px)" />
      )}
      {(item.tableType === 'square' ||
        item.tableType === 'rectangle' ||
        item.tableType === 'long') && (
        <rect
          x={-width / 2 - 2}
          y={-height / 2 + 3}
          width={width + 4}
          height={height + 4}
          rx="4"
          fill="#000000"
          opacity="0.35"
        />
      )}
      {item.tableType === 'oval' && (
        <ellipse
          rx={width / 2 + 3}
          ry={height / 2 + 3}
          cy="4"
          fill="#000000"
          opacity="0.35"
        />
      )}

      {/* Main Table Top Geometry */}
      {item.tableType === 'round' && (
        <>
          <circle r={width / 2} fill="url(#table-top)" stroke="#5c3f26" strokeWidth="2.5" />
          <circle r={width / 2 - 4} fill="none" stroke="#d7b46a" strokeOpacity="0.3" strokeWidth="1" />
          <circle r={width / 2 - 12} fill="none" stroke="#f1d6aa" strokeOpacity="0.15" strokeDasharray="3 3" />
        </>
      )}

      {item.tableType === 'square' && (
        <>
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            rx="4"
            fill="url(#table-top)"
            stroke="#5c3f26"
            strokeWidth="2.5"
          />
          <rect
            x={-width / 2 + 5}
            y={-height / 2 + 5}
            width={width - 10}
            height={height - 10}
            rx="2"
            fill="none"
            stroke="#d7b46a"
            strokeOpacity="0.3"
          />
        </>
      )}

      {item.tableType === 'rectangle' && (
        <>
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            rx="4"
            fill="url(#table-top)"
            stroke="#5c3f26"
            strokeWidth="2.5"
          />
          <rect
            x={-width / 2 + 5}
            y={-height / 2 + 5}
            width={width - 10}
            height={height - 10}
            rx="2"
            fill="none"
            stroke="#d7b46a"
            strokeOpacity="0.28"
          />
          <path
            d={`M ${-width / 2 + 16} -6 H ${width / 2 - 16}`}
            stroke="#f1d6aa"
            strokeOpacity="0.2"
            strokeWidth="1.2"
          />
        </>
      )}

      {item.tableType === 'oval' && (
        <>
          <ellipse
            rx={width / 2}
            ry={height / 2}
            fill="url(#table-top)"
            stroke="#5c3f26"
            strokeWidth="2.5"
          />
          <ellipse
            rx={width / 2 - 5}
            ry={height / 2 - 5}
            fill="none"
            stroke="#d7b46a"
            strokeOpacity="0.3"
          />
        </>
      )}

      {item.tableType === 'long' && (
        <>
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            rx="4"
            fill="url(#table-top)"
            stroke="#5c3f26"
            strokeWidth="2.5"
          />
          <rect
            x={-width / 2 + 6}
            y={-height / 2 + 6}
            width={width - 12}
            height={height - 12}
            rx="2"
            fill="none"
            stroke="#d7b46a"
            strokeOpacity="0.28"
          />
          <path
            d={`M ${-width / 2 + 18} -8 H ${width / 2 - 18} M ${-width / 2 + 18} 8 H ${width / 2 - 18}`}
            stroke="#f1d6aa"
            strokeOpacity="0.18"
          />
        </>
      )}

      {/* Place Settings (Plates hints) */}
      {seats.map((seat, idx) => {
        const rad = (seat.rotation * Math.PI) / 180
        const plateInset = 23
        const px = seat.x - Math.sin(rad) * plateInset
        const py = seat.y + Math.cos(rad) * plateInset
        return (
          <g key={`plate-${idx}`} opacity="0.35">
            <circle cx={px} cy={py} r="4.5" fill="#f5f0e6" />
            <circle cx={px} cy={py} r="3" fill="none" stroke="#d7b46a" strokeWidth="0.8" />
          </g>
        )
      })}

      {/* Center Table Badge & Label */}
      {showLabel && (
        <g>
          <rect
            x="-26"
            y="-14"
            width="52"
            height="28"
            rx="3"
            fill="#171b18"
            stroke="#d7b46a"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <text
            y="-2"
            textAnchor="middle"
            fill="#f7f1e4"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.02em"
          >
            {item.id}
          </text>
          <text y="9" textAnchor="middle" fill="#d7b46a" fontSize="8" fontWeight="600">
            {item.capacity} seats
          </text>
        </g>
      )}
    </g>
  )
}

/**
 * Realistic Luxury Lounge Couch with tufted leather cushions, armrests & paired coffee table
 */
function RealisticCouch({ item }: { item: Extract<Unit, { kind: 'Couch' }> }) {
  const { width, height } = getCouchDimensions(item.couchType, item.capacity)
  const isSectional = item.couchType === 'l-sectional'
  const isBanquette = item.couchType === 'banquette'

  if (isSectional) {
    return (
      <g aria-hidden="true">
        {/* Shadow */}
        <path
          d={`M ${-width / 2} ${-height / 2} H ${width / 2} V ${height / 2} H ${-width / 2 + 45} V ${-height / 2 + 45} H ${-width / 2} Z`}
          fill="#000000"
          opacity="0.3"
          transform="translate(3 4)"
        />
        {/* Main Base Frame */}
        <path
          d={`M ${-width / 2} ${-height / 2} H ${width / 2} V ${height / 2} H ${-width / 2 + 42} V ${-height / 2 + 42} H ${-width / 2} Z`}
          fill="#592b23"
          stroke="#945344"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Tufted Leather Cushions */}
        <rect x={-width / 2 + 4} y={-height / 2 + 4} width="36" height="36" rx="6" fill="url(#couch-cushion)" />
        <rect x={-width / 2 + 44} y={-height / 2 + 4} width="42" height="36" rx="6" fill="url(#couch-cushion)" />
        <rect x={-width / 2 + 90} y={-height / 2 + 4} width="44" height="36" rx="6" fill="url(#couch-cushion)" />
        <rect x={-width / 2 + 4} y={-height / 2 + 44} width="36" height="58" rx="6" fill="url(#couch-cushion)" />

        {/* Lounge Coffee Table in the inner nook */}
        <rect x="0" y="0" width="56" height="42" rx="3" fill="url(#coffee-table)" stroke="#d7b46a" strokeWidth="1.2" />
        <circle cx="28" cy="21" r="3" fill="#d7b46a" opacity="0.6" />

        <text y={height / 2 + 15} textAnchor="middle" fill="#ebd2c5" fontSize="9" fontWeight="700">
          {item.id} · {item.capacity} seats (Sectional)
        </text>
      </g>
    )
  }

  if (isBanquette) {
    return (
      <g aria-hidden="true">
        {/* Curved Banquette Arc */}
        <path
          d={`M ${-width / 2} 24 Q 0 -36 ${width / 2} 24`}
          fill="none"
          stroke="#592b23"
          strokeWidth="32"
          strokeLinecap="round"
        />
        <path
          d={`M ${-width / 2} 24 Q 0 -36 ${width / 2} 24`}
          fill="none"
          stroke="url(#couch-cushion)"
          strokeWidth="24"
          strokeLinecap="round"
        />
        {/* Low Table Center */}
        <ellipse cx="0" cy="18" rx="34" ry="22" fill="url(#coffee-table)" stroke="#d7b46a" strokeWidth="1.2" />
        <text y="48" textAnchor="middle" fill="#ebd2c5" fontSize="9" fontWeight="700">
          {item.id} · {item.capacity} seats (Banquette)
        </text>
      </g>
    )
  }

  // Standard Loveseat or 3-Seat Sofa
  const armWidth = 14
  const cushionArea = width - armWidth * 2 - 12
  const cushionWidth = cushionArea / Math.max(1, item.capacity)

  return (
    <g aria-hidden="true">
      {/* Shadow */}
      <rect x={-width / 2 + 2} y={-height / 2 + 4} width={width} height={height} rx="4" fill="#000000" opacity="0.3" />

      {/* Main Sofa Shell */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx="4"
        fill="#5a2f27"
        stroke="#965243"
        strokeWidth="2"
      />

      {/* Backrest Cushion */}
      <rect
        x={-width / 2 + armWidth}
        y={-height / 2 + 4}
        width={width - armWidth * 2}
        height="18"
        rx="2"
        fill="#824135"
        stroke="#ad6352"
        strokeWidth="1"
      />

      {/* Seat Cushions */}
      {Array.from({ length: item.capacity }, (_, index) => {
        const x = -width / 2 + armWidth + 6 + index * cushionWidth
        return (
          <g key={`${item.id}-cushion-${index}`}>
            <rect
              x={x}
              y="-8"
              width={cushionWidth - 3}
              height="28"
              rx="6"
              fill="url(#couch-cushion)"
              stroke="#542821"
              strokeWidth="1.2"
            />
            {/* Tufting Button Stitch */}
            <circle cx={x + (cushionWidth - 3) / 2} cy="6" r="1.5" fill="#401e18" />
          </g>
        )
      })}

      {/* Armrests */}
      <rect
        x={-width / 2 + 3}
        y={-height / 2 + 6}
        width={armWidth}
        height={height - 12}
        rx="3"
        fill="#75392d"
        stroke="#aa5f4e"
        strokeWidth="1.2"
      />
      <rect
        x={width / 2 - armWidth - 3}
        y={-height / 2 + 6}
        width={armWidth}
        height={height - 12}
        rx="3"
        fill="#75392d"
        stroke="#aa5f4e"
        strokeWidth="1.2"
      />

      {/* Low Lounge Coffee Table in front */}
      <rect
        x={-width / 2 + 20}
        y={height / 2 + 4}
        width={width - 40}
        height="16"
        rx="2"
        fill="url(#coffee-table)"
        stroke="#d7b46a"
        strokeOpacity="0.4"
        strokeWidth="1"
      />

      {/* Label */}
      <text y={height / 2 + 32} textAnchor="middle" fill="#ebd2c5" fontSize="9" fontWeight="700">
        {item.id} · {item.capacity} seats
      </text>
    </g>
  )
}

/**
 * Realistic Enclosed Private Dining Room (Architectural walls, 90° door arc, chandelier glow)
 */
function RealisticRoom({ item }: { item: RoomUnit }) {
  const left = -item.roomWidth / 2
  const top = -item.roomHeight / 2
  const doorWidth = 36

  const interiorTable: TableUnit = {
    id: `${item.id}`,
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
      {/* Outer Drop Shadow */}
      <rect
        x={left + 3}
        y={top + 4}
        width={item.roomWidth}
        height={item.roomHeight}
        rx="2"
        fill="#000000"
        opacity="0.45"
      />

      {/* Room Floor Fill (Parquet wood tint) */}
      <rect
        x={left + 5}
        y={top + 5}
        width={item.roomWidth - 10}
        height={item.roomHeight - 10}
        rx="2"
        fill="#181d19"
      />
      <rect
        x={left + 5}
        y={top + 5}
        width={item.roomWidth - 10}
        height={item.roomHeight - 10}
        rx="2"
        fill="url(#room-floor)"
        opacity="0.5"
      />

      {/* Ambient Chandelier Radial Glow */}
      <circle cx="0" cy="0" r={Math.min(item.roomWidth, item.roomHeight) * 0.45} fill="url(#room-glow)" opacity="0.6" />

      {/* Architectural Double-Line Structural Walls */}
      <rect
        x={left}
        y={top}
        width={item.roomWidth}
        height={item.roomHeight}
        rx="2"
        fill="none"
        stroke="#282f29"
        strokeWidth="10"
      />
      <rect
        x={left}
        y={top}
        width={item.roomWidth}
        height={item.roomHeight}
        rx="2"
        fill="none"
        stroke="#707a6f"
        strokeWidth="1.5"
      />

      {/* Door Opening Gap in bottom wall */}
      <rect
        x={-doorWidth / 2}
        y={item.roomHeight / 2 - 7}
        width={doorWidth}
        height="14"
        fill="#181d19"
      />

      {/* 90° Swinging Door Leaf & Swing Arc */}
      <path
        d={`M ${-doorWidth / 2} ${item.roomHeight / 2} A ${doorWidth} ${doorWidth} 0 0 1 ${doorWidth / 2} ${item.roomHeight / 2 - doorWidth}`}
        fill="none"
        stroke="#d7b46a"
        strokeOpacity="0.4"
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />
      <line
        x1={-doorWidth / 2}
        y1={item.roomHeight / 2}
        x2={-doorWidth / 2}
        y2={item.roomHeight / 2 - doorWidth}
        stroke="#d7b46a"
        strokeWidth="2.5"
      />

      {/* Embedded Dining Table */}
      <g transform="scale(0.82)">
        <RealisticTable item={interiorTable} showLabel={false} />
      </g>

      {/* Architectural Nameplate Header Banner */}
      <rect
        x={left + 14}
        y={top + 10}
        width={item.roomWidth - 28}
        height="22"
        rx="4"
        fill="#131714"
        stroke="#d7b46a"
        strokeOpacity="0.35"
      />
      <text
        x={0}
        y={top + 24}
        textAnchor="middle"
        fill="#eed29b"
        fontSize="10"
        fontWeight="700"
        letterSpacing="0.06em"
      >
        {item.id.toUpperCase()} · PRIVATE SUITE ({item.capacity} SEATS)
      </text>
    </g>
  )
}

export function EditableFloorPlan({ items, editable = false, onChange, onActivate, statusFilter = 'all' }: Props) {
  const visibleItems = items.filter((item) => !item.archived)
  const [selectedId, setSelectedId] = useState<string | null>(visibleItems[0]?.id ?? null)
  const [zoom, setZoom] = useState<number>(0.9)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 })
  const [snapGrid, setSnapGrid] = useState<boolean>(true)
  const [isPanning, setIsPanning] = useState<boolean>(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const draggingId = useRef<string | null>(null)
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const isPanningRef = useRef<boolean>(false)
  const panStart = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null)
  const touchDistance = useRef<number | null>(null)
  const touchOrigin = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)

  const selected = visibleItems.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    if (!visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0]?.id ?? null)
    }
  }, [selectedId, visibleItems])

  // Coordinate projector: Screen (pixel) -> Endless World (SVG units)
  const screenToWorld = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current
    if (!wrap) return { x: 0, y: 0 }
    const rect = wrap.getBoundingClientRect()
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    }
  }

  const updateItem = (id: string, patch: Partial<Unit>) => {
    if (
      patch.id &&
      items.some(
        (item) => item.id !== id && item.id.trim().toLowerCase() === patch.id?.trim().toLowerCase()
      )
    ) {
      return
    }
    onChange?.(items.map((item) => (item.id === id ? ({ ...item, ...patch } as Unit) : item)))
    if (patch.id && selectedId === id) setSelectedId(patch.id)
  }

  const addItem = (kind: Unit['kind']) => {
    // Generate new unit near current viewport center
    const wrap = wrapRef.current
    const rect = wrap?.getBoundingClientRect()
    const centerWorld =
      wrap && rect
        ? screenToWorld(rect.left + wrap.clientWidth / 2, rect.top + wrap.clientHeight / 2)
        : { x: 500, y: 300 }

    const id = FloorLayoutEngine.generateNextUnitId(kind, items)
    const posX = snapGrid ? snapToGrid(centerWorld.x, 10) : Math.round(centerWorld.x)
    const posY = snapGrid ? snapToGrid(centerWorld.y, 10) : Math.round(centerWorld.y)

    const base = {
      id,
      status: 'available' as const,
      capacity: kind === 'Room' ? 4 : 2,
      x: posX,
      y: posY,
      rotation: 0,
    }

    const newItem: Unit =
      kind === 'Table'
        ? { ...base, kind: 'Table', tableType: 'round' }
        : kind === 'Couch'
        ? { ...base, kind: 'Couch', couchType: 'loveseat' }
        : { ...base, kind: 'Room', roomWidth: 190, roomHeight: 140, tableType: 'round' }

    onChange?.([...items, newItem])
    setSelectedId(newItem.id)
  }

  // Pointer interactions
  const handleItemPointerDown = (event: PointerEvent<SVGGElement>, item: Unit) => {
    setSelectedId(item.id)
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    draggingId.current = item.id
    isPanningRef.current = false
    setIsPanning(false)
    moved.current = false

    const world = screenToWorld(event.clientX, event.clientY)
    dragOffset.current = {
      x: world.x - item.x,
      y: world.y - item.y,
    }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const handleCanvasPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!editable) return
    if ((event.target as Element).closest('.floor-item')) return
    event.preventDefault()
    draggingId.current = null
    isPanningRef.current = true
    setIsPanning(true)
    moved.current = false
    panStart.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!editable) return
    if (isPanningRef.current && panStart.current) {
      const dx = event.clientX - panStart.current.clientX
      const dy = event.clientY - panStart.current.clientY
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true
      setPan({
        x: panStart.current.panX + dx,
        y: panStart.current.panY + dy,
      })
      return
    }

    if (!draggingId.current || !svgRef.current) return
    const item = items.find((c) => c.id === draggingId.current)
    if (!item) return

    const world = screenToWorld(event.clientX, event.clientY)
    let nextX = world.x - dragOffset.current.x
    let nextY = world.y - dragOffset.current.y

    if (snapGrid) {
      nextX = snapToGrid(nextX, 10)
      nextY = snapToGrid(nextY, 10)
    }

    const clamped = clampUnitPosition(item, nextX, nextY)
    moved.current = true
    updateItem(draggingId.current, { x: clamped.x, y: clamped.y })
  }

  const handlePointerUp = (event?: PointerEvent<SVGSVGElement>) => {
    if (event && svgRef.current?.hasPointerCapture(event.pointerId)) {
      try {
        svgRef.current.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    }
    draggingId.current = null
    isPanningRef.current = false
    setIsPanning(false)
    panStart.current = null
    window.setTimeout(() => {
      moved.current = false
    }, 50)
  }

  // Smooth Wheel Zoom & Free Two-Finger Pan on desktop (non-passive listener for preventDefault)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !editable) return

    const handleWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault()
      const rect = wrap.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top

      if (e.ctrlKey || e.metaKey) {
        // Pinch trackpad / Ctrl+Wheel: Zoom focused around cursor
        const zoomDelta = -e.deltaY * 0.006
        const nextZoom = Math.min(2.5, Math.max(0.35, +(zoom + zoomDelta).toFixed(2)))
        const scaleChange = nextZoom / zoom

        const nextPanX = cursorX - (cursorX - pan.x) * scaleChange
        const nextPanY = cursorY - (cursorY - pan.y) * scaleChange

        setZoom(nextZoom)
        setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) })
      } else {
        // Regular scroll pans the infinite floor
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }

    wrap.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      wrap.removeEventListener('wheel', handleWheel)
    }
  }, [editable, zoom, pan])

  // Tablet Multi-touch Pinch to Zoom & Two-Finger Pan
  const handleTouchStart = (e: TouchEvent<SVGSVGElement>) => {
    if (!editable) return
    if (e.touches.length === 2) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      touchDistance.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      touchOrigin.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
    }
  }

  const handleTouchMove = (e: TouchEvent<SVGSVGElement>) => {
    if (!editable) return
    if (e.touches.length === 2 && touchDistance.current !== null && touchOrigin.current !== null) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const newMidX = (t1.clientX + t2.clientX) / 2
      const newMidY = (t1.clientY + t2.clientY) / 2

      const factor = newDist / touchDistance.current
      const nextZoom = Math.min(2.5, Math.max(0.35, +(zoom * factor).toFixed(2)))

      const dPanX = newMidX - touchOrigin.current.x
      const dPanY = newMidY - touchOrigin.current.y

      setZoom(nextZoom)
      setPan((prev) => ({
        x: Math.round(prev.x + dPanX),
        y: Math.round(prev.y + dPanY),
      }))

      touchDistance.current = newDist
      touchOrigin.current = { x: newMidX, y: newMidY }
    }
  }

  const handleTouchEnd = () => {
    touchDistance.current = null
    touchOrigin.current = null
  }

  // Keyboard navigation & nudging
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, item: Unit) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (editable) setSelectedId(item.id)
      else onActivate?.(item)
      return
    }

    if (!editable) return

    const step = event.shiftKey ? 20 : snapGrid ? 10 : 5
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const clamped = clampUnitPosition(item, item.x, item.y - step)
      updateItem(item.id, { y: clamped.y })
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const clamped = clampUnitPosition(item, item.x, item.y + step)
      updateItem(item.id, { y: clamped.y })
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const clamped = clampUnitPosition(item, item.x - step, item.y)
      updateItem(item.id, { x: clamped.x })
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      const clamped = clampUnitPosition(item, item.x + step, item.y)
      updateItem(item.id, { x: clamped.x })
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      updateItem(item.id, { rotation: ((item.rotation ?? 0) + 45) % 360 })
    }
  }

  const handleClick = (item: Unit) => {
    if (moved.current) return
    if (editable) setSelectedId(item.id)
    else onActivate?.(item)
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)))
  const handleZoomOut = () => setZoom((prev) => Math.max(0.35, +(prev - 0.15).toFixed(2)))
  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 40, y: 30 })
  }

  // Smart Camera: Fit all tables and units centered onto the viewport
  const handleFitAll = useCallback(() => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const bounds = calculateFloorBoundingBox(items)
    const padding = 70

    const scaleX = (rect.width - padding * 2) / bounds.width
    const scaleY = (rect.height - padding * 2) / bounds.height
    const targetZoom = Math.min(1.8, Math.max(0.4, Math.min(scaleX, scaleY)))

    const targetPanX = rect.width / 2 - bounds.centerX * targetZoom
    const targetPanY = rect.height / 2 - bounds.centerY * targetZoom

    setZoom(+targetZoom.toFixed(2))
    setPan({ x: Math.round(targetPanX), y: Math.round(targetPanY) })
  }, [items])

  // Auto-fit and freeze canvas for hostess stand view
  useEffect(() => {
    if (!editable) {
      const timer = setTimeout(() => {
        handleFitAll()
      }, 60)
      const handleResize = () => handleFitAll()
      window.addEventListener('resize', handleResize)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [editable, items, handleFitAll])

  const availableCount = visibleItems.filter((item) => item.status === 'available').length

  return (
    <section
      className={`floor-plan ${editable ? 'is-editable' : ''}`}
      aria-label={editable ? 'Editable infinite restaurant floor plan' : 'Restaurant floor plan canvas'}
    >
      <div className="floor-plan-main">
        {editable && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1.5,
              mb: 2,
            }}
          >
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  color: '#e6d19a',
                  fontWeight: 600,
                }}
              >
                Endless Floor Canvas
              </Typography>
              <Typography variant="caption" sx={{ color: '#8e968b' }}>
                Infinite architectural space. Pan freely, pinch to zoom, and place spaces anywhere.
              </Typography>
            </Box>

            {/* Strict 3-Unit Add Buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => addItem('Table')}
                sx={{
                  bgcolor: '#d7b46a',
                  color: '#1a1811',
                  fontWeight: 700,
                  textTransform: 'none',
                  minHeight: 40,
                  '&:hover': { bgcolor: '#e4c77e' },
                }}
              >
                + Add Table
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => addItem('Couch')}
                sx={{
                  bgcolor: '#d7b46a',
                  color: '#1a1811',
                  fontWeight: 700,
                  textTransform: 'none',
                  minHeight: 40,
                  '&:hover': { bgcolor: '#e4c77e' },
                }}
              >
                + Add Couch
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => addItem('Room')}
                sx={{
                  bgcolor: '#d7b46a',
                  color: '#1a1811',
                  fontWeight: 700,
                  textTransform: 'none',
                  minHeight: 40,
                  '&:hover': { bgcolor: '#e4c77e' },
                }}
              >
                + Add Room
              </Button>
            </Box>
          </Box>
        )}

        <div
          className="floor-svg-wrap"
          ref={wrapRef}
          style={{
            position: 'relative',
            width: '100%',
            height: editable ? '620px' : '560px',
            overflow: 'hidden',
            borderRadius: '8px',
            backgroundColor: '#111412',
            border: '1px solid rgba(215, 180, 106, 0.18)',
            boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.45)',
            overscrollBehavior: editable ? 'contain' : 'auto',
          }}
        >
          {/* Canvas Floating HUD Controls */}
          {editable ? (
            <Paper
              elevation={2}
              className="floor-hud"
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 0.75,
                py: 0.25,
                borderRadius: '6px',
                bgcolor: 'rgba(20, 24, 21, 0.95)',
                backdropFilter: 'blur(8px)',
                borderColor: 'rgba(215, 180, 106, 0.25)',
                borderWidth: 1,
                borderStyle: 'solid',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                '& .MuiIconButton-root': {
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  minHeight: 28,
                  p: 0.25,
                  borderRadius: '4px',
                  color: '#eee9df',
                  '&:hover': {
                    bgcolor: 'rgba(215, 180, 106, 0.15)',
                    color: '#d7b46a',
                  },
                },
                '& svg': {
                  width: '15px !important',
                  height: '15px !important',
                  fontSize: '15px !important',
                  display: 'block',
                },
              }}
            >
              <Tooltip title="Zoom in">
                <IconButton size="small" onClick={handleZoomIn} aria-label="Zoom in floor canvas">
                  <ZoomInIcon />
                </IconButton>
              </Tooltip>
              <Typography
                variant="caption"
                sx={{
                  color: '#d7b46a',
                  fontWeight: 700,
                  px: 0.5,
                  fontSize: '0.72rem',
                  minWidth: 38,
                  textAlign: 'center',
                }}
              >
                {Math.round(zoom * 100)}%
              </Typography>
              <Tooltip title="Zoom out">
                <IconButton size="small" onClick={handleZoomOut} aria-label="Zoom out floor canvas">
                  <ZoomOutIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fit all spaces to screen">
                <IconButton size="small" onClick={handleFitAll} aria-label="Fit all spaces to screen">
                  <FitScreenIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset View (100%)">
                <IconButton size="small" onClick={handleResetZoom} aria-label="Reset floor canvas view">
                  <RestartAltIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={snapGrid ? 'Snap to grid (10px) ON' : 'Snap to grid OFF'}>
                <IconButton
                  size="small"
                  onClick={() => setSnapGrid((prev) => !prev)}
                  aria-label={snapGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
                  sx={{ color: snapGrid ? '#d7b46a !important' : '#8e968b !important' }}
                >
                  {snapGrid ? <GridOnIcon /> : <GridOffIcon />}
                </IconButton>
              </Tooltip>
            </Paper>
          ) : (
            <Paper
              elevation={2}
              className="floor-hud"
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.5,
                py: 0.5,
                borderRadius: '6px',
                bgcolor: 'rgba(20, 24, 21, 0.95)',
                backdropFilter: 'blur(8px)',
                borderColor: 'rgba(215, 180, 106, 0.25)',
                borderWidth: 1,
                borderStyle: 'solid',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4ade80' }} />
                <Typography variant="caption" sx={{ color: '#eee9df', fontSize: '0.75rem', fontWeight: 600 }}>
                  {availableCount} Free
                </Typography>
              </Box>
              <Box sx={{ width: 1, height: 12, bgcolor: 'rgba(255, 255, 255, 0.12)' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#a5b4fc' }} />
                <Typography variant="caption" sx={{ color: '#eee9df', fontSize: '0.75rem', fontWeight: 600 }}>
                  {visibleItems.filter((i) => i.status === 'seated').length} Seated
                </Typography>
              </Box>
              <Box sx={{ width: 1, height: 12, bgcolor: 'rgba(255, 255, 255, 0.12)' }} />
              <Tooltip title="Recenter floor plan to frame">
                <Button
                  size="small"
                  onClick={handleFitAll}
                  startIcon={<FitScreenIcon sx={{ fontSize: '15px !important' }} />}
                  sx={{
                    p: '2px 8px',
                    minWidth: 'auto',
                    fontSize: '0.72rem',
                    color: '#d7b46a',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '4px',
                    bgcolor: 'rgba(215, 180, 106, 0.08)',
                    '&:hover': { bgcolor: 'rgba(215, 180, 106, 0.18)' },
                  }}
                >
                  Center View
                </Button>
              </Tooltip>
            </Paper>
          )}

          {/* Coordinate & Jump-to-Center Indicator */}
          {editable ? (
            <Box
              sx={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.4,
                borderRadius: '6px',
                bgcolor: 'rgba(20, 24, 21, 0.9)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#8e968b',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <span>
                Offset: {Math.round(-pan.x / zoom)}, {Math.round(-pan.y / zoom)}
              </span>
              <span style={{ color: '#d7b46a' }}>·</span>
              <Button
                size="small"
                onClick={handleFitAll}
                sx={{
                  p: 0,
                  minWidth: 'auto',
                  fontSize: '0.72rem',
                  color: '#d7b46a',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Fit Floor (⛶)
              </Button>
            </Box>
          ) : (
            <Box
              sx={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.4,
                borderRadius: '6px',
                bgcolor: 'rgba(20, 24, 21, 0.9)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#8e968b',
                fontSize: '0.75rem',
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4ade80' }} />
              <Typography variant="caption" sx={{ color: '#d7b46a', fontWeight: 700, fontSize: '0.72rem' }}>
                Floor Stand
              </Typography>
              <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>·</span>
              <Typography variant="caption" sx={{ color: '#a1a89e', fontSize: '0.72rem' }}>
                Tap any table for instant seating or release
              </Typography>
            </Box>
          )}

          {/* Endless Hardware-Accelerated SVG Canvas */}
          <svg
            ref={svgRef}
            className="floor-canvas-svg"
            width="100%"
            height="100%"
            role="group"
            aria-label={
              editable
                ? 'Restaurant floor editor canvas; drag furniture to move it, drag open floor to pan'
                : 'Restaurant floor overview; select any table for quick seating or details'
            }
            onPointerDown={editable ? handleCanvasPointerDown : undefined}
            onPointerMove={editable ? handlePointerMove : undefined}
            onPointerUp={editable ? handlePointerUp : undefined}
            onPointerCancel={editable ? handlePointerUp : undefined}
            onTouchStart={editable ? handleTouchStart : undefined}
            onTouchMove={editable ? handleTouchMove : undefined}
            onTouchEnd={editable ? handleTouchEnd : undefined}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              cursor: isPanning ? 'grabbing' : editable ? 'grab' : 'default',
              userSelect: 'none',
              touchAction: editable ? 'none' : 'pan-y',
            }}
          >
            <defs>
              {/* Infinite Architectural Floor Pattern */}
              <pattern id="floor-grid-small" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d7b46a" strokeOpacity="0.035" strokeWidth="1" />
              </pattern>
              <pattern id="floor-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="url(#floor-grid-small)" />
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d7b46a" strokeOpacity="0.075" strokeWidth="1.2" />
              </pattern>

              {/* Room Flooring Pattern */}
              <pattern id="room-floor" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 0 10 L 10 0 L 20 10 L 10 20 Z" fill="none" stroke="#d7b46a" strokeOpacity="0.06" strokeWidth="1" />
              </pattern>

              {/* Table Top Walnut Gradient */}
              <linearGradient id="table-top" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#b4834f" />
                <stop offset="0.5" stopColor="#8c5f37" />
                <stop offset="1" stopColor="#674325" />
              </linearGradient>

              {/* Chair Seat Upholstery Gradient */}
              <linearGradient id="chair-seat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d7b46a" />
                <stop offset="1" stopColor="#9a733e" />
              </linearGradient>

              {/* Couch Leather Cushion Gradient */}
              <linearGradient id="couch-cushion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#b56350" />
                <stop offset="1" stopColor="#7a3729" />
              </linearGradient>

              {/* Coffee Table Dark Bronze Glass */}
              <linearGradient id="coffee-table" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#302923" />
                <stop offset="1" stopColor="#1e1814" />
              </linearGradient>

              {/* Ambient Chandelier Radial Glow */}
              <radialGradient id="room-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffd885" stopOpacity="0.18" />
                <stop offset="60%" stopColor="#d7b46a" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#181d19" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Transform Container with Hardware-Accelerated SVG Matrix */}
            <g transform={`matrix(${zoom} 0 0 ${zoom} ${pan.x} ${pan.y})`}>
              {/* Massive Infinite Plane (covers 1,000,000 x 1,000,000 units with zero lag) */}
              <rect x="-500000" y="-500000" width="1000000" height="1000000" fill="#121613" />
              <rect x="-500000" y="-500000" width="1000000" height="1000000" fill="url(#floor-grid)" />

              {/* Primary Dining Room Zone Guide */}
              <rect
                x="20"
                y="20"
                width="960"
                height="560"
                rx="4"
                fill="none"
                stroke="#d7b46a"
                strokeOpacity="0.15"
                strokeWidth="2"
                strokeDasharray="8 6"
              />
              <text x="44" y="52" fill="#d7b46a" fillOpacity="0.55" fontSize="12" letterSpacing="2" fontWeight="700">
                SAFFRON &amp; CEDAR · MAIN DINING HALL
              </text>
              <text x="44" y="560" fill="#8e968b" fillOpacity="0.6" fontSize="11" letterSpacing="1">
                HOST STAND &amp; GRAND FOYER
              </text>

              {/* Render Visible Furniture Items */}
              {visibleItems.map((item) => {
                const palette = statusColors[item.status]
                const isSelected = editable && selectedId === item.id
                const isFilteredOut = statusFilter && statusFilter !== 'all' && item.status !== statusFilter
                const itemLabel =
                  item.kind === 'Table'
                    ? `${item.id}, ${SHAPES.find((shape) => shape.value === item.tableType)?.label} table`
                    : item.kind === 'Couch'
                    ? `${item.id}, ${item.couchType} lounge couch`
                    : `${item.id}, enclosed private dining suite`

                return (
                  <g
                    key={item.id}
                    transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${itemLabel} for ${item.capacity} guests, status: ${palette.label}`}
                    className={`floor-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      opacity: isFilteredOut ? 0.28 : 1,
                      transition: 'opacity 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onPointerDown={(event) => handleItemPointerDown(event, item)}
                    onClick={() => handleClick(item)}
                    onKeyDown={(event) => handleKeyDown(event, item)}
                  >
                    {/* Selected Unit Accent Halo & Rotation Anchor */}
                    {isSelected && (
                      <g pointerEvents="none">
                        <circle
                          r={
                            item.kind === 'Room'
                              ? Math.max(item.roomWidth, item.roomHeight) / 2 + 16
                              : item.kind === 'Couch'
                              ? 90
                              : 88
                          }
                          fill="none"
                          stroke="#d7b46a"
                          strokeOpacity="0.8"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                        />
                        {/* Top Rotation Pin Anchor */}
                        <circle
                          cx="0"
                          cy={
                            item.kind === 'Room'
                              ? -item.roomHeight / 2 - 24
                              : item.kind === 'Couch'
                              ? -62
                              : -60
                          }
                          r="7"
                          fill="#d7b46a"
                          stroke="#1a1811"
                          strokeWidth="2"
                        />
                      </g>
                    )}

                    {/* Strict 3 Unit Renderers */}
                    {item.kind === 'Table' && <RealisticTable item={item} />}
                    {item.kind === 'Couch' && <RealisticCouch item={item} />}
                    {item.kind === 'Room' && <RealisticRoom item={item} />}

                    {/* Status Indicator Dot */}
                    <circle
                      cx={
                        item.kind === 'Room'
                          ? item.roomWidth / 2 - 14
                          : item.kind === 'Couch'
                          ? 40
                          : 26
                      }
                      cy={
                        item.kind === 'Room'
                          ? -item.roomHeight / 2 + 14
                          : item.kind === 'Couch'
                          ? -24
                          : -24
                      }
                      r="5.5"
                      fill={palette.stroke}
                      stroke="#141915"
                      strokeWidth="2"
                      pointerEvents="none"
                    />
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {/* Floor Plan Footer Legend */}
        <div className="floor-legend" aria-label="Space status legend">
          {Object.entries(statusColors).map(([status, palette]) => (
            <span key={status}>
              <i style={{ background: palette.stroke }} />
              {palette.label}
            </span>
          ))}
          <span className="floor-availability">
            {availableCount} of {visibleItems.length} spaces available
          </span>
          {editable ? (
            <span className="floor-swipe-hint">
              Drag floor to pan infinitely · Pinch or scroll to zoom · Click (⛶) to fit all spaces.
            </span>
          ) : (
            <span className="floor-swipe-hint">
              Stable dining room layout · Tap a table for instant seating, arrivals, or table release.
            </span>
          )}
        </div>
      </div>

      {/* Selected Space Inspector Sidebar (MUI Paper) */}
      {editable && (
        <Paper
          variant="outlined"
          component="aside"
          aria-label="Selected space settings"
          sx={{
            bgcolor: '#191e1a',
            borderColor: 'rgba(215, 180, 106, 0.25)',
            borderRadius: '6px',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {selected ? (
            <>
              <Box>
                <Typography
                  variant="overline"
                  sx={{
                    color: '#d7b46a',
                    letterSpacing: '0.12em',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {selected.kind} Inspector
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'Playfair Display, Georgia, serif',
                    color: '#f5f2ea',
                    fontWeight: 700,
                  }}
                >
                  {selected.id}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#8e968b' }}>
                  Label
                </Typography>
                <TextField
                  size="small"
                  value={selected.id}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                  onChange={(e) => updateItem(selected.id, { id: e.target.value })}
                  sx={{ bgcolor: '#141916' }}
                />
              </Box>

              {/* Table Specific Settings */}
              {selected.kind === 'Table' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#8e968b' }}>
                    Table Shape
                  </Typography>
                  <Select
                    size="small"
                    value={selected.tableType}
                    onChange={(e) =>
                      updateItem(selected.id, { tableType: e.target.value as TableShape })
                    }
                    sx={{ bgcolor: '#141916' }}
                  >
                    {SHAPES.map((shape) => (
                      <MenuItem key={shape.value} value={shape.value}>
                        {shape.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              )}

              {/* Couch Specific Settings */}
              {selected.kind === 'Couch' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#8e968b' }}>
                    Couch Style
                  </Typography>
                  <Select
                    size="small"
                    value={selected.couchType}
                    onChange={(e) =>
                      updateItem(selected.id, { couchType: e.target.value as CouchShape })
                    }
                    sx={{ bgcolor: '#141916' }}
                  >
                    {COUCH_SHAPES.map((shape) => (
                      <MenuItem key={shape.value} value={shape.value}>
                        {shape.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              )}

              {/* Room Specific Settings */}
              {selected.kind === 'Room' && (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#8e968b' }}>
                      Room width (px)
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={selected.roomWidth}
                      slotProps={{ htmlInput: { min: 150, max: 400, step: 10 } }}
                      onChange={(e) =>
                        updateItem(selected.id, {
                          roomWidth: Math.min(400, Math.max(150, Number(e.target.value) || 150)),
                        })
                      }
                      sx={{ bgcolor: '#141916' }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#8e968b' }}>
                      Room depth (px)
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={selected.roomHeight}
                      slotProps={{ htmlInput: { min: 120, max: 320, step: 10 } }}
                      onChange={(e) =>
                        updateItem(selected.id, {
                          roomHeight: Math.min(320, Math.max(120, Number(e.target.value) || 120)),
                        })
                      }
                      sx={{ bgcolor: '#141916' }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#8e968b' }}>
                      Dining table shape
                    </Typography>
                    <Select
                      size="small"
                      value={selected.tableType}
                      onChange={(e) =>
                        updateItem(selected.id, { tableType: e.target.value as TableShape })
                      }
                      sx={{ bgcolor: '#141916' }}
                    >
                      {SHAPES.map((shape) => (
                        <MenuItem key={shape.value} value={shape.value}>
                          {shape.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                </>
              )}

              {/* Capacity Controls (Dynamically updates seats on the canvas in real-time) */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#8e968b' }}>
                    Seating Capacity
                  </Typography>
                  <Chip
                    size="small"
                    label={`${selected.capacity} seats`}
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      bgcolor: 'rgba(215, 180, 106, 0.15)',
                      color: '#ebd29b',
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    aria-label="Decrease capacity"
                    onClick={() => updateItem(selected.id, { capacity: Math.max(1, selected.capacity - 1) })}
                    sx={{ color: '#eee9df', bgcolor: '#141916' }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Slider
                    value={selected.capacity}
                    aria-label="Table capacity"
                    min={1}
                    max={24}
                    step={1}
                    onChange={(_, val) => updateItem(selected.id, { capacity: val as number })}
                    sx={{ color: '#d7b46a' }}
                  />
                  <IconButton
                    size="small"
                    aria-label="Increase capacity"
                    onClick={() => updateItem(selected.id, { capacity: Math.min(24, selected.capacity + 1) })}
                    sx={{ color: '#eee9df', bgcolor: '#141916' }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              {/* Status Select */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#8e968b' }}>
                  Status
                </Typography>
                <Select
                  size="small"
                  value={selected.status}
                  onChange={(e) => updateItem(selected.id, { status: e.target.value as Unit['status'] })}
                  sx={{ bgcolor: '#141916' }}
                >
                  <MenuItem value="available">Available</MenuItem>
                  <MenuItem value="seated">Seated</MenuItem>
                  <MenuItem value="prep">Prep needed</MenuItem>
                  <MenuItem value="blocked">Out of service</MenuItem>
                </Select>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  startIcon={<RotateRightIcon sx={{ fontSize: 16 }} />}
                  onClick={() => updateItem(selected.id, { rotation: ((selected.rotation ?? 0) + 45) % 360 })}
                  sx={{
                    color: '#eee9df',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    textTransform: 'none',
                    minHeight: 40,
                  }}
                >
                  Rotate 45°
                </Button>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
                  onClick={() => {
                    const next = items.map((item) =>
                      item.id === selected.id ? ({ ...item, archived: true } as Unit) : item
                    )
                    onChange?.(next)
                    const nextVisible = next.filter((item) => !item.archived)
                    setSelectedId(nextVisible[0]?.id ?? null)
                  }}
                  sx={{ textTransform: 'none', minHeight: 40 }}
                >
                  Remove
                </Button>
              </Box>

              <Typography variant="caption" sx={{ color: '#7a8276', mt: 0.5 }}>
                Coordinates: ({Math.round(selected.x)}, {Math.round(selected.y)}) · Angle: {selected.rotation ?? 0}°
              </Typography>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: '#8e968b', py: 2 }}>
              Select any table, couch, or room to inspect and customize.
            </Typography>
          )}
        </Paper>
      )}

      <style jsx>{`
        .floor-plan {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 16px;
          margin: 0 0 18px;
          align-items: start;
        }
        .floor-plan:not(.is-editable) {
          display: block;
        }
        .floor-plan-main {
          min-width: 0;
          border: 1px solid rgba(215, 180, 106, 0.2);
          background: #171b18;
          border-radius: 14px;
          padding: 14px;
        }
        .floor-item {
          outline: none;
          cursor: pointer;
          transition: opacity 0.12s ease-out;
        }
        .floor-item:hover {
          opacity: 0.92;
        }
        .floor-item:focus-visible {
          filter: drop-shadow(0 0 6px rgba(215, 180, 106, 0.7));
        }
        .floor-legend {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          padding: 13px 2px 2px;
          color: #a0a79d;
          font-size: 11px;
        }
        .floor-legend span {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .floor-legend i {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }
        .floor-availability {
          margin-left: auto;
          color: #d7b46a;
          font-weight: 600;
        }
        .floor-swipe-hint {
          display: flex;
          color: #8b9488;
        }
        @media (max-width: 900px) {
          .floor-plan.is-editable {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .floor-plan-main {
            padding: 8px;
          }
        }
      `}</style>
    </section>
  )
}
