import { createHash } from 'node:crypto'
import { desc, eq, ilike, or, sql } from 'drizzle-orm'
import { customers, db } from './db.ts'
import { normalizePhone } from './phone.ts'
import {
  DEFAULT_CUSTOMERS,
  type CustomerProfile,
} from './restaurant-config.ts'

export { normalizePhone }

export const DEFAULT_CUSTOMER_SEARCH_LIMIT = 50

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function toDbUuid(id?: string | null): string {
  if (!id) {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : '00000000-0000-4000-a000-000000000000'
  }
  if (UUID_REGEX.test(id)) return id
  if (id.startsWith('cust-')) {
    const stripped = id.slice(5)
    if (UUID_REGEX.test(stripped)) return stripped
  }
  if (id.startsWith('staff-')) {
    const stripped = id.slice(6)
    if (UUID_REGEX.test(stripped)) return stripped
  }
  const hex = createHash('md5').update(id).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export type LoyaltyTier = 'new' | 'regular' | 'loyal' | 'vip'

export interface Customer {
  id: string
  name: string
  phone: string
  dietaryFlags: string[]
  seatingPreferences?: string
  permanentNotes?: string
  visitCount: number
  totalSpend: number
  lastVisitAt?: Date | string | null
  loyaltyTier: LoyaltyTier
  createdAt: Date | string
  updatedAt: Date | string
  note?: string
  visits?: number
  occasionTags?: string[]
}

export interface CreateCustomerInput {
  name: string
  phone: string
  dietaryFlags?: string[]
  seatingPreferences?: string
  permanentNotes?: string
  note?: string
  visitCount?: number
  totalSpend?: number
  occasionTags?: string[]
}

export interface UpdateCustomerInput {
  name?: string
  phone?: string
  dietaryFlags?: string[]
  seatingPreferences?: string
  permanentNotes?: string
  note?: string
  visitCount?: number
  totalSpend?: number
  lastVisitAt?: Date | string | null
  occasionTags?: string[]
}

export class CustomerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CustomerValidationError'
  }
}

export class CustomerAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CustomerAlreadyExistsError'
  }
}

export class CustomerNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CustomerNotFoundError'
  }
}

/**
 * Masks a phone number for non-manager staff roles (GLOSSARY.md role-based data masking),
 * preserving only the last 4 digits.
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!normalized) return ''
  if (normalized.length <= 4) return '*'.repeat(normalized.length)
  return `${'*'.repeat(normalized.length - 4)}${normalized.slice(-4)}`
}

/**
 * Applies role-based data masking to a Customer record per GLOSSARY.md.
 * Managers and admins receive the full unmasked customer profile;
 * non-manager roles (e.g. host, server) have phone numbers masked and
 * financial spend / permanent CRM notes redacted.
 */
export function maskCustomerForRole(customer: Customer, role?: string | null): Customer {
  if (role === 'manager' || role === 'admin') {
    return {
      ...customer,
      dietaryFlags: Array.isArray(customer.dietaryFlags) ? [...customer.dietaryFlags] : [],
      occasionTags: Array.isArray(customer.occasionTags) ? [...customer.occasionTags] : [],
    }
  }
  return {
    ...customer,
    phone: maskPhone(customer.phone),
    totalSpend: 0,
    permanentNotes: '',
    note: '',
    dietaryFlags: Array.isArray(customer.dietaryFlags) ? [...customer.dietaryFlags] : [],
    occasionTags: Array.isArray(customer.occasionTags) ? [...customer.occasionTags] : [],
  }
}

/**
 * Resolves the loyalty tier based on cumulative visit count:
 * - 0-4 visits: 'new'
 * - 5-9 visits: 'regular'
 * - 10-14 visits: 'loyal'
 * - 15+ visits: 'vip'
 */
export function resolveLoyaltyTier(visitCount: number): LoyaltyTier {
  const count = Number(visitCount) || 0
  if (count >= 15) return 'vip'
  if (count >= 10) return 'loyal'
  if (count >= 5) return 'regular'
  return 'new'
}

