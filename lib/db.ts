import { drizzle } from 'drizzle-orm/node-postgres'
import { bigint, date, integer, jsonb, numeric, pgTable, primaryKey, text, time, timestamp } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import type { RestaurantConfig } from '@/lib/restaurant-config'

export const restaurantWorkspaceConfig = pgTable('restaurant_workspace_config', {
  userId: text('user_id').primaryKey(),
  config: jsonb('config').$type<RestaurantConfig>().notNull().default({} as RestaurantConfig),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const restaurantReservations = pgTable('restaurant_reservations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  restaurantId: text('restaurant_id').notNull(),
  serviceDate: date('service_date', { mode: 'string' }).notNull(),
  reservationTime: time('reservation_time', { withTimezone: false }).notNull(),
  guestName: text('guest_name').notNull(),
  guestPhone: text('guest_phone').notNull(),
  partySize: integer('party_size').notNull(),
  unitId: text('unit_id').notNull(),
  unitKind: text('unit_kind').notNull(),
  tableType: text('table_type').notNull().default('any'),
  notes: text('notes').notNull().default(''),
  occasionTags: text('occasion_tags').array().notNull().default([]),
  status: text('status').notNull().default('booked'),
  billAmount: numeric('bill_amount', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  seatedAt: timestamp('seated_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  clientRequestId: text('client_request_id'),
})

export const restaurantUnitStates = pgTable('restaurant_unit_states', {
  restaurantId: text('restaurant_id').notNull(),
  unitId: text('unit_id').notNull(),
  status: text('status').notNull(),
  guestName: text('guest_name'),
  guestPhone: text('guest_phone'),
  partySize: integer('party_size'),
  serviceTime: text('service_time'),
  notes: text('notes').notNull().default(''),
  billAmount: numeric('bill_amount', { precision: 10, scale: 2, mode: 'number' }),
  reservationId: bigint('reservation_id', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.restaurantId, table.unitId] })])

export const restaurantServiceEvents = pgTable('restaurant_service_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  restaurantId: text('restaurant_id').notNull(),
  reservationId: bigint('reservation_id', { mode: 'number' }),
  eventKey: text('event_key').notNull().unique(),
  eventType: text('event_type').notNull(),
  guestPhone: text('guest_phone'),
  guestName: text('guest_name'),
  partySize: integer('party_size'),
  unitId: text('unit_id'),
  billAmount: numeric('bill_amount', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
})

export const restaurantGuestProfiles = pgTable('restaurant_guest_profiles', {
  restaurantId: text('restaurant_id').notNull(),
  phone: text('phone').notNull(),
  name: text('name').notNull(),
  visits: integer('visits').notNull().default(0),
  note: text('note').notNull().default(''),
  occasionTags: text('occasion_tags').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.restaurantId, table.phone] })])

const globalForPool = globalThis as unknown as { restaurantPool?: Pool }

export const pool = globalForPool.restaurantPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

if (process.env.NODE_ENV !== 'production') globalForPool.restaurantPool = pool

export const db = drizzle(pool)
