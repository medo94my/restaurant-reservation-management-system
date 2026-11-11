import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import type { RestaurantConfig } from '@/lib/restaurant-config'

export const restaurantWorkspaceConfig = pgTable('restaurant_workspace_config', {
  userId: text('user_id').primaryKey(),
  config: jsonb('config').$type<RestaurantConfig>().notNull().default({} as RestaurantConfig),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

const globalForPool = globalThis as unknown as { restaurantPool?: Pool }

const pool = globalForPool.restaurantPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

if (process.env.NODE_ENV !== 'production') globalForPool.restaurantPool = pool

export const db = drizzle(pool)