const TIER_WEIGHT: Record<LoyaltyTier, number> = {
  vip: 40,
  loyal: 30,
  regular: 20,
  new: 10,
}

export function customerProfileToCustomer(profile: CustomerProfile, index = 0): Customer {
  const normalizedPhone = normalizePhone(profile.phone)
  const dietaryFlags: string[] = []
  let seatingPreferences = ''
  const noteLower = (profile.note || '').toLowerCase()

  if (noteLower.includes('vegetarian')) dietaryFlags.push('vegetarian')
  if (noteLower.includes('coriander') || noteLower.includes('no coriander')) dietaryFlags.push('no-coriander')
  if (noteLower.includes('gluten')) dietaryFlags.push('gluten-free')
  if (noteLower.includes('dairy')) dietaryFlags.push('dairy-free')
  if (noteLower.includes('nut')) dietaryFlags.push('nut-free')

  if (noteLower.includes('quiet table')) seatingPreferences = 'Quiet table'
  else if (noteLower.includes('central table')) seatingPreferences = 'Central table'
  else if (noteLower.includes('window table')) seatingPreferences = 'Window table'
  else if (noteLower.includes('discreet')) seatingPreferences = 'Discreet service'

  const visitCount = Number(profile.visits) || 0
  const loyaltyTier = resolveLoyaltyTier(visitCount)

  return {
    id: `cust-${index + 1}`,
    name: profile.name,
    phone: normalizedPhone,
    dietaryFlags,
    seatingPreferences,
    permanentNotes: profile.note || '',
    visitCount,
    totalSpend: visitCount * 85,
    lastVisitAt: visitCount > 0 ? new Date(Date.now() - (25 - Math.min(visitCount, 24)) * 86400000).toISOString() : null,
    loyaltyTier,
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date().toISOString(),
    note: profile.note,
    visits: visitCount,
    occasionTags: profile.occasionTags || [],
  }
}

export function createDefaultCustomers(): Customer[] {
  return DEFAULT_CUSTOMERS.map((profile, i) => customerProfileToCustomer(profile, i))
}

export interface CustomerStorageAdapter {
  findCustomerByPhone(phone: string): Promise<Customer | null>
  searchCustomers(query: string): Promise<Customer[]>
  createCustomer(data: Customer): Promise<Customer>
  updateCustomer(id: string, data: Partial<Customer>): Promise<Customer>
  recordVisitAndSpend(id: string, billAmount: number): Promise<Customer>
  getCustomerById(id: string): Promise<Customer | null>
}

export class InMemoryCustomerStorageAdapter implements CustomerStorageAdapter {
  private storage = new Map<string, Customer>()

  constructor(initialCustomers?: Customer[]) {
    if (initialCustomers !== undefined) {
      for (const customer of initialCustomers) {
        this.storage.set(customer.id, { ...customer })
      }
    } else {
      this.seed()
    }
  }

  seed(customers: Customer[] = createDefaultCustomers()): void {
    this.storage.clear()
    for (const customer of customers) {
      this.storage.set(customer.id, { ...customer })
    }
  }

  clear(): void {
    this.storage.clear()
  }

