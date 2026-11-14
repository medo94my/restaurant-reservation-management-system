import type { TableShape, TableUnit, Unit, CouchShape } from './restaurant-config.ts'

export const TABLE_DIMENSIONS: Record<TableShape, { width: number; height: number }> = {
  round: { width: 72, height: 72 },
  square: { width: 68, height: 68 },
  rectangle: { width: 106, height: 68 },
  oval: { width: 108, height: 68 },
  long: { width: 132, height: 62 },
}

export function getDynamicTableDimensions(
  tableType: TableShape,
  capacity: number = 4
): { width: number; height: number } {
  const base = TABLE_DIMENSIONS[tableType]
  if (tableType === 'round') {
    const radius = Math.max(36, 26 + capacity * 3.5)
    return { width: Math.round(radius * 2), height: Math.round(radius * 2) }
  }
  if (tableType === 'square') {
    const side = Math.max(68, 52 + Math.ceil(capacity / 4) * 14)
    return { width: side, height: side }
  }
  if (tableType === 'rectangle') {
    const w = Math.max(106, 68 + Math.ceil(capacity / 2) * 16)
    return { width: w, height: 68 }
  }
  if (tableType === 'oval') {
    const w = Math.max(108, 62 + capacity * 8)
    const h = Math.max(68, 56 + Math.min(capacity, 8) * 1.5)
    return { width: Math.round(w), height: Math.round(h) }
  }
  if (tableType === 'long') {
    const w = Math.max(132, 60 + Math.ceil(capacity / 2) * 20)
    return { width: w, height: 62 }
  }
  return base
}

export function getCouchDimensions(
  couchType: CouchShape,
  capacity: number = 2
): { width: number; height: number } {
  if (couchType === 'loveseat') {
    return { width: 104, height: 66 }
  }
  if (couchType === 'sofa') {
    return { width: Math.max(130, 80 + capacity * 25), height: 66 }
  }
  if (couchType === 'l-sectional') {
    return { width: 140, height: 110 }
  }
  if (couchType === 'banquette') {
    return { width: 136, height: 72 }
  }
  return { width: 104, height: 66 }
}

export function snapToGrid(value: number, step: number = 10): number {
  return Math.round(value / step) * step
}

export type SeatPosition = { x: number; y: number; rotation: number }

export function computeSeatLayout(table: Pick<TableUnit, 'tableType' | 'capacity'>): SeatPosition[] {
  const { width, height } = getDynamicTableDimensions(table.tableType, table.capacity)
  const cap = Math.max(1, table.capacity)

  if (table.tableType === 'round' || table.tableType === 'oval') {
    const rx = width / 2 + 15
    const ry = height / 2 + 15
    return Array.from({ length: cap }, (_, index) => {
      const angle = -Math.PI / 2 + index * ((Math.PI * 2) / cap)
      const x = Math.cos(angle) * rx
      const y = Math.sin(angle) * ry
      return { x, y, rotation: Math.atan2(x, -y) * (180 / Math.PI) }
    })
  }

  // Rectangular, Square, and Long tables
  const counts = [0, 0, 0, 0]
  if (table.tableType === 'square') {
    for (let index = 0; index < cap; index += 1) counts[index % 4] += 1
  } else {
    // Rectangle and Long
    if (cap <= 4) {
      for (let index = 0; index < cap; index += 1) counts[index % 4] += 1
    } else {
      counts[2] = 1 // Left head
      counts[3] = 1 // Right head
      const remaining = cap - 2
      counts[0] = Math.ceil(remaining / 2) // Top
      counts[1] = Math.floor(remaining / 2) // Bottom
    }
  }

  const seats: SeatPosition[] = []
  counts.forEach((count, side) => {
    for (let index = 0; index < count; index += 1) {
      const fraction = (index + 1) / (count + 1)
      if (side === 0) seats.push({ x: (fraction - 0.5) * width, y: -height / 2 - 13, rotation: 0 })
      if (side === 1) seats.push({ x: (fraction - 0.5) * width, y: height / 2 + 13, rotation: 180 })
      if (side === 2) seats.push({ x: -width / 2 - 13, y: (fraction - 0.5) * height, rotation: 270 })
      if (side === 3) seats.push({ x: width / 2 + 13, y: (fraction - 0.5) * height, rotation: 90 })
    }
  })
  return seats
}

export function clampUnitPosition(
  unit: Pick<Unit, 'kind'> & { roomWidth?: number; roomHeight?: number },
  x: number,
  y: number,
  bounds: { width: number; height: number } = { width: 1000, height: 600 }
): { x: number; y: number } {
  const halfWidth = unit.kind === 'Room' ? (unit.roomWidth ?? 190) / 2 + 15 : unit.kind === 'Couch' ? 80 : 85
  const halfHeight = unit.kind === 'Room' ? (unit.roomHeight ?? 140) / 2 + 15 : unit.kind === 'Couch' ? 50 : 55
  const clampedX = Math.min(bounds.width - halfWidth, Math.max(halfWidth, x))
  const clampedY = Math.min(bounds.height - halfHeight, Math.max(halfHeight, y))
  return { x: clampedX, y: clampedY }
}

export function generateNextUnitId(kind: Unit['kind'], existingUnits: Unit[]): string {
  const nextNumber =
    Math.max(
      0,
      ...existingUnits
        .filter((item) => item.kind === kind)
        .map((item) => Number(item.id.match(/\d+/)?.[0] ?? 0))
    ) + 1
  return `${kind} ${nextNumber}`
}

export function createFloorUnit(kind: Unit['kind'], existingUnits: Unit[]): Unit {
  const id = generateNextUnitId(kind, existingUnits)
  const position = kind === 'Room' ? { x: 815, y: 470 } : kind === 'Couch' ? { x: 810, y: 390 } : { x: 500, y: 300 }
  const base = { id, status: 'available' as const, capacity: kind === 'Room' ? 4 : 2, ...position, rotation: 0 }
  if (kind === 'Table') {
    return { ...base, kind: 'Table', tableType: 'round' }
  }
  if (kind === 'Couch') {
    return { ...base, kind: 'Couch', couchType: 'loveseat' }
  }
  return { ...base, kind: 'Room', roomWidth: 190, roomHeight: 140, tableType: 'round' }
}

export function calculateFloorBoundingBox(units: Unit[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
  centerX: number
  centerY: number
  width: number
  height: number
} {
  const visible = units.filter((u) => !u.archived)
  if (visible.length === 0) {
    return { minX: 0, maxX: 1000, minY: 0, maxY: 600, centerX: 500, centerY: 300, width: 1000, height: 600 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const u of visible) {
    const halfW = u.kind === 'Room' ? (u.roomWidth ?? 190) / 2 + 10 : 65
    const halfH = u.kind === 'Room' ? (u.roomHeight ?? 140) / 2 + 10 : 50
    minX = Math.min(minX, u.x - halfW)
    maxX = Math.max(maxX, u.x + halfW)
    minY = Math.min(minY, u.y - halfH)
    maxY = Math.max(maxY, u.y + halfH)
  }

  const width = Math.max(250, maxX - minX)
  const height = Math.max(180, maxY - minY)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return { minX, maxX, minY, maxY, centerX, centerY, width, height }
}

export const FloorLayoutEngine = {
  TABLE_DIMENSIONS,
  getDynamicTableDimensions,
  getCouchDimensions,
  calculateFloorBoundingBox,
  snapToGrid,
  computeSeatLayout,
  clampUnitPosition,
  generateNextUnitId,
  createFloorUnit,
}
