import { relations } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const reservationStatusEnum = pgEnum('reservation_status', [
  'booked',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no_show',
])

export const staffRoleEnum = pgEnum('staff_role', [
  'host',
  'server',
  'manager',
  'admin',
])

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 24 }).notNull().unique(),
  email: varchar('email', { length: 160 }),
  visitCount: integer('visit_count').notNull().default(0),
  totalSpend: numeric('total_spend', { precision: 10, scale: 2 }).notNull().default('0.00'),
  loyaltyTier: varchar('loyalty_tier', { length: 32 }).notNull().default('new'),
  dietaryFlags: text('dietary_flags').array().notNull().default([]),
  seatingPreferences: text('seating_preferences').array().notNull().default([]),
  occasionTags: text('occasion_tags').array().notNull().default([]),
  permanentNotes: text('permanent_notes').notNull().default(''),
  lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .references(() => customers.id)
    .notNull(),
  /**
   * Reference to the assigned floor unit (Unit).
   *
   * Canonical Modeling Note (GLOSSARY.md - Unit):
   * While named `table_id` in the relational schema for database compatibility,
   * this column stores the identifier for any physical floor Unit in the dining room,
   * including standard Tables (e.g. 'Table 1'), Couches (e.g. 'Couch 1'), or
   * private dining Rooms (e.g. 'Room 1').
   *
   * Use `getReservationUnitId(reservation)` or `withUnitAlias(reservation)` for canonical
   * domain interactions referencing floor units.
   */
  tableId: varchar('table_id', { length: 80 }),
  partySize: integer('party_size').notNull(),
  reservationTime: timestamp('reservation_time', { withTimezone: true }).notNull(),
  expectedDurationMin: integer('expected_duration_min').notNull().default(90),
  status: reservationStatusEnum('status').notNull().default('booked'),
  shiftNote: text('shift_note').notNull().default(''),
  createdByStaffId: uuid('created_by_staff_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  // Canonical default matches the `staff_role` enum / GLOSSARY.md ('host').
  // Legacy rows may still hold 'hostess', which is treated as an alias of 'host'.
  role: text('role').notNull().default('host'),
  staffId: text('staff_id').unique(),
  isActive: boolean('is_active').notNull().default(true),
  workspaceId: text('workspace_id'),
})

export const staffMembers = pgTable('staff_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  /**
   * Optional foreign-key link to the corresponding Better Auth `user` account (`user.id`).
   * Bridges PIN-based floor operations (`staff_members`) with Better Auth sessions (`user`).
   */
  authUserId: text('auth_user_id').references(() => user.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 80 }).notNull(),
  role: staffRoleEnum('role').notNull().default('host'),
  hashedPin: varchar('hashed_pin', { length: 128 }).notNull(),
  /**
   * Per-member random scrypt salt for `hashed_pin`. Required to verify the PIN after restart.
   * Legacy rows created before this column existed have '' and must have their PIN reset.
   */
  pinSalt: varchar('pin_salt', { length: 64 }).notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const floorLayouts = pgTable('floor_layouts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  layoutItems: jsonb('layout_items').notNull().default([]),
  updatedByStaffId: uuid('updated_by_staff_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reservationAuditLogs = pgTable('reservation_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id')
    .references(() => reservations.id)
    .notNull(),
  staffId: uuid('staff_id'),
  action: varchar('action', { length: 60 }).notNull(),
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const restaurantBranding = pgTable('restaurant_branding', {
  id: varchar('id', { length: 64 }).primaryKey().default('default'),
  workspaceId: varchar('workspace_id', { length: 64 }),
  restaurantName: varchar('restaurant_name', { length: 120 }).notNull().default('Saffron & Cedar'),
  tagline: varchar('tagline', { length: 255 }).notNull().default('Beirut Dining Room'),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 32 }).notNull().default('#d7b46a'),
  secondaryColor: varchar('secondary_color', { length: 32 }).notNull().default('#bfa15f'),
  backgroundColor: varchar('background_color', { length: 32 }).notNull().default('#111312'),
  surfaceColor: varchar('surface_color', { length: 32 }).notNull().default('#171a18'),
  textColor: varchar('text_color', { length: 32 }).notNull().default('#f4efe6'),
  fontFamily: varchar('font_family', { length: 64 }).notNull().default('Cinzel'),
  isPublished: boolean('is_published').notNull().default(true),
  updatedByStaffId: text('updated_by_staff_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaces = pgTable('workspaces', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  phoneNumber: varchar('phone_number', { length: 32 }),
  email: varchar('email', { length: 160 }),
  address: text('address'),
  country: varchar('country', { length: 64 }).notNull().default('Lebanon'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Beirut'),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  isOnboardingCompleted: boolean('is_onboarding_completed').notNull().default(false),
  onboardingStep: integer('onboarding_step').notNull().default(1),
  onboardingSessionToken: text('onboarding_session_token'),
  onboardingExpiresAt: timestamp('onboarding_expires_at', { withTimezone: true }),
  onboardingData: jsonb('onboarding_data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const restaurantOperations = pgTable('restaurant_operations', {
  id: varchar('id', { length: 64 }).primaryKey().default('default'),
  workspaceId: varchar('workspace_id', { length: 64 }),
  lunchStart: varchar('lunch_start', { length: 10 }).notNull().default('12:00 PM'),
  lunchEnd: varchar('lunch_end', { length: 10 }).notNull().default('04:30 PM'),
  dinnerStart: varchar('dinner_start', { length: 10 }).notNull().default('06:30 PM'),
  dinnerEnd: varchar('dinner_end', { length: 10 }).notNull().default('11:30 PM'),
  operatingDays: text('operating_days').array().notNull().default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  reservationIntervalMin: integer('reservation_interval_min').notNull().default(15),
  turnTimeSmallMin: integer('turn_time_small_min').notNull().default(90),
  turnTimeLargeMin: integer('turn_time_large_min').notNull().default(120),
  seatingPreferences: text('seating_preferences').array().notNull().default(['Quiet table', 'Window', 'Booth', 'Central dining']),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type RestaurantOperation = typeof restaurantOperations.$inferSelect
export type NewRestaurantOperation = typeof restaurantOperations.$inferInsert
export type RestaurantBranding = typeof restaurantBranding.$inferSelect
export type NewRestaurantBranding = typeof restaurantBranding.$inferInsert
export type AuthUser = typeof user.$inferSelect
export type AuthSession = typeof session.$inferSelect


export const customersRelations = relations(customers, ({ many }) => ({
  reservations: many(reservations),
}))

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [reservations.customerId],
    references: [customers.id],
  }),
  auditLogs: many(reservationAuditLogs),
}))