  async findCustomerByPhone(phone: string): Promise<Customer | null> {
    const normalized = normalizePhone(phone)
    if (!normalized) return null

    for (const customer of this.storage.values()) {
      if (customer.phone === normalized) {
        return { ...customer }
      }
    }
    return null
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const all = Array.from(this.storage.values())
    const trimmed = (query ?? '').trim().toLowerCase()
    const digitsOnly = normalizePhone(query ?? '')

    if (!trimmed) {
      // Return top recent and loyal customers
      return all
        .slice()
        .sort((a, b) => {
          if (a.lastVisitAt && b.lastVisitAt) {
            const diff = new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime()
            if (diff !== 0) return diff
          } else if (a.lastVisitAt) {
            return -1
          } else if (b.lastVisitAt) {
            return 1
          }

          const tierDiff = TIER_WEIGHT[b.loyaltyTier] - TIER_WEIGHT[a.loyaltyTier]
          if (tierDiff !== 0) return tierDiff

          const visitDiff = b.visitCount - a.visitCount
          if (visitDiff !== 0) return visitDiff

          return b.totalSpend - a.totalSpend
        })
        .map((c) => ({ ...c }))
    }

    const matches = all.filter((customer) => {
      const nameMatch = customer.name.toLowerCase().includes(trimmed)
      const phoneMatch =
        (digitsOnly.length > 0 && customer.phone.includes(digitsOnly)) ||
        customer.phone.toLowerCase().includes(trimmed)
      return nameMatch || phoneMatch
    })

    // Sort matching results: exact name prefix or phone prefix first, then loyalty
    return matches
      .sort((a, b) => {
        const aNameStarts = a.name.toLowerCase().startsWith(trimmed)
        const bNameStarts = b.name.toLowerCase().startsWith(trimmed)
        if (aNameStarts && !bNameStarts) return -1
        if (!aNameStarts && bNameStarts) return 1

        const aPhoneStarts = digitsOnly.length > 0 && a.phone.startsWith(digitsOnly)
        const bPhoneStarts = digitsOnly.length > 0 && b.phone.startsWith(digitsOnly)
        if (aPhoneStarts && !bPhoneStarts) return -1
        if (!aPhoneStarts && bPhoneStarts) return 1

        const tierDiff = TIER_WEIGHT[b.loyaltyTier] - TIER_WEIGHT[a.loyaltyTier]
        if (tierDiff !== 0) return tierDiff

        return b.visitCount - a.visitCount
      })
      .map((c) => ({ ...c }))
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const customer = this.storage.get(id)
    return customer ? { ...customer } : null
  }

  async createCustomer(data: Customer): Promise<Customer> {
    const normalizedPhone = normalizePhone(data.phone)
    for (const existing of this.storage.values()) {
      if (existing.phone === normalizedPhone) {
        throw new CustomerAlreadyExistsError(`Customer with phone ${normalizedPhone} already exists.`)
      }
    }

    const newCustomer: Customer = {
      ...data,
      phone: normalizedPhone,
      dietaryFlags: Array.isArray(data.dietaryFlags) ? [...data.dietaryFlags] : [],
      visitCount: data.visitCount ?? 0,
      totalSpend: data.totalSpend ?? 0,
      loyaltyTier: resolveLoyaltyTier(data.visitCount ?? 0),
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      visits: data.visitCount ?? 0,
      note: data.permanentNotes ?? data.note ?? '',
      occasionTags: Array.isArray(data.occasionTags) ? [...data.occasionTags] : [],
    }

    this.storage.set(newCustomer.id, newCustomer)
    return { ...newCustomer }
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const existing = this.storage.get(id)
    if (!existing) {
      throw new CustomerNotFoundError(`Customer with ID ${id} not found.`)
    }

    if (data.phone !== undefined) {
      const normalizedPhone = normalizePhone(data.phone)
      for (const [otherId, other] of this.storage.entries()) {
        if (otherId !== id && other.phone === normalizedPhone) {
          throw new CustomerAlreadyExistsError(`Customer with phone ${normalizedPhone} already exists.`)
        }
      }
      existing.phone = normalizedPhone
    }

    if (data.name !== undefined) existing.name = data.name.trim()
    if (data.dietaryFlags !== undefined) {
      existing.dietaryFlags = Array.isArray(data.dietaryFlags) ? [...data.dietaryFlags] : []
    }
    if (data.seatingPreferences !== undefined) existing.seatingPreferences = data.seatingPreferences
    if (data.permanentNotes !== undefined) {
      existing.permanentNotes = data.permanentNotes
      existing.note = data.permanentNotes
    } else if (data.note !== undefined) {
      existing.permanentNotes = data.note
      existing.note = data.note
    }

    if (data.visitCount !== undefined) {
      existing.visitCount = Number(data.visitCount) || 0
      existing.visits = existing.visitCount
      existing.loyaltyTier = resolveLoyaltyTier(existing.visitCount)
    }

    if (data.totalSpend !== undefined) {
      existing.totalSpend = Number(data.totalSpend) || 0
    }

    if (data.lastVisitAt !== undefined) {
      existing.lastVisitAt = data.lastVisitAt
    }

    if (data.occasionTags !== undefined) {
      existing.occasionTags = Array.isArray(data.occasionTags) ? [...data.occasionTags] : []
    }

    existing.updatedAt = new Date().toISOString()
    this.storage.set(id, existing)
    return { ...existing }
  }

