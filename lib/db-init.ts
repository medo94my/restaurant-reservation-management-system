import { Pool } from 'pg'

/**
 * Idempotent DDL bootstrapping every table used by the app (domain tables + Better Auth tables).
 * Kept in sync with `lib/schema.ts`.
 */
export const DATABASE_INIT_SQL = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      DO $$ BEGIN
        CREATE TYPE reservation_status AS ENUM ('booked', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE staff_role AS ENUM ('host', 'server', 'manager', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      -- Better Auth "user" table created before staff_members so staff_members.auth_user_id FK resolves on fresh DBs
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        image TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        username TEXT UNIQUE,
        display_username TEXT,
        role TEXT NOT NULL DEFAULT 'host',
        staff_id TEXT UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        workspace_id TEXT
      );

      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS workspace_id TEXT;
      ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'host';

      CREATE TABLE IF NOT EXISTS staff_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        name VARCHAR(80) NOT NULL,
        role staff_role NOT NULL DEFAULT 'host',
        hashed_pin VARCHAR(128) NOT NULL,
        pin_salt VARCHAR(64) NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS pin_salt VARCHAR(64) NOT NULL DEFAULT '';
      ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS auth_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(24) NOT NULL UNIQUE,
        email VARCHAR(160),
        visit_count INTEGER NOT NULL DEFAULT 0,
        total_spend NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        loyalty_tier VARCHAR(32) NOT NULL DEFAULT 'new',
        dietary_flags TEXT[] NOT NULL DEFAULT '{}',
        seating_preferences TEXT[] NOT NULL DEFAULT '{}',
        occasion_tags TEXT[] NOT NULL DEFAULT '{}',
        permanent_notes TEXT NOT NULL DEFAULT '',
        last_visit_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE customers ADD COLUMN IF NOT EXISTS occasion_tags TEXT[] NOT NULL DEFAULT '{}';

      CREATE TABLE IF NOT EXISTS reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES customers(id),
        table_id VARCHAR(80),
        party_size INTEGER NOT NULL,
        reservation_time TIMESTAMPTZ NOT NULL,
        expected_duration_min INTEGER NOT NULL DEFAULT 90,
        status reservation_status NOT NULL DEFAULT 'booked',
        shift_note TEXT NOT NULL DEFAULT '',
        created_by_staff_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS floor_layouts (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        layout_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_by_staff_id UUID,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reservation_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reservation_id UUID NOT NULL REFERENCES reservations(id),
        staff_id UUID,
        action VARCHAR(60) NOT NULL,
        previous_state JSONB,
        new_state JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        phone_number VARCHAR(32),
        email VARCHAR(160),
        address TEXT,
        country VARCHAR(64) NOT NULL DEFAULT 'Lebanon',
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Beirut',
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        is_onboarding_completed BOOLEAN NOT NULL DEFAULT false,
        onboarding_step INTEGER NOT NULL DEFAULT 1,
        onboarding_session_token TEXT,
        onboarding_expires_at TIMESTAMPTZ,
        onboarding_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS restaurant_operations (
        id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
        workspace_id VARCHAR(64) REFERENCES workspaces(id),
        lunch_start VARCHAR(10) NOT NULL DEFAULT '12:00 PM',
        lunch_end VARCHAR(10) NOT NULL DEFAULT '04:30 PM',
        dinner_start VARCHAR(10) NOT NULL DEFAULT '06:30 PM',
        dinner_end VARCHAR(10) NOT NULL DEFAULT '11:30 PM',
        operating_days TEXT[] NOT NULL DEFAULT '{"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"}',
        reservation_interval_min INTEGER NOT NULL DEFAULT 15,
        turn_time_small_min INTEGER NOT NULL DEFAULT 90,
        turn_time_large_min INTEGER NOT NULL DEFAULT 120,
        seating_preferences TEXT[] NOT NULL DEFAULT '{"Quiet table","Window","Booth","Central dining"}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS restaurant_workspace_config (
        user_id TEXT PRIMARY KEY,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS restaurant_branding (
        id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
        workspace_id VARCHAR(64),
        restaurant_name VARCHAR(120) NOT NULL DEFAULT 'Saffron & Cedar',
        tagline VARCHAR(255) NOT NULL DEFAULT 'Beirut Dining Room',
        logo_url TEXT,
        primary_color VARCHAR(32) NOT NULL DEFAULT '#d7b46a',
        secondary_color VARCHAR(32) NOT NULL DEFAULT '#bfa15f',
        background_color VARCHAR(32) NOT NULL DEFAULT '#111312',
        surface_color VARCHAR(32) NOT NULL DEFAULT '#171a18',
        text_color VARCHAR(32) NOT NULL DEFAULT '#f4efe6',
        font_family VARCHAR(64) NOT NULL DEFAULT 'Cinzel',
        is_published BOOLEAN NOT NULL DEFAULT true,
        updated_by_staff_id TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Better Auth Tables
      ALTER TABLE restaurant_branding ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(64);

      CREATE TABLE IF NOT EXISTS "session" (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "account" (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMPTZ,
        refresh_token_expires_at TIMESTAMPTZ,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "verification" (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(reservation_time, status);
      CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id, reservation_time);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_user_username ON "user"(username);
      CREATE INDEX IF NOT EXISTS idx_user_staff_id ON "user"(staff_id);
      CREATE INDEX IF NOT EXISTS idx_user_role ON "user"(role);
      CREATE INDEX IF NOT EXISTS idx_staff_members_auth_user_id ON staff_members(auth_user_id);
`

export async function ensureDatabaseTables(pool: Pool) {
  const client = await pool.connect()
  try {
    await client.query(DATABASE_INIT_SQL)
  } finally {
    client.release()
  }
}