export const reservationAuditLogsRelations = relations(reservationAuditLogs, ({ one }) => ({
  reservation: one(reservations, {
    fields: [reservationAuditLogs.reservationId],
    references: [reservations.id],
  }),
}))

export const staffMembersRelations = relations(staffMembers, ({ one }) => ({
  authUser: one(user, {
    fields: [staffMembers.authUserId],
    references: [user.id],
  }),
}))

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type Reservation = typeof reservations.$inferSelect
export type NewReservation = typeof reservations.$inferInsert
export type StaffMember = typeof staffMembers.$inferSelect
export type NewStaffMember = typeof staffMembers.$inferInsert
export type FloorLayout = typeof floorLayouts.$inferSelect
export type NewFloorLayout = typeof floorLayouts.$inferInsert
export type ReservationAuditLog = typeof reservationAuditLogs.$inferSelect
export type NewReservationAuditLog = typeof reservationAuditLogs.$inferInsert
export type ReservationStatus = (typeof reservationStatusEnum.enumValues)[number]
export type StaffRole = (typeof staffRoleEnum.enumValues)[number]

/**
 * Canonical Floor Unit kinds supported in the dining room as defined in GLOSSARY.md:
 * - Table: Standard dining table (round, square, rectangle, oval, long)
 * - Couch: Lounge seating unit (loveseat, sofa, l-sectional, banquette)
 * - Room: Enclosed private dining area with interior table furniture
 */
export type FloorUnitKind = 'Table' | 'Couch' | 'Room'

export const FLOOR_UNIT_KINDS = ['Table', 'Couch', 'Room'] as const

/**
 * Validates whether a string matches any canonical floor Unit kind.
 */
export function isFloorUnitKind(kind: string): kind is FloorUnitKind {
  return (FLOOR_UNIT_KINDS as readonly string[]).includes(kind)
}

/**
 * Returns the canonical Unit ID assigned to a reservation.
 * Aliases `reservation.tableId` to the canonical GLOSSARY.md term `Unit`,
 * accommodating any floor unit kind (`Table`, `Couch`, `Room`).
 */
export function getReservationUnitId(reservation: { tableId?: string | null }): string | null {
  return reservation.tableId ?? null
}

/**
 * Reservation record decorated with canonical `unitId` alias field
 * representing the assigned floor Unit ('Table', 'Couch', 'Room').
 */
export type ReservationWithUnit = Reservation & {
  /** Canonical alias for tableId referencing any floor Unit */
  unitId: string | null
}

/**
 * Maps a reservation record to include the canonical `unitId` alias property.
 */
export function withUnitAlias<T extends { tableId: string | null }>(
  reservation: T
): T & { unitId: string | null } {
  return {
    ...reservation,
    unitId: reservation.tableId,
  }
}