  async recordVisitAndSpend(id: string, billAmount: number): Promise<Customer> {
    const existing = this.storage.get(id)
    if (!existing) {
      throw new CustomerNotFoundError(`Customer with ID ${id} not found.`)
    }

    const bill = Math.max(0, Number(billAmount) || 0)
    existing.visitCount = (existing.visitCount || 0) + 1
    existing.visits = existing.visitCount
    existing.totalSpend = Number(((existing.totalSpend || 0) + bill).toFixed(2))
    existing.lastVisitAt = new Date()
    existing.loyaltyTier = resolveLoyaltyTier(existing.visitCount)
    existing.updatedAt = new Date().toISOString()

    this.storage.set(id, existing)
    return { ...existing }
  }
}

export function dbRowToCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    dietaryFlags: Array.isArray(row.dietaryFlags) ? row.dietaryFlags : [],
    seatingPreferences: Array.isArray(row.seatingPreferences) ? row.seatingPreferences.join(', ') : '',
    permanentNotes: row.permanentNotes || '',
    note: row.permanentNotes || '',
    visitCount: row.visitCount,
    visits: row.visitCount,
    totalSpend: Number(row.totalSpend) || 0,
    lastVisitAt: row.lastVisitAt
      ? row.lastVisitAt instanceof Date
        ? row.lastVisitAt.toISOString()
        : String(row.lastVisitAt)
      : null,
    loyaltyTier: (row.loyaltyTier as LoyaltyTier) || 'new',
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    occasionTags: Array.isArray(row.occasionTags) ? row.occasionTags : [],
  }
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

export class DrizzleCustomerStorageAdapter implements CustomerStorageAdapter {
  private database: typeof db

  constructor(database: typeof db = db) {
    this.database = database
  }

  async findCustomerByPhone(phone: string): Promise<Customer | null> {
    const normalized = normalizePhone(phone)
    if (!normalized) return null

    const [row] = await this.database
      .select()
      .from(customers)
      .where(eq(customers.phone, normalized))
      .limit(1)

    return row ? dbRowToCustomer(row) : null
  }

