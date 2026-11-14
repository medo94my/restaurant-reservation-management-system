import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FloorLayoutEngine,
  TABLE_DIMENSIONS,
  clampUnitPosition,
  computeSeatLayout,
  createFloorUnit,
  generateNextUnitId,
  getDynamicTableDimensions,
} from './floor-layout.ts'
import type { TableShape, Unit } from './restaurant-config.ts'

test('FloorLayoutEngine - computeSeatLayout generates correct number of seats and positions for round and oval tables', () => {
  const round4 = computeSeatLayout({ tableType: 'round', capacity: 4 })
  assert.equal(round4.length, 4)
  for (const seat of round4) {
    assert.ok(Number.isFinite(seat.x))
    assert.ok(Number.isFinite(seat.y))
    assert.ok(Number.isFinite(seat.rotation))
  }

  const oval6 = FloorLayoutEngine.computeSeatLayout({ tableType: 'oval', capacity: 6 })
  assert.equal(oval6.length, 6)
  for (const seat of oval6) {
    assert.ok(Number.isFinite(seat.x))
    assert.ok(Number.isFinite(seat.y))
  }
})

test('FloorLayoutEngine - computeSeatLayout generates seats for rectangular and square tables', () => {
  const square4 = computeSeatLayout({ tableType: 'square', capacity: 4 })
  assert.equal(square4.length, 4)

  const rectangle6 = computeSeatLayout({ tableType: 'rectangle', capacity: 6 })
  assert.equal(rectangle6.length, 6)

  const long8 = computeSeatLayout({ tableType: 'long', capacity: 8 })
  assert.equal(long8.length, 8)
})

test('FloorLayoutEngine - computeSeatLayout aligns with getDynamicTableDimensions so seats never render inside larger tables', () => {
  const shapes: TableShape[] = ['round', 'oval', 'square', 'rectangle', 'long']
  const capacities = [2, 4, 6, 8, 10, 12, 16, 20]

  for (const tableType of shapes) {
    for (const capacity of capacities) {
      const dims = getDynamicTableDimensions(tableType, capacity)
      const seats = computeSeatLayout({ tableType, capacity })
      assert.equal(seats.length, capacity)

      const halfW = dims.width / 2
      const halfH = dims.height / 2

      for (const seat of seats) {
        if (tableType === 'round') {
          const dist = Math.hypot(seat.x, seat.y)
          assert.ok(
            dist >= halfW + 14.5,
            `Expected round(${capacity}) seat distance ${dist} to be outside tabletop radius ${halfW}`
          )
        } else if (tableType === 'oval') {
          const normalized = (seat.x / halfW) ** 2 + (seat.y / halfH) ** 2
          assert.ok(
            normalized > 1,
            `Expected oval(${capacity}) seat (${seat.x}, ${seat.y}) to be outside ellipse (${halfW}, ${halfH})`
          )
        } else {
          const outsideX = Math.abs(seat.x) >= halfW + 12.5
          const outsideY = Math.abs(seat.y) >= halfH + 12.5
          assert.ok(
            outsideX || outsideY,
            `Expected ${tableType}(${capacity}) seat (${seat.x}, ${seat.y}) to be outside tabletop (${halfW}, ${halfH})`
          )
        }
      }
    }
  }
})

test('FloorLayoutEngine - clampUnitPosition keeps coordinates within floor boundary', () => {
  const bounds = { width: 1000, height: 600 }

  // Table (halfWidth = 85, halfHeight = 55)
  const tableUnit = { kind: 'Table' as const }
  const clampedMin = clampUnitPosition(tableUnit, -50, -20, bounds)
  assert.equal(clampedMin.x, 85)
  assert.equal(clampedMin.y, 55)

  const clampedMax = clampUnitPosition(tableUnit, 2000, 1500, bounds)
  assert.equal(clampedMax.x, 1000 - 85)
  assert.equal(clampedMax.y, 600 - 55)

  const inside = clampUnitPosition(tableUnit, 400, 300, bounds)
  assert.equal(inside.x, 400)
  assert.equal(inside.y, 300)

  // Couch (halfWidth = 80, halfHeight = 50)
  const couchUnit = { kind: 'Couch' as const }
  const couchClamped = clampUnitPosition(couchUnit, 0, 0, bounds)
  assert.equal(couchClamped.x, 80)
  assert.equal(couchClamped.y, 50)

  // Room (roomWidth = 200 -> halfWidth = 100 + 15 = 115, roomHeight = 160 -> halfHeight = 80 + 15 = 95)
  const roomUnit = { kind: 'Room' as const, roomWidth: 200, roomHeight: 160 }
  const roomClamped = clampUnitPosition(roomUnit, 10, 10, bounds)
  assert.equal(roomClamped.x, 115)
  assert.equal(roomClamped.y, 95)
})

test('FloorLayoutEngine - generateNextUnitId generates sequential IDs per unit kind', () => {
  const existing: Unit[] = [
    {
      id: 'Table 1',
      kind: 'Table',
      tableType: 'round',
      capacity: 4,
      status: 'available',
      x: 100,
      y: 100,
      rotation: 0,
    },
    {
      id: 'Table 2',
      kind: 'Table',
      tableType: 'square',
      capacity: 2,
      status: 'available',
      x: 200,
      y: 100,
      rotation: 0,
    },
    {
      id: 'Couch 5',
      kind: 'Couch',
      couchType: 'loveseat',
      capacity: 2,
      status: 'available',
      x: 300,
      y: 100,
      rotation: 0,
    },
  ]

  assert.equal(generateNextUnitId('Table', existing), 'Table 3')
  assert.equal(generateNextUnitId('Couch', existing), 'Couch 6')
  assert.equal(generateNextUnitId('Room', existing), 'Room 1')
  assert.equal(generateNextUnitId('Table', []), 'Table 1')
})

test('FloorLayoutEngine - createFloorUnit creates a complete Unit with proper defaults', () => {
  const table = createFloorUnit('Table', [])
  assert.equal(table.id, 'Table 1')
  assert.equal(table.kind, 'Table')
  if (table.kind === 'Table') {
    assert.equal(table.tableType, 'round')
  }
  assert.equal(table.status, 'available')
  assert.equal(table.capacity, 2)
  assert.equal(table.x, 500)
  assert.equal(table.y, 300)

  const couch = createFloorUnit('Couch', [table])
  assert.equal(couch.id, 'Couch 1')
  assert.equal(couch.kind, 'Couch')
  if (couch.kind === 'Couch') {
    assert.equal(couch.couchType, 'loveseat')
  }

  const room = createFloorUnit('Room', [table, couch])
  assert.equal(room.id, 'Room 1')
  assert.equal(room.kind, 'Room')
  if (room.kind === 'Room') {
    assert.equal(room.roomWidth, 190)
    assert.equal(room.roomHeight, 140)
    assert.equal(room.capacity, 4)
  }
})
