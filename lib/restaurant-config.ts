export type TableShape = 'round' | 'square' | 'rectangle' | 'oval' | 'long'
export type CouchShape = 'loveseat' | 'sofa' | 'l-sectional' | 'banquette'
export type TableStatus = 'available' | 'seated' | 'prep' | 'blocked'

export const TABLE_SHAPES: readonly TableShape[] = ['round', 'square', 'rectangle', 'oval', 'long']
export const COUCH_SHAPES: readonly CouchShape[] = ['loveseat', 'sofa', 'l-sectional', 'banquette']
export const TABLE_STATUSES: readonly TableStatus[] = ['available', 'seated', 'prep', 'blocked']

type FloorItemBase = {
  id: string
  capacity: number
  status: TableStatus
  x: number
  y: number
  rotation: number
  guest?: string
  pax?: number
  time?: string
  note?: string
  bill?: number
  archived?: boolean
}

export type TableUnit = FloorItemBase & { kind: 'Table'; tableType: TableShape }
export type CouchUnit = FloorItemBase & { kind: 'Couch'; couchType: CouchShape }
export type RoomUnit = FloorItemBase & {
  kind: 'Room'
  roomWidth: number
  roomHeight: number
  tableType: TableShape
}
export type Unit = TableUnit | CouchUnit | RoomUnit

export type Booking = {
  id: number
  name: string
  phone: string
  pax: number
  kind: Unit['kind']
  tableType: TableShape | 'any'
  time: string
  note: string
  unit: string
  arrived?: boolean
  occasionTags?: string[]
  customOccasion?: string
}

export type CustomerProfile = {
  phone: string
  name: string
  visits: number
  note: string
  occasionTags: string[]
}

export type VisitTier = {
  id: string
  label: string
  minVisits: number
  color: string
}

export type OccasionTag = {
  id: string
  label: string
  color: string
}

export type RestaurantConfig = {
  visitTiers: VisitTier[]
  occasionTags: OccasionTag[]
  customers: CustomerProfile[]
  floorItems: Unit[]
}

export const RESTAURANT_MANAGER_USER_ID = 'saffron-cedar-manager'

export const DEFAULT_VISIT_TIERS: VisitTier[] = [
  { id: 'new', label: 'New', minVisits: 0, color: '#879489' },
  { id: 'regular', label: 'Regular', minVisits: 5, color: '#91b596' },
  { id: 'loyal', label: 'Loyal', minVisits: 10, color: '#d7b46a' },
]

export const DEFAULT_OCCASION_TAGS: OccasionTag[] = [
  { id: 'birthday', label: 'Birthday', color: '#d69083' },
  { id: 'anniversary', label: 'Anniversary', color: '#d7b46a' },
  { id: 'vip', label: 'VIP', color: '#b4a0e0' },
  { id: 'vvip', label: 'VVIP', color: '#e4c47d' },
  { id: 'other', label: 'Others', color: '#c9a875' },
]

export const DEFAULT_CUSTOMERS: CustomerProfile[] = [
  { phone: '96170123456', name: 'Nadia Khoury', visits: 12, note: 'Always requests a quiet table · no coriander', occasionTags: ['vip'] },
  { phone: '96171111111', name: 'Karim Haddad', visits: 8, note: 'Prefers a central table', occasionTags: [] },
  { phone: '96176123456', name: 'Maya Saad', visits: 6, note: 'Window table if available', occasionTags: ['birthday'] },
  { phone: '96170111999', name: 'Tarek Nassar', visits: 15, note: 'Celebrates anniversary · discreet service', occasionTags: ['anniversary', 'vvip'] },
  { phone: '96131234567', name: 'Leila Farah', visits: 4, note: 'Vegetarian mezze', occasionTags: [] },
]

const tableCapacities = [2, 4, 4, 6, 8]

const defaultTables: TableUnit[] = Array.from({ length: 12 }, (_, index) => {
  const row = Math.floor(index / 3)
  const column = index % 3
  const status: TableStatus = index === 4 ? 'prep' : [0, 8].includes(index) ? 'seated' : 'available'
  const guest = index === 0 ? 'Rami Mansour' : index === 4 ? 'Nadia Khoury' : index === 8 ? 'Omar & friends' : undefined

  return {
    id: `Table ${index + 1}`,
    kind: 'Table',
    tableType: TABLE_SHAPES[index % TABLE_SHAPES.length],
    capacity: tableCapacities[index % tableCapacities.length],
    status,
    x: 135 + column * 220,
    y: 105 + row * 125,
    rotation: 0,
    ...(guest ? { guest, pax: index === 0 ? 2 : index === 4 ? 8 : 5, time: index === 0 ? '6:50 PM' : index === 4 ? '8:40 PM' : '7:15 PM' } : {}),
    ...(index === 4 ? { note: 'Regular guest' } : {}),
  }
})

export const DEFAULT_FLOOR_ITEMS: Unit[] = [
  ...defaultTables,
  { id: 'Couch 1', kind: 'Couch', couchType: 'loveseat', capacity: 2, status: 'available', x: 805, y: 115, rotation: 0 },
  { id: 'Couch 2', kind: 'Couch', couchType: 'sofa', capacity: 3, status: 'available', x: 805, y: 280, rotation: 0 },
  { id: 'Room 1', kind: 'Room', roomWidth: 190, roomHeight: 140, tableType: 'round', capacity: 4, status: 'available', x: 815, y: 475, rotation: 0 },
]

export const DEFAULT_RESTAURANT_CONFIG: RestaurantConfig = {
  visitTiers: DEFAULT_VISIT_TIERS,
  occasionTags: DEFAULT_OCCASION_TAGS,
  customers: DEFAULT_CUSTOMERS,
  floorItems: DEFAULT_FLOOR_ITEMS,
}