  async searchCustomers(query: string, limit = DEFAULT_CUSTOMER_SEARCH_LIMIT): Promise<Customer[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || DEFAULT_CUSTOMER_SEARCH_LIMIT)))
    const trimmed = (query ?? '').trim()
    const trimmedLower = trimmed.toLowerCase()
    const digitsOnly = normalizePhone(trimmed)

    if (!trimmed) {
      const rows = await this.database
        .select()
        .from(customers)
        .orderBy(
          sql`${customers.lastVisitAt} DESC NULLS LAST`,
          desc(customers.visitCount),
          desc(customers.totalSpend)
        )
        .limit(safeLimit)

      return rows
        .map(dbRowToCustomer)
        .sort((a, b) => {
          if (a.lastVisitAt && b.lastVisitAt) {
            const diff = new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime()
            if (diff !== 0) return diff
          } else if (a.lastVisitAt) {
            return -1
          } else if (b.lastVisitAt) {
            return 1
          }
          const tierDiff = TIER_WEIGHT[b.loyaltyTier] - TIER_WEIGHT[a.loyaltyTier]
          if (tierDiff !== 0) return tierDiff
          const visitDiff = b.visitCount - a.visitCount
          if (visitDiff !== 0) return visitDiff
          return b.totalSpend - a.totalSpend
        })
    }

    const escaped = escapeIlikePattern(trimmed)
    const whereClause =
      digitsOnly.length > 0
        ? or(
            ilike(customers.name, `%${escaped}%`),
            ilike(customers.phone, `%${digitsOnly}%`),
            ilike(customers.phone, `%${escaped}%`)
          )
        : or(
            ilike(customers.name, `%${escaped}%`),
            ilike(customers.phone, `%${escaped}%`)
          )

    const rows = await this.database
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.visitCount), desc(customers.totalSpend))
      .limit(safeLimit)

    return rows
      .map(dbRowToCustomer)
      .sort((a, b) => {
        const aNameStarts = a.name.toLowerCase().startsWith(trimmedLower)
        const bNameStarts = b.name.toLowerCase().startsWith(trimmedLower)
        if (aNameStarts && !bNameStarts) return -1
        if (!aNameStarts && bNameStarts) return 1

        const aPhoneStarts = digitsOnly.length > 0 && a.phone.startsWith(digitsOnly)
        const bPhoneStarts = digitsOnly.length > 0 && b.phone.startsWith(digitsOnly)
        if (aPhoneStarts && !bPhoneStarts) return -1
        if (!aPhoneStarts && bPhoneStarts) return 1

        const tierDiff = TIER_WEIGHT[b.loyaltyTier] - TIER_WEIGHT[a.loyaltyTier]
        if (tierDiff !== 0) return tierDiff

        return b.visitCount - a.visitCount
      })
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    if (!id || typeof id !== 'string') return null

    const dbId = toDbUuid(id)
    const [row] = await this.database
      .select()
      .from(customers)
      .where(eq(customers.id, dbId))
      .limit(1)

    return row ? dbRowToCustomer(row) : null
  }

  async createCustomer(data: Customer): Promise<Customer> {
    const normalizedPhone = normalizePhone(data.phone)
    const existing = await this.findCustomerByPhone(normalizedPhone)
    if (existing) {
      throw new CustomerAlreadyExistsError(`Customer with phone ${normalizedPhone} already exists.`)
    }

    const dbId = toDbUuid(data.id)
    const visitCount = data.visitCount ?? 0
    const totalSpend = data.totalSpend ?? 0
    const loyaltyTier = data.loyaltyTier || resolveLoyaltyTier(visitCount)
    const seatingPreferences = data.seatingPreferences ? [data.seatingPreferences] : []
    const occasionTags = Array.isArray(data.occasionTags) ? data.occasionTags : []

    try {
      const [inserted] = await this.database
        .insert(customers)
        .values({
          id: dbId,
          name: data.name,
          phone: normalizedPhone,
          email: null,
          visitCount,
          totalSpend: totalSpend.toFixed(2),
          loyaltyTier,
          dietaryFlags: Array.isArray(data.dietaryFlags) ? data.dietaryFlags : [],
          seatingPreferences,
          occasionTags,
          permanentNotes: data.permanentNotes || data.note || '',
          lastVisitAt: data.lastVisitAt ? new Date(data.lastVisitAt) : null,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        })
        .returning()

      if (!inserted) {
        throw new Error('Failed to insert customer record.')
      }

      return dbRowToCustomer(inserted)
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') {
        throw new CustomerAlreadyExistsError(`Customer with phone ${normalizedPhone} already exists.`)
      }
      throw err
    }
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const dbId = toDbUuid(id)

    if (data.phone !== undefined) {
      const normalizedPhone = normalizePhone(data.phone)
      const [conflict] = await this.database
        .select()
        .from(customers)
        .where(eq(customers.phone, normalizedPhone))
        .limit(1)
      if (conflict && conflict.id !== dbId) {
        throw new CustomerAlreadyExistsError(`Customer with phone ${normalizedPhone} already exists.`)
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    if (data.name !== undefined) updates.name = data.name.trim()
    if (data.phone !== undefined) updates.phone = normalizePhone(data.phone)
    if (data.dietaryFlags !== undefined) updates.dietaryFlags = Array.isArray(data.dietaryFlags) ? data.dietaryFlags : []
    if (data.seatingPreferences !== undefined) {
      updates.seatingPreferences = data.seatingPreferences ? [data.seatingPreferences] : []
    }
    if (data.occasionTags !== undefined) {
      updates.occasionTags = Array.isArray(data.occasionTags) ? data.occasionTags : []
    }
    if (data.permanentNotes !== undefined) updates.permanentNotes = data.permanentNotes
    else if (data.note !== undefined) updates.permanentNotes = data.note
    if (data.visitCount !== undefined) {
      const count = Number(data.visitCount) || 0
      updates.visitCount = count
      updates.loyaltyTier = resolveLoyaltyTier(count)
    }
    if (data.totalSpend !== undefined) {
      updates.totalSpend = (Number(data.totalSpend) || 0).toFixed(2)
    }
    if (data.lastVisitAt !== undefined) {
      updates.lastVisitAt = data.lastVisitAt ? new Date(data.lastVisitAt) : null
    }

    try {
      const [updated] = await this.database
        .update(customers)
        .set(updates)
        .where(eq(customers.id, dbId))
        .returning()

      if (!updated) {
        throw new CustomerNotFoundError(`Customer with ID ${id} not found.`)
      }

      return dbRowToCustomer(updated)
    } catch (err) {
      if (err instanceof CustomerAlreadyExistsError || err instanceof CustomerNotFoundError) {
        throw err
      }
      if ((err as { code?: string })?.code === '23505') {
        throw new CustomerAlreadyExistsError('Customer with this phone number already exists.')
      }
      throw err
    }
  }

  async recordVisitAndSpend(id: string, billAmount: number): Promise<Customer> {
    const dbId = toDbUuid(id)
    const bill = Math.max(0, Number(billAmount) || 0)
    const now = new Date()

    const [updated] = await this.database
      .update(customers)
      .set({
        visitCount: sql`${customers.visitCount} + 1`,
        totalSpend: sql`ROUND((${customers.totalSpend} + ${bill.toFixed(2)}::numeric), 2)`,
        loyaltyTier: sql`CASE
          WHEN ${customers.visitCount} + 1 >= 15 THEN 'vip'
          WHEN ${customers.visitCount} + 1 >= 10 THEN 'loyal'
          WHEN ${customers.visitCount} + 1 >= 5 THEN 'regular'
          ELSE 'new'
        END`,
        lastVisitAt: now,
        updatedAt: now,
      })
      .where(eq(customers.id, dbId))
      .returning()

    if (!updated) {
      throw new CustomerNotFoundError(`Customer with ID ${id} not found.`)
    }

    return dbRowToCustomer(updated)
  }
}

export class CustomerService {
  private adapter: CustomerStorageAdapter

  constructor(adapter: CustomerStorageAdapter = new InMemoryCustomerStorageAdapter()) {
    this.adapter = adapter
  }

  getAdapter(): CustomerStorageAdapter {
    return this.adapter
  }

  normalizePhone(phone: string): string {
    return normalizePhone(phone)
  }

  resolveLoyaltyTier(visitCount: number): LoyaltyTier {
    return resolveLoyaltyTier(visitCount)
  }

  async findCustomerByPhone(phone: string): Promise<Customer | null> {
    const normalized = normalizePhone(phone)
    if (!normalized) return null
    return this.adapter.findCustomerByPhone(normalized)
  }

  async searchCustomers(query: string = ''): Promise<Customer[]> {
    return this.adapter.searchCustomers(query)
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    if (!id || typeof id !== 'string') return null
    return this.adapter.getCustomerById(id.trim())
  }

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    if (!input || typeof input !== 'object') {
      throw new CustomerValidationError('Invalid customer data.')
    }

    const name = (input.name || '').trim()
    if (!name) {
      throw new CustomerValidationError('Customer name is required.')
    }

    const normalizedPhone = normalizePhone(input.phone || '')
    if (!normalizedPhone || normalizedPhone.length < 3) {
      throw new CustomerValidationError('A valid phone number is required.')
    }

    const existing = await this.adapter.findCustomerByPhone(normalizedPhone)
    if (existing) {
      throw new CustomerAlreadyExistsError(`Customer with phone ${normalizedPhone} already exists.`)
    }

    const dietaryFlags: string[] = Array.isArray(input.dietaryFlags)
      ? input.dietaryFlags.map((f) => String(f).trim()).filter(Boolean)
      : []

    const seatingPreferences = typeof input.seatingPreferences === 'string'
      ? input.seatingPreferences.trim()
      : ''

    const permanentNotes = typeof input.permanentNotes === 'string'
      ? input.permanentNotes.trim()
      : typeof input.note === 'string'
        ? input.note.trim()
        : ''

    const visitCount = Math.max(0, Number(input.visitCount) || 0)
    const totalSpend = Math.max(0, Number(input.totalSpend) || 0)
    const loyaltyTier = resolveLoyaltyTier(visitCount)

    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `cust-${crypto.randomUUID()}`
      : `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    const now = new Date().toISOString()

    const customer: Customer = {
      id,
      name,
      phone: normalizedPhone,
      dietaryFlags,
      seatingPreferences,
      permanentNotes,
      visitCount,
      totalSpend,
      lastVisitAt: visitCount > 0 ? now : null,
      loyaltyTier,
      createdAt: now,
      updatedAt: now,
      note: permanentNotes,
      visits: visitCount,
      occasionTags: Array.isArray(input.occasionTags) ? input.occasionTags : [],
    }

    return this.adapter.createCustomer(customer)
  }

  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
    if (!id || typeof id !== 'string') {
      throw new CustomerValidationError('Customer ID is required.')
    }

    const existing = await this.adapter.getCustomerById(id)
    if (!existing) {
      throw new CustomerNotFoundError(`Customer with ID ${id} not found.`)
    }

    const updates: Partial<Customer> = {}

    if (input.name !== undefined) {
      const name = String(input.name).trim()
      if (!name) throw new CustomerValidationError('Customer name cannot be empty.')
      updates.name = name
    }

    if (input.phone !== undefined) {
      const norm = normalizePhone(input.phone)
      if (!norm || norm.length < 3) throw new CustomerValidationError('Valid phone number required.')
      const conflict = await this.adapter.findCustomerByPhone(norm)
      if (conflict && conflict.id !== id) {
        throw new CustomerAlreadyExistsError(`Customer with phone ${norm} already exists.`)
      }
      updates.phone = norm
    }

    if (input.dietaryFlags !== undefined) {
      updates.dietaryFlags = Array.isArray(input.dietaryFlags)
        ? input.dietaryFlags.map((f) => String(f).trim()).filter(Boolean)
        : []
    }

    if (input.seatingPreferences !== undefined) {
      updates.seatingPreferences = String(input.seatingPreferences).trim()
    }

    if (input.permanentNotes !== undefined) {
      updates.permanentNotes = String(input.permanentNotes).trim()
      updates.note = updates.permanentNotes
    } else if (input.note !== undefined) {
      updates.permanentNotes = String(input.note).trim()
      updates.note = updates.permanentNotes
    }

    if (input.visitCount !== undefined) {
      const count = Math.max(0, Number(input.visitCount) || 0)
      updates.visitCount = count
      updates.visits = count
      updates.loyaltyTier = resolveLoyaltyTier(count)
    }

    if (input.totalSpend !== undefined) {
      updates.totalSpend = Math.max(0, Number(input.totalSpend) || 0)
    }

    if (input.lastVisitAt !== undefined) {
      updates.lastVisitAt = input.lastVisitAt
    }

    if (input.occasionTags !== undefined) {
      updates.occasionTags = Array.isArray(input.occasionTags) ? input.occasionTags : []
    }

    return this.adapter.updateCustomer(id, updates)
  }

  async recordVisitAndSpend(id: string, billAmount: number): Promise<Customer> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new CustomerValidationError('Customer ID is required.')
    }

    const amount = Number(billAmount)
    if (isNaN(amount) || amount < 0) {
      throw new CustomerValidationError('Bill amount must be a positive number.')
    }

    return this.adapter.recordVisitAndSpend(id.trim(), amount)
  }
}

export const customerService = new CustomerService(
  process.env.DATABASE_URL
    ? new DrizzleCustomerStorageAdapter()
    : new InMemoryCustomerStorageAdapter()
)
