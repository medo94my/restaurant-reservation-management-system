'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { EditableFloorPlan } from '@/components/editable-floor-plan'
import { GuestTagsManager } from '@/components/guest-tags-manager'
import { DEFAULT_OCCASION_TAGS, DEFAULT_FLOOR_ITEMS, DEFAULT_VISIT_TIERS } from '@/lib/restaurant-config'
import type { Booking, CustomerProfile, OccasionTag, RestaurantConfig, Unit, VisitTier } from '@/lib/restaurant-config'
import { logoViewSrc, type RestaurantBranding } from '@/lib/branding'
import { StaffAccountActions } from '@/components/auth/staff-auth'

type RestaurantConfigResponse = { config: (Omit<RestaurantConfig, 'customers'> & { customers?: CustomerProfile[] }) | null }
type ServiceData = {
  serviceDate: string
  reservations: Booking[]
  unitStates: Array<{ unitId: string; status: Unit['status']; guest?: string; pax?: number; time?: string; note: string; bill?: number }>
  customers: CustomerProfile[]
  monthlyVisitsByPhone: Record<string, number>
  metrics: { reservationCount: number; covers: number; revenue: number; averageSpend: number; servedCovers: number; occupiedUnits: number; activeUnits: number; blockedUnits: number; occupancyPercent: number }
}
type ServiceMutation = { method: 'POST' | 'PATCH'; body: Record<string, unknown> }

function getServiceDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function fetchRestaurantConfig(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load restaurant settings.')
  return response.json() as Promise<RestaurantConfigResponse>
}

async function putRestaurantConfig(url: string, { arg }: { arg: RestaurantConfig }) {
  const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arg) })
  if (!response.ok) throw new Error('Unable to save restaurant settings.')
  return response.json() as Promise<{ ok: true }>
}

async function fetchServiceData(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load service data.')
  return response.json() as Promise<ServiceData>
}

async function mutateServiceData(url: string, { arg }: { arg: ServiceMutation }) {
  const response = await fetch(url, { method: arg.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arg.body) })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to save service data.')
  return result
}

const icon = (name: string, size = 19) => <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
const fmt = (time: string) => { const [h, m] = time.split(':').map(Number); return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }

type ManagerView = 'home' | 'overview' | 'layout' | 'reservations' | 'guests'

type StaffProfile = { name: string; staffId: string; role: string }

export default function HomePage({ managerAccess = false, branding = null, managerView = 'home', staff = null }: { managerAccess?: boolean; branding?: RestaurantBranding | null; managerView?: ManagerView; staff?: StaffProfile | null }) {
  const [units, setUnits] = useState<Unit[]>(DEFAULT_FLOOR_ITEMS)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [screen, setScreen] = useState<'login' | 'service'>('service'), [pinFromLogin, setPinFromLogin] = useState(false), [manager, setManager] = useState(managerAccess), [pinOpen, setPinOpen] = useState(false), [pin, setPin] = useState(''), [pinError, setPinError] = useState(false), [modal, setModal] = useState<'booking' | 'complete' | 'merge' | null>(null), [selected, setSelected] = useState<Unit | null>(null), [bookingUnit, setBookingUnit] = useState<string | null>(null), [bill, setBill] = useState(''), [now, setNow] = useState<Date | null>(null), [query, setQuery] = useState(''), [guestName, setGuestName] = useState(''), [party, setParty] = useState(2), [kind, setKind] = useState<Unit['kind']>('Table'), [tableType, setTableType] = useState<Booking['tableType']>('any'), [bookTime, setBookTime] = useState('20:00'), [note, setNote] = useState(''), [bookingStep, setBookingStep] = useState(0), [walkInBooking, setWalkInBooking] = useState(false), [showAllArrivals, setShowAllArrivals] = useState(false), [wizardHint, setWizardHint] = useState(''), [consoleNotice, setConsoleNotice] = useState(''), [stats, setStats] = useState(false), [mergeSet, setMergeSet] = useState<string[]>([]), [combined, setCombined] = useState(true)
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [monthlyVisitsByPhone, setMonthlyVisitsByPhone] = useState<Record<string, number>>({})
  const [serviceMetrics, setServiceMetrics] = useState<ServiceData['metrics']>({ reservationCount: 0, covers: 0, revenue: 0, averageSpend: 0, servedCovers: 0, occupiedUnits: 0, activeUnits: 0, blockedUnits: 0, occupancyPercent: 0 })
  const [serviceError, setServiceError] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)
  const [selectedServiceDate, setSelectedServiceDate] = useState<string | null>(null)
  const [visitTiers, setVisitTiers] = useState<VisitTier[]>(DEFAULT_VISIT_TIERS)
  const [occasionTags, setOccasionTags] = useState<OccasionTag[]>(DEFAULT_OCCASION_TAGS)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [configDirty, setConfigDirty] = useState(false)
  const [configSaveStatus, setConfigSaveStatus] = useState<'idle' | 'saved' | 'saving' | 'error'>('idle')
  const [pinBusy, setPinBusy] = useState(false)
  const [bookingTags, setBookingTags] = useState<string[]>([])
  const [floorView, setFloorView] = useState<'canvas' | 'grid'>('canvas')
  const appliedConfig = useRef(false)
  const configRevision = useRef(0)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const { data: configData, isLoading: configLoading, mutate: refreshConfig } = useSWR('/api/restaurant-config', fetchRestaurantConfig)
  const serviceDate = selectedServiceDate ?? getServiceDate(now ?? new Date())
  const { data: serviceData, isLoading: serviceLoading, mutate: refreshServiceData } = useSWR(`/api/service-data?date=${serviceDate}`, fetchServiceData)
  const { trigger: saveConfig } = useSWRMutation('/api/restaurant-config', putRestaurantConfig)
  const { trigger: sendServiceMutation } = useSWRMutation('/api/service-data', mutateServiceData)

  useEffect(() => { const updateClock = () => setNow(new Date()); updateClock(); const timer = window.setInterval(updateClock, 30_000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { const saved = window.localStorage.getItem('murex.floor-view'); if (saved === 'canvas' || saved === 'grid') setFloorView(saved) }, [])
  useEffect(() => { window.localStorage.setItem('murex.floor-view', floorView) }, [floorView])
  useEffect(() => {
    if (!serviceData) return
    setBookings(serviceData.reservations)
    setCustomers(serviceData.customers)
    setMonthlyVisitsByPhone(serviceData.monthlyVisitsByPhone)
    setServiceMetrics(serviceData.metrics)
    const states = new Map(serviceData.unitStates.map((state) => [state.unitId, state]))
    setUnits((current) => current.map((unit) => {
      const state = states.get(unit.id)
      return state ? { ...unit, status: state.status, guest: state.guest, pax: state.pax, time: state.time, note: state.note, bill: state.bill } as Unit : unit
    }))
  }, [serviceData])

  useEffect(() => {
    if (configLoading || appliedConfig.current) return
    appliedConfig.current = true
    if (configData?.config) {
      setUnits(configData.config.floorItems)
      if (configData.config.customers) setCustomers(configData.config.customers)
      setVisitTiers(configData.config.visitTiers)
      setOccasionTags(configData.config.occasionTags)
    }
    setConfigLoaded(true)
  }, [configData, configLoading])
  useEffect(() => {
    if (!configLoaded || !configDirty) return
    const revision = configRevision.current
    const payload: RestaurantConfig = { floorItems: units, customers, visitTiers, occasionTags }
    const timer = window.setTimeout(() => {
      setConfigSaveStatus('saving')
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveConfig(payload, { populateCache: false, revalidate: false }))
      saveQueue.current.then(() => {
        if (revision === configRevision.current) {
          setConfigDirty(false)
          setConfigSaveStatus('saved')
        }
      }).catch(() => setConfigSaveStatus('error'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [configDirty, configLoaded, customers, occasionTags, saveConfig, units, visitTiers])
  const markConfigDirty = () => { configRevision.current += 1; setConfigDirty(true) }
  const updateCustomers = (next: CustomerProfile[]) => { setCustomers(next); markConfigDirty() }
  // Destructive profile deletes must not ride the debounced save: closing the
  // tab inside the 650ms window used to silently lose them. The delete is
  // applied optimistically and PUT to the server right away; on failure the
  // debounced path retries from the already-updated state.
  const deleteCustomerDurable = async (phone: string) => {
    const next = customers.filter((customer) => customer.phone !== phone)
    setCustomers(next)
    try {
      setConfigSaveStatus('saving')
      await saveQueue.current.catch(() => undefined)
      saveQueue.current = saveQueue.current.then(() => saveConfig({ floorItems: units, customers: next, visitTiers, occasionTags }, { populateCache: false, revalidate: false }))
      await saveQueue.current
      setConfigSaveStatus('saved')
    } catch {
      setConfigSaveStatus('error')
      markConfigDirty()
    }
  }
  const updateFloorPlan = (next: Unit[]) => { setUnits(next); markConfigDirty() }
  const match = customers.find(customer => customer.phone === query.replace(/\D/g, ''))
  const currentTime = now ?? new Date(0)
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const minutesUntil = (time: string) => ((Number(time.split(':')[0]) * 60 + Number(time.split(':')[1]) - currentMinutes) + 1440) % 1440
  const walkInSlot = () => { if (!now) return null; const total = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30 % 1440; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }
  const timeSlots = (() => { const list = Array.from({ length: 33 }, (_, i) => { const total = (10 * 60 + i * 30) % 1440; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }); if (walkInBooking) { const slot = walkInSlot(); if (slot && !list.includes(slot)) list.push(slot) } return list })()
  const dueBookings = bookings.map(b => ({ ...b, mins: minutesUntil(b.time) })).filter(b => b.mins >= 15 && b.mins <= 30 && !b.arrived)
  const shownUnits = useMemo(() => units.filter(u => !u.archived), [units])
  const sections = [...new Set(shownUnits.map((unit) => unit.kind))]
  const unlock = async (_value: string) => { setPinError(true); setPin(''); window.setTimeout(() => setPinError(false), 900) }
  const logoutManager = async () => { if (configDirty && configLoaded) { const payload: RestaurantConfig = { floorItems: units, customers, visitTiers, occasionTags }; try { saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveConfig(payload, { populateCache: false, revalidate: false })); await saveQueue.current; setConfigDirty(false); setConfigSaveStatus('saved') } catch { setConfigSaveStatus('error'); return false } } await Promise.resolve(); await refreshConfig().catch(() => undefined); const refreshedService = await refreshServiceData().catch(() => undefined); setCustomers(refreshedService?.customers ?? []); setManager(false); setSelectedServiceDate(null); setPin(''); return true }
  const cssHex = (v: unknown): string | null => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : null
  const tablesRef = useRef<HTMLDivElement>(null)
  const dialogRef = useCallback((node: HTMLDivElement | null) => { node?.focus() }, [])
  const closePin = () => { setPinOpen(false); setPin(''); setPinError(false); if (pinFromLogin) setScreen('login'); setPinFromLogin(false) }
  useEffect(() => {
    if (!pinOpen && !modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pinOpen) closePin()
      else setModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pinOpen, modal, closePin])
  const updateUnit = async (id: string, patch: Partial<Unit>) => {
    if (patch.status === 'blocked' || patch.status === 'available') {
      try {
        setServiceError('')
        await sendServiceMutation({ method: 'PATCH', body: { action: 'unit-status', unitId: id, status: patch.status } })
        // Server confirmed — apply the status locally; the background
        // revalidate reconciles the rest. Awaiting the full GET here used to
        // add 1.4–4s to every save.
        setUnits((prev) => prev.map((unit) => unit.id === id ? { ...unit, status: patch.status } as Unit : unit))
        void refreshServiceData()
      } catch (caught) {
        setServiceError(caught instanceof Error ? caught.message : 'Unable to update the floor unit.')
        void refreshServiceData()
      }
      return
    }
    setUnits((prev) => prev.map((unit) => unit.id === id ? { ...unit, ...patch } as Unit : unit))
    if (manager) markConfigDirty()
  }
  const saveBooking = async () => {
    const phone = query.replace(/\D/g, '')
    if (!guestName.trim() || phone.length < 7) return
    const chosenUnit = bookingUnit ? shownUnits.find((unit) => unit.id === bookingUnit && unit.status === 'available') : undefined
    if (bookingUnit && (!chosenUnit || party > chosenUnit.capacity)) return
    const unit = chosenUnit?.id || shownUnits.find((item) => item.kind === kind && item.status === 'available' && party <= item.capacity && (tableType === 'any' || item.kind !== 'Table' || item.tableType === tableType))?.id || `${kind} · assign`

    setServiceError('')
    setBookingBusy(true)
    try {
      const result = await sendServiceMutation({
        method: 'POST',
        body: {
          name: guestName.trim(),
          phone,
          pax: party,
          kind: chosenUnit?.kind ?? kind,
          tableType: chosenUnit?.kind === 'Table' ? tableType : 'any',
          time: bookTime,
          note: note || match?.note || '',
          unit,
          tags: bookingTags,
          serviceDate,
          clientRequestId: crypto.randomUUID(),
        },
      }) as { reservation?: Booking } | null
      // Server confirmed the save — reflect it locally right away and let the
      // background revalidate reconcile (an awaited full GET used to add
      // 1.4–4s). Prep-claim mirrors the route: only live-date bookings claim
      // an available unit.
      const created = result?.reservation
      if (created) {
        setBookings((prev) => [...prev, created].sort((a, z) => a.time.localeCompare(z.time)))
        if (!/·\s*assign$/i.test(created.unit) && serviceDate === getServiceDate(now ?? new Date())) {
          setUnits((prev) => prev.map((unit) => unit.id === created.unit && unit.status === 'available' ? {
            ...unit,
            status: 'prep',
            guest: created.name,
            pax: created.pax,
            time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(`2000-01-01T${bookTime}:00Z`)),
          } as Unit : unit))
        }
      }
      void refreshServiceData()
      setModal(null)
      setQuery('')
      setGuestName('')
      setNote('')
      setBookingTags([])
    } catch (caught) {
      setServiceError(caught instanceof Error ? caught.message : 'Unable to save this reservation.')
    } finally {
      setBookingBusy(false)
    }
  }
  const completeUnit = async () => {
    if (!selected) return
    setServiceError('')
    try {
      await sendServiceMutation({
        method: 'PATCH',
        body: { action: 'complete', unitId: selected.id, billAmount: Number(bill) || 0, eventKey: crypto.randomUUID() },
      })
      // Server confirmed — clear the table locally right away; the background
      // revalidate reconciles bookings and metrics.
      const closedUnit = selected.id
      setUnits((prev) => prev.map((unit) => unit.id === closedUnit ? {
        ...unit, status: 'available', guest: undefined, pax: undefined, time: undefined, note: '', bill: undefined,
      } as Unit : unit))
      setBookings((prev) => prev.map((booking) => booking.unit === closedUnit && booking.status === 'seated' ? { ...booking, status: 'completed' } : booking))
      void refreshServiceData()
      setModal(null)
      setSelected(null)
      setBill('')
    } catch (caught) {
      setServiceError(caught instanceof Error ? caught.message : 'Unable to complete this service.')
    }
  }
  const setReservationArrival = async (reservationId: number, arrived: boolean) => {
    try {
      setServiceError('')
      const updated = (await sendServiceMutation({ method: 'PATCH', body: { action: arrived ? 'arrive' : 'unarrive', reservationId, eventKey: crypto.randomUUID() } }) as { reservation?: Booking } | null)?.reservation
      // Server confirmed — merge the returned reservation locally; background
      // revalidate reconciles the rest.
      if (updated) setBookings((prev) => prev.map((booking) => booking.id === updated.id ? updated : booking))
      void refreshServiceData()
    } catch (caught) {
      setServiceError(caught instanceof Error ? caught.message : 'Unable to update arrival status.')
    }
  }

  const seatReservation = async (reservationId: number) => {
    try {
      setServiceError('')
      const updated = (await sendServiceMutation({ method: 'PATCH', body: { action: 'seat', reservationId, eventKey: crypto.randomUUID() } }) as { reservation?: Booking } | null)?.reservation
      // Server confirmed — merge the reservation and flip the table to seated
      // locally; background revalidate reconciles the rest.
      if (updated) {
        setBookings((prev) => prev.map((booking) => booking.id === updated.id ? updated : booking))
        setUnits((prev) => prev.map((unit) => unit.id === updated.unit ? {
          ...unit, status: 'seated', guest: updated.name, pax: updated.pax, time: updated.time, note: updated.note,
        } as Unit : unit))
      }
      void refreshServiceData()
    } catch (caught) {
      setServiceError(caught instanceof Error ? caught.message : 'Unable to seat this reservation.')
    }
  }

  const seatNextArrival = async () => {
    const waiting = bookings
      .map((booking) => ({ booking, unit: shownUnits.find((unit) => unit.id === booking.unit) }))
      .filter((entry) => entry.unit?.status === 'prep' || entry.unit?.status === 'available')
      .sort((a, z) => a.booking.time.localeCompare(z.booking.time))
    if (waiting.length === 0) {
      setConsoleNotice('No tables are waiting to be seated — everyone on the books is already in.')
      return
    }
    const target = waiting.find((entry) => entry.booking.arrived) ?? waiting[0]
    setConsoleNotice('')
    try {
      if (!target.booking.arrived) {
        const arrived = (await sendServiceMutation({ method: 'PATCH', body: { action: 'arrive', reservationId: target.booking.id, eventKey: crypto.randomUUID() } }) as { reservation?: Booking } | null)?.reservation
        if (arrived) setBookings((prev) => prev.map((booking) => booking.id === arrived.id ? arrived : booking))
      }
      await seatReservation(target.booking.id)
    } catch (caught) {
      setServiceError(caught instanceof Error ? caught.message : 'Unable to seat the next arrival.')
      // The arrive step may have already applied locally — restore truth.
      void refreshServiceData()
    }
  }
  const openBookingWizard = (options: { walkIn?: boolean; unitId?: string | null } = {}) => {
    const unit = options.unitId ? shownUnits.find((item) => item.id === options.unitId) : undefined
    setWalkInBooking(!!options.walkIn)
    setBookingUnit(unit?.id ?? null)
    setKind(unit?.kind ?? 'Table')
    setTableType(unit && unit.kind === 'Table' ? unit.tableType : 'any')
    setQuery(''); setGuestName(''); setParty(2); setNote(''); setBookingTags([]); setServiceError(''); setConsoleNotice('')
    const slot = options.walkIn ? walkInSlot() : null
    if (slot) setBookTime(slot)
    setWizardHint('')
    setBookingStep(unit ? 1 : 0)
    setModal('booking')
  }
  const addUnit = (kindToAdd: Unit['kind']) => { const number = Math.max(0, ...units.filter(u => u.kind === kindToAdd).map(u => Number(u.id.match(/\d+/)?.[0] || 0))) + 1; const id = `${kindToAdd} ${number}`; const position = kindToAdd === 'Room' ? { x: 815, y: 470 } : kindToAdd === 'Couch' ? { x: 810, y: 390 } : { x: 500, y: 300 }; const base = { id, capacity: kindToAdd === 'Room' ? 4 : 2, status: 'available' as const, ...position, rotation: 0 }; const item: Unit = kindToAdd === 'Table' ? { ...base, kind: 'Table', tableType: 'round' } : kindToAdd === 'Couch' ? { ...base, kind: 'Couch', couchType: 'loveseat' } : { ...base, kind: 'Room', roomWidth: 190, roomHeight: 140, tableType: 'round' }; updateFloorPlan([...units, item]) }
  const revenue = serviceMetrics.revenue
  const covers = serviceMetrics.covers

  return <><main className="app-shell" style={branding ? ({ background: branding.palette.background, color: branding.palette.text, fontFamily: branding.font === 'serif' ? 'Georgia, serif' : branding.font === 'system' ? 'system-ui, sans-serif' : 'var(--font-dm-sans), sans-serif', '--restaurant-primary': branding.palette.primary, '--restaurant-background': branding.palette.background } as CSSProperties) : undefined}>
    {branding && <style>{`:root{--restaurant-primary:${cssHex(branding.palette.primary) ?? '#d7b46a'};--restaurant-background:${cssHex(branding.palette.background) ?? '#231d0f'}}`}</style>}
    <style jsx global>{`
      :root{color-scheme:dark;--md-sys-color-background:#111312;--md-sys-color-on-background:#eee9df;--md-sys-color-surface:#171a18;--md-sys-color-on-surface:#eee9df;--md-sys-color-surface-container-low:#191c1a;--md-sys-color-surface-container:#202421;--md-sys-color-surface-container-high:#282d29;--md-sys-color-surface-container-highest:#323832;--md-sys-color-primary:var(--restaurant-primary,#d7b46a);--md-sys-color-on-primary:#241b08;--md-sys-color-outline:#696f68;--md-sys-color-outline-variant:#343a35;--md-sys-color-error:var(--terracotta-salmon);}
      body{background:#111312;color:#eee9df;font-family:var(--font-dm-sans),sans-serif}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}.app-shell{min-height:100vh;background:radial-gradient(ellipse at 55% -30%,#293129 0,transparent 58%),#111312;padding:0 30px 36px;color:#eee9df}.topbar{height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #303630;gap:20px}.brand{display:flex;align-items:center;gap:13px}.brand-mark{width:39px;height:39px;border:1px solid var(--restaurant-primary,#957d49);border-radius:12px;color:var(--restaurant-primary,#d7b46a);display:grid;place-items:center;background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 8%,transparent)}.brand-mark img{width:100%;height:100%;object-fit:contain;box-sizing:border-box;padding:5px;display:block}.brand-name{font:600 1.25rem var(--font-playfair),Georgia,serif;letter-spacing:.02em}.brand-sub{color:#92978e;font-size:0.625rem;letter-spacing:.18em;text-transform:uppercase;margin-top:3px}.top-center{display:flex;align-items:center;gap:11px;color:#b7bcb4;font-size:0.8125rem}.live-dot{height:7px;width:7px;border-radius:50%;background:var(--service-green);box-shadow:0 0 12px var(--service-green)88}.top-actions{display:flex;gap:10px;align-items:center}.button{min-height:46px;padding:0 16px;border-radius:11px;border:1px solid #41473f;background:#202421;color:#e8e5dc;display:inline-flex;align-items:center;justify-content:center;gap:9px;font-weight:600;font-size:0.8125rem;transition:.15s;text-decoration:none}.button:hover{background:#2a302b;border-color:#77765e}.button.primary{background:var(--restaurant-primary,#d7b46a);color:var(--restaurant-background,#231d0f);border-color:var(--restaurant-primary,#d7b46a)}.button.primary:hover{filter:brightness(1.08)}.button.ghost{background:transparent;border-color:transparent;color:#aeb3ab}.button.small{min-height:38px;padding:0 12px;font-size:0.75rem}.button.danger{color:#ed9c91;border-color:#673b35}.icon-btn{width:46px;padding:0}.alert{margin:18px 0 14px;border:1px solid #7a6031;background:linear-gradient(105deg,#392d19,#27251d);border-radius:13px;padding:13px 17px;display:flex;align-items:center;justify-content:space-between;gap:14px;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 65%,white)}.alert-main{display:flex;align-items:center;gap:12px;font-size:0.8125rem}.alert-title{font-weight:700;color:#f1d28b}.alert-note{color:#c9bd9e;font-size:0.75rem}.alert-count{font-size:0.6875rem;color:#edd28d;border:1px solid #8d713f;border-radius:8px;padding:5px 9px;white-space:nowrap}.page-head{display:flex;justify-content:space-between;align-items:flex-end;margin:25px 0 22px;gap:18px}.eyebrow{color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black);text-transform:uppercase;letter-spacing:.16em;font-size:0.625rem;font-weight:700}.title{font:500 1.875rem var(--font-playfair),Georgia,serif;letter-spacing:-.025em;margin:7px 0 4px}.subtitle{font-size:0.8125rem;color:#969d94}.head-right{display:flex;align-items:center;gap:10px}.stat-ico{color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 95%,black)}.stat-label{color:#92998f;font-size:0.625rem}.stat-value{font-variant-numeric:tabular-nums;font-weight:700;font-size:0.875rem;margin-top:2px}.section{margin:0 0 22px}.section-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 11px}.section-title{display:flex;align-items:center;gap:9px;font:500 1.25rem var(--font-playfair),Georgia,serif}.section-icon{color:var(--restaurant-primary,#d5b56e)}.section-meta{color:#8e958b;font:500 0.6875rem var(--font-dm-sans),sans-serif;padding-left:8px}.section-right{display:flex;align-items:center;gap:10px}.unit-count{font-size:0.6875rem;color:#8f968d}.unit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.unit-card{min-height:118px;background:linear-gradient(145deg,#1d221e,#191d1a);border:1px solid #343b35;border-radius:13px;padding:13px 14px;position:relative;overflow:hidden;transition:.18s}.unit-card:hover{border-color:#66715f;transform:translateY(-1px)}.unit-card.seated{border-color:#494b75;background:linear-gradient(145deg,#22233a,#1c1d2b)}.unit-card.prep{border-color:#8a6c38;background:linear-gradient(145deg,#332b1c,#211f19)}.unit-card.blocked{background:#1a1d1b;border-color:#393e3a;opacity:.67}.card-top{display:flex;justify-content:space-between;align-items:center}.unit-id{font-weight:700;font-size:0.875rem;letter-spacing:.01em}.capacity{font-size:0.625rem;color:#b7beb4;border:1px solid #424940;padding:4px 7px;border-radius:6px}.status{display:flex;align-items:center;gap:6px;font-size:0.625rem;font-weight:700;letter-spacing:.035em;text-transform:uppercase;margin-top:12px;color:var(--service-green)}.status.seated{color:var(--service-violet)}.status.prep{color:var(--service-amber)}.status.blocked{color:var(--service-neutral)}.status-dot{width:6px;height:6px;border-radius:50%;background:currentColor}.guest-line{font-size:0.75rem;color:#e3e3dc;margin-top:7px;display:flex;justify-content:space-between;gap:8px}.guest-detail{font-size:0.625rem;color:#a2a99f;margin-top:3px}.prep-badge{position:absolute;right:10px;bottom:10px;background:var(--service-amber);color:#261e0e;padding:5px 7px;border-radius:6px;font-weight:700;font-size:0.625rem}.manager-tools{display:flex;gap:7px;position:absolute;right:10px;bottom:9px}.tiny-action{height:31px;width:33px;border-radius:8px;border:1px solid #4a5149;background:#282e29;color:var(--restaurant-primary,#d7b46a);display:grid;place-items:center}.unit-card.prep .manager-tools,.unit-card.seated .manager-tools{bottom:10px}.legend{display:flex;gap:17px;align-items:center;color:#939a90;font-size:0.6875rem}.legend-item{display:flex;gap:6px;align-items:center}.legend-dot{height:7px;width:7px;border-radius:50%}.lower-row{display:flex;gap:14px;align-items:stretch;margin-top:27px}.panel{background:#191d1a;border:1px solid #343a35;border-radius:14px;padding:16px;min-width:0}.reservation-panel{flex:1.45}.stats-panel{flex:1}.panel-title{font:500 1.25rem var(--font-playfair),Georgia,serif;margin:0 0 13px}.reservation-row{display:grid;grid-template-columns:75px minmax(105px,1.25fr) 48px minmax(95px,1fr) 70px;gap:10px;align-items:center;padding:11px 0;border-top:1px solid #303630;font-size:0.75rem}.res-time{font-variant-numeric:tabular-nums;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 84%,white);font-weight:700}.res-name{font-weight:600}.res-phone,.res-note{color:#9aa197;font-size:0.6875rem}.res-unit{color:#c6cbbf}.booking-tag{display:inline-flex;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 84%,white);background:#8e71301f;border:1px solid #7c6535;padding:4px 7px;border-radius:5px;font-size:0.625rem;font-weight:700;white-space:nowrap}.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.stat-box{border:1px solid #363d36;background:#202521;border-radius:10px;padding:12px}.stat-box-label{font-size:0.625rem;color:#989e94}.stat-box-value{font-size:1.25rem;font-weight:700;margin-top:6px}.stat-box-sub{font-size:0.625rem;color:#d0b475;margin-top:3px}.area-bars{display:grid;gap:9px;margin-top:14px}.area-row{display:grid;grid-template-columns:67px 1fr 26px;align-items:center;gap:9px;font-size:0.625rem;color:#a0a69d}.bar{height:5px;background:#353c36;border-radius:5px;overflow:hidden}.bar-fill{height:100%;background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 87%,black);border-radius:5px}.editor-label{font-size:0.625rem;color:var(--restaurant-primary,#d5b46c);text-transform:uppercase;letter-spacing:.12em;margin:10px 0 6px}.edit-field{height:37px;border-radius:8px;padding:0 9px;color:#f1ede4;background:#151916;border:1px solid #414840;min-width:0;width:100%;font-size:0.75rem}.field-label{font-size:0.625rem;color:#a4aa9e;display:block;margin-bottom:5px}.modal-backdrop{position:fixed;inset:0;background:#080a09c9;z-index:var(--z-backdrop);display:grid;place-items:center;padding:18px;backdrop-filter:blur(5px)}.modal{width:min(570px,100%);background:#1d221e;border:1px solid #4b5148;border-radius:17px;padding:23px;box-shadow:0 24px 90px #0009;max-height:93vh;overflow:auto}.modal.narrow{width:min(400px,100%)}.modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:19px}.modal-title{font:500 1.4375rem var(--font-playfair),Georgia,serif}.modal-sub{font-size:0.75rem;color:#9ca297;margin-top:5px}.close{width:38px;height:38px;border-radius:9px;border:1px solid #41483f;background:#272d28;color:#d1d4cc;display:grid;place-items:center}.field{margin-bottom:14px}.input{width:100%;height:48px;border-radius:10px;border:1px solid #454d45;background:#141916;color:#eee9df;padding:0 13px;outline:none}.input:focus{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black);box-shadow:0 0 0 2px var(--focus-ring)}.guest-match{padding:12px;border-radius:10px;background:#243328;border:1px solid #49664f;margin:9px 0 15px}.match-top{display:flex;justify-content:space-between;align-items:center}.regular{font-size:0.625rem;color:#a8d0ad;border:1px solid #547357;padding:5px 8px;border-radius:20px}.match-note{font-size:0.6875rem;color:#b4c2b0;margin-top:7px}.chip-row{display:flex;gap:8px;flex-wrap:wrap}.chip{height:44px;min-width:51px;padding:0 14px;border-radius:9px;border:1px solid #464d45;background:#242a25;color:#c7ccc3;font-weight:700}.chip.active{background:var(--restaurant-primary,#d7b46a);border-color:var(--restaurant-primary,#d7b46a);color:#241e11}.kind-choice{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.kind-option{height:62px;border-radius:10px;border:1px solid #454c45;background:#222723;color:#d1d4cc;display:grid;place-items:center;gap:3px;font-size:0.6875rem}.kind-option.active{border-color:var(--restaurant-primary,#d6b66f);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 77%,white);background:#393222}.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}.pin-dots{display:flex;justify-content:center;gap:13px;margin:20px 0 23px}.pin-dot{height:12px;width:12px;border:1px solid #797f75;border-radius:50%}.pin-dot.filled{background:var(--restaurant-primary,#d7b46a);border-color:var(--restaurant-primary,#d7b46a)}.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.pin-key{height:57px;border-radius:10px;background:#282e29;border:1px solid #41483f;color:#f1ede4;font-size:1.1875rem;font-weight:600}.pin-key:active{background:#3c433b}.shake{animation:shake .3s}@keyframes shake{25%{transform:translateX(-7px)}50%{transform:translateX(7px)}75%{transform:translateX(-5px)}}.run-sheet{display:none}.check-row{display:flex;align-items:center;gap:8px;font-size:0.75rem;color:#bdc3b9}.empty{font-size:0.75rem;color:#91988f;padding:14px 0}.manager-help{font-size:0.625rem;color:#8e968b;margin:4px 0 9px}.section-grid-edit{display:flex;flex-direction:column;gap:10px}.edit-unit-row{display:grid;grid-template-columns:minmax(95px,1.2fr) 76px 102px 38px;gap:7px;align-items:center}.merge-panel{border-top:1px solid #394039;margin-top:13px;padding-top:12px}.merge-choice{height:40px;padding:0 10px;border-radius:8px;border:1px solid #454c45;background:#222723;color:#bdc4b9;font-size:0.6875rem}.merge-choice.active{border-color:var(--restaurant-primary,#d7b46a);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 77%,white);background:#332e21}.overflow-x{overflow-x:auto}
      @media(max-width:980px){.app-shell{padding:0 20px 28px}.unit-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.top-center{display:none}.lower-row{flex-direction:column}.reservation-panel,.stats-panel{flex:auto}}
      @media(max-width:650px){.app-shell{padding:0 13px 24px}.topbar{height:68px}.brand-name{font-size:1.0625rem}.brand-sub{font-size:0.625rem}.top-actions .button:not(.primary):not(.icon-btn){display:none}.page-head{align-items:flex-start;flex-direction:column}.head-right{width:100%;justify-content:space-between}.stat-label{font-size:0.625rem}.unit-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.unit-card{padding:12px;min-height:117px}.legend{gap:9px;flex-wrap:wrap}.reservation-row{grid-template-columns:58px minmax(88px,1fr) 38px 68px;gap:6px}.res-phone{display:none}.res-note{display:none}.panel{padding:13px}.alert{align-items:flex-start}.alert-note{display:none}.section-title{font-size:1rem}.manager-tools{gap:4px}}
      @media print{body{background:white!important;color:#111!important}.app-shell{display:none!important}.manager-shell{display:block!important}.manager-sidebar{display:none!important}.run-sheet{display:block!important;padding:24px;color:#111;font:12px Arial,sans-serif}.run-sheet h1{font:700 24px Georgia;margin:0 0 6px}.run-sheet p{margin:0 0 17px;color:#444}.run-sheet table{width:100%;border-collapse:collapse}.run-sheet th,.run-sheet td{border:1px solid #777;padding:9px 7px;text-align:left;vertical-align:top}.run-sheet th{background:#eee!important}.checkbox{font-size:17px}}
    `}</style>
    <style jsx global>{`.manager-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-bottom:19px}
        .manager-card{display:flex;flex-direction:column;gap:9px;padding:20px;border:1px solid #343a34;border-radius:14px;background:#171a18;color:#eee9df;text-decoration:none;transition:.16s}
        .manager-card:hover,.manager-card:focus-visible{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 92%,black);background:#1b211d;transform:translateY(-2px);outline:none}
        .manager-card-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:11px;background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 7.8%,transparent);border:1px solid color-mix(in srgb,color-mix(in srgb,var(--restaurant-primary,#d7b46a) 66%,black) 40%,transparent);color:var(--restaurant-primary,#d7b46a)}
        .manager-card strong{font-size:1rem}
        .manager-card p{margin:0;color:#9ba198;font-size:0.8125rem;line-height:1.55;flex:1}
        .manager-card-meta{display:flex;align-items:center;gap:7px;color:var(--restaurant-primary,#d4b66d);font-size:0.75rem;font-weight:700}
        .eyebrow-link{display:inline-flex;align-items:center;gap:5px;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 97%,black);text-decoration:none;letter-spacing:.16em}
        .eyebrow-link:hover{text-decoration:underline}
        .manager-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:11px;margin-bottom:17px}.manager-kpi{min-height:116px;padding:16px;border:1px solid #363d36;background:linear-gradient(145deg,#202521,#191d1a);border-radius:13px}.manager-kpi .stat-ico{display:inline-flex;margin-bottom:13px}.manager-kpi .stat-label{font-size:0.6875rem}.manager-kpi .stat-value{font-variant-numeric:tabular-nums;font-size:1.5rem;margin-top:7px}.manager-area{margin-bottom:9px}.manager-health{display:flex;align-items:center;gap:8px;border-top:1px solid #363d36;padding-top:13px;margin-top:8px;color:#9da49a;font-size:0.6875rem}.manager-health strong{color:var(--restaurant-primary,#d5b56e)}.manager-layout-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;margin-bottom:17px;border:1px solid #41463a;border-radius:12px;background:#20241f}.manager-layout-tools strong{font:500 1rem var(--font-playfair),Georgia,serif;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 63%,white)}.login-stage{min-height:calc(100vh - 36px);display:flex;flex-direction:column;max-width:1320px;margin:0 auto}.login-top{height:82px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #303630}.login-live{display:flex;align-items:center;gap:9px;color:#9da59b;font-size:0.625rem;font-weight:700;letter-spacing:.13em}.login-content{flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,470px);align-items:center;gap:8vw;padding:56px 8vw}.login-heading{font:500 clamp(2.625rem,6vw,4.5rem)/1.08 var(--font-playfair),Georgia,serif;letter-spacing:-.04em;margin:20px 0;color:#eee9df}.login-heading em{font-weight:500;color:var(--restaurant-primary,#d7b46a)}.login-copy{color:#a3aaa1;font-size:1rem;line-height:1.7;max-width:430px}.login-note{margin-top:32px;color:#c9b882;font-size:0.75rem;display:flex;align-items:center;gap:9px}.role-panel{border:1px solid #3b423b;background:linear-gradient(150deg,#202521,#181c19);border-radius:19px;padding:27px;box-shadow:0 25px 70px #0003}.role-panel-heading h2{font:500 1.5rem var(--font-playfair),Georgia,serif;margin:9px 0 5px}.role-panel-heading p{font-size:0.75rem;color:#9da49a;margin:0 0 21px}.role-card{width:100%;display:flex;align-items:center;gap:13px;text-align:left;padding:15px 14px;min-height:81px;border:1px solid #414941;background:#202622;border-radius:13px;color:#eee9df;margin-top:10px;transition:.15s}.role-card:hover,.role-card:focus-visible{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 66%,black);background:#282c25;outline:none;transform:translateY(-1px)}.manager-role{background:#25241f;border-color:#504833}.role-icon{width:45px;height:45px;display:grid;place-items:center;border-radius:12px}.host-icon{color:#a7d0b1;background:#2a4030}.manager-icon{color:#e0c47b;background:#423821}.role-text{display:flex;flex-direction:column;gap:5px;flex:1}.role-text strong{font-size:0.875rem}.role-text small{font-size:0.6875rem;color:#a3aaa1}.role-arrow{color:var(--restaurant-primary,#d7b46a)}.role-foot{font-size:0.625rem;color:#91998f;margin:16px 2px 1px}.login-footer{display:flex;justify-content:space-between;gap:14px;border-top:1px solid #303630;padding:18px 2px;color:#858d83;font-size:0.625rem;letter-spacing:.08em}.login-footer span:first-child{color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 92%,black);font-weight:700}@media(min-width:801px) and (max-width:1100px){.login-content{grid-template-columns:minmax(0,1fr) minmax(360px,430px);gap:42px;padding:44px 32px}.login-heading{font-size:clamp(2.75rem,5vw,3.5rem)}}@media(max-width:800px){.login-content{grid-template-columns:1fr;gap:29px;padding:42px 8vw}.login-heading{font-size:3rem}.role-panel{max-width:560px;width:100%;margin:0 auto}.login-story{text-align:center}.login-copy{margin-inline:auto}.login-note{justify-content:center}.login-footer{font-size:0.625rem;flex-wrap:wrap}.login-live{font-size:0.625rem}}@media(max-width:500px){.login-top{height:70px}.login-live{display:none}.login-content{padding:36px 4px;gap:25px}.login-heading{font-size:2.625rem}.role-panel{padding:19px}.role-text small{font-size:0.625rem}.login-footer span:last-child{display:none}}@media(max-width:980px){.manager-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:600px){.manager-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.manager-kpi{min-height:98px;padding:12px}.manager-kpi .stat-value{font-variant-numeric:tabular-nums;font-size:1.25rem}.manager-layout-tools{align-items:flex-start;flex-direction:column}}
        /* Hostess door console */
        .console-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:11px 0 20px}
        .console-chip{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:1px solid #6f5626;border-radius:999px;background:#292413;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 82%,white);font:700 0.6875rem inherit;cursor:pointer;white-space:nowrap}
        .console-chip:hover{border-color:var(--restaurant-primary,#d7b46a)}
        .console-chip .material-symbols-outlined{font-size:15px}
        .console-error,.console-notice{margin:0 0 12px;font-size:0.6875rem;line-height:1.5}
        .console-error{color:var(--terracotta-salmon)}.console-notice{color:var(--service-green)}
        .console-main{display:grid;grid-template-columns:minmax(0,58fr) minmax(0,42fr);gap:14px;align-items:start}
        .console-floor-panel{min-width:0}
        .console-floor-panel .floor-plan{margin-bottom:0}
        .console-side{display:grid;gap:14px;min-width:0;scroll-margin-top:70px}
        .console-arrivals-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:2px}
        .console-arrivals-empty{margin:8px 0 2px;color:#9daa9a;font-size:0.75rem;line-height:1.55}
        .console-arrival-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:3px 10px;align-items:center;padding:10px 2px;border-bottom:1px solid #2b322b}
        .console-arrival-row:last-child{border-bottom:0}
        .console-arrival-guest{display:grid;gap:2px;min-width:0}
        .console-arrival-guest strong{font-size:0.8125rem;color:#f4f1e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .console-arrival-guest span{color:#9daa9a;font-size:0.6875rem;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .console-arrival-actions{display:flex;align-items:center;gap:7px;justify-self:end}
        .arrive-toggle{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;border:1px solid #4a554b;border-radius:8px;background:transparent;color:#b9c0b4;font:600 0.6875rem inherit;cursor:pointer;white-space:nowrap}
        .arrive-toggle .material-symbols-outlined{font-size:15px}
        .arrive-toggle.on{border-color:color-mix(in srgb,var(--service-green) 50%,transparent);color:var(--service-green);background:color-mix(in srgb,var(--service-green) 9%,transparent)}
        .arrive-toggle:focus-visible,.console-chip:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white);outline-offset:2px}
        .card-tools{display:flex;gap:6px;margin-top:9px}
        .unit-card-main{display:block;width:100%;background:none;border:0;padding:0;color:inherit;text-align:left}
        .card-tools .tiny-action{height:30px;width:30px}
        .card-tools .tiny-action .material-symbols-outlined{font-size:15px}
        /* Booking wizard */
        .booking-wizard{width:min(780px,100%)}
        .wizard-steps{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}
        .wizard-step{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid #3b453b;border-radius:999px;color:#8b948a;font-size:0.625rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
        .wizard-step .material-symbols-outlined{font-size:13px}
        .wizard-step.current{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 45%,transparent);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 55%,white)}
        .wizard-step.done{color:var(--service-green)}
        .wizard-map-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;flex-wrap:wrap}
        .wizard-hint{color:#9daa9a;font-size:0.6875rem;line-height:1.5}
        .wizard-map .floor-plan{margin-bottom:0}
        .wizard-form{display:grid;gap:13px}
        .wizard-form .field{margin-bottom:0}
        .wizard-summary{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:10px 12px;border:1px solid #3b453b;border-radius:10px;background:#202622;color:#9daa9a;font-size:0.6875rem}
        .wizard-summary .material-symbols-outlined{font-size:16px;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 55%,white)}
        .wizard-summary strong{color:#f4f1e8;font-size:0.8125rem}
        .wizard-summary-unit{margin-left:auto;color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 60%,white);font-weight:700}
        .wizard-cap-hint{color:#8b948a;font-weight:400}
        .wizard-error{margin:0;color:var(--terracotta-salmon);font-size:0.6875rem}
        /* Canvas / grid display toggle */
        .floor-view-toggle{display:flex;width:fit-content;gap:4px;padding:4px;border:1px solid #3b453b;border-radius:10px;background:#1d221e;margin:0 0 10px auto}
        .floor-view-option{display:inline-flex;align-items:center;justify-content:center;min-height:30px;width:34px;border:1px solid transparent;border-radius:7px;background:none;color:#9daa9a;font:inherit;cursor:pointer}
        .floor-view-option .material-symbols-outlined{font-size:15px}
        .floor-view-option.on{border-color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 45%,transparent);color:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 55%,white);background:color-mix(in srgb,var(--restaurant-primary,#d7b46a) 8%,transparent)}
        .floor-view-option:focus-visible{outline:2px solid color-mix(in srgb,var(--restaurant-primary,#d7b46a) 76%,white);outline-offset:2px}
        .console-main.grid-only{grid-template-columns:1fr}
        @media(max-width:1100px){.console-main{grid-template-columns:1fr}}
    `}</style>
    {serviceError&&<div className="alert" role="alert"><div className="alert-main">{icon('error_outline')}<span>{serviceError}</span></div><button className="button small" onClick={()=>setServiceError('')}>Dismiss</button></div>}
    {screen==='login'?<section className="login-stage"><header className="login-top"><div className="brand"><div className="brand-mark">{icon('restaurant',22)}</div><div><div className="brand-name">{branding?.restaurantName ?? 'Saffron & Cedar'}</div><div className="brand-sub">{branding?.tagline ?? 'Beirut · Dining Room'}</div></div></div><span className="login-live"><span className="live-dot"/>SERVICE SYSTEM READY</span></header><div className="login-content"><div className="login-story"><div className="eyebrow">A thoughtful evening starts here</div><h1 className="login-heading">Welcome to<br/><em>{branding?.restaurantName ?? 'Saffron & Cedar'}.</em></h1><p className="login-copy">Choose your workspace to begin service. Your access is tailored to your role.</p><div className="login-note">{icon('verified_user',18)} Protected manager controls · Live floor status · Guest-first service</div></div><section className="role-panel"><div className="role-panel-heading"><span className="eyebrow">Select your workspace</span><h2>How are you joining us?</h2><p>Choose a role to continue to tonight&apos;s service.</p></div><button className="role-card" onClick={()=>{setManager(false);setScreen('service')}}><span className="role-icon host-icon">{icon('support_agent',25)}</span><span className="role-text"><strong>Host / Hostess</strong><small>Reservations, arrivals &amp; floor service</small></span><span className="role-arrow">{icon('arrow_forward',19)}</span></button><button className="role-card manager-role" onClick={()=>{setManager(false);setPinFromLogin(true);setPinOpen(true);setPin('');setPinError(false)}}><span className="role-icon manager-icon">{icon('admin_panel_settings',25)}</span><span className="role-text"><strong>Manager / Supervisor</strong><small>Operations, floor setup &amp; performance</small></span><span className="role-arrow">{icon('lock',18)}</span></button><div className="role-foot">Manager access is assigned to staff accounts.</div></section></div><footer className="login-footer"><span>{(branding?.restaurantName ?? 'Saffron & Cedar').toUpperCase()} · BEIRUT</span><span>Fine dining · Warm hospitality</span><span>{now ? now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) : '—'} · {now ? now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '--:-- --'}</span></footer>{pinOpen&&<div className="modal-backdrop" onClick={closePin}><div className={`modal narrow ${pinError?'shake':''}`} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Manager access" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="modal-title">Manager access</div><div className="modal-sub">Enter your 6-digit PIN to continue to the supervisor workspace.</div></div><button className="close" onClick={closePin} aria-label="Close">{icon('close')}</button></div><div className="pin-dots" aria-label={`${pin.length} of 6 digits entered`}>{Array.from({length:6},(_,i)=><span className={`pin-dot ${i<pin.length?'filled':''}`} key={i}/>)}</div>{pinError&&<div style={{textAlign:'center',color:'var(--terracotta-salmon)',fontSize:12,marginBottom:10}}>Incorrect PIN. Please try again.</div>}<div className="pin-pad">{['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key=><button className="pin-key" key={key} disabled={pinBusy} onClick={()=>key==='clear'?setPin(''):key==='back'?setPin(pin.slice(0,-1)):unlock(key)}>{key==='clear'?'Clear':key==='back'?icon('backspace'):key}</button>)}</div><div style={{textAlign:'center',fontSize:10,color:'#777f75',marginTop:14}}>Manager access is secured for this workspace.</div></div></div>}</section>:<>
    <header className="topbar">{!manager&&<div className="brand"><div className="brand-mark">{branding?.logo?.pathname ? <img src={logoViewSrc(branding.logo) ?? undefined} alt="Restaurant logo" /> : icon('restaurant', 22)}</div><div><div className="brand-name">{branding?.restaurantName ?? 'Saffron & Cedar'}</div><div className="brand-sub">{branding?.tagline ?? 'Beirut · Dining Room'}</div></div></div>}<div className="top-center"><span className="live-dot"/>Service live <span style={{color:'#555d55'}}>·</span><span>{now ? now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '—'}</span><span style={{color:'var(--restaurant-primary,#d7b46a)',fontWeight:700}}>{now ? now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '--:-- --'}</span></div><div className="top-actions">{!manager&&staff&&<StaffAccountActions profile={staff}/>}{managerView==='reservations'&&<button className="button" onClick={()=>window.print()}>{icon('print')}<span>Print today&apos;s run sheet</span></button>}</div></header>
    {manager&&dueBookings.length>0&&<div className="alert"><div className="alert-main">{icon('notifications_active',21)}<div><span className="alert-title">Table preparation due</span><span className="alert-note"> — {dueBookings.map(b=>`${b.unit} for ${b.name} in ${b.mins} min`).join(' · ')}. Wipe down, lay mezze cutlery, and set the table.</span></div></div><span className="alert-count">{dueBookings.length} UPCOMING</span></div>}

    
    {manager&&<><section className="page-head"><div><div className="eyebrow">{managerView==='home'?'Management console · Today’s service':<Link className="eyebrow-link" href="/manager">{icon('arrow_back',15)} Manager home</Link>}</div><h1 className="title">{managerView==='home'?'Manager workspace':managerView==='overview'?'Service overview':managerView==='layout'?'Floor plan setup':managerView==='guests'?'Guest profiles':'Reservation oversight'}</h1><div className="subtitle">Performance, floor setup, and guest relationships in one place.</div></div><div className="head-right">{managerView==='reservations'&&<label className="field-label">Service date <input className="edit-field" type="date" value={selectedServiceDate ?? serviceDate} onChange={(event)=>setSelectedServiceDate(event.target.value)}/></label>}<div className="live-dot"/>Live service · {shownUnits.length} units</div></section>{managerView==='home'?<section className="manager-cards">{[{href:'/manager/overview',icon:'monitoring',title:'Overview',copy:'Reservations, covers, revenue, and floor utilization for today’s service.',meta:`${serviceMetrics.reservationCount} reservations`},{href:'/manager/floor-setup',icon:'table_chart',title:'Floor setup',copy:'Arrange tables, couches, and enclosed private rooms on the floor canvas.',meta:`${shownUnits.length} units`},{href:'/manager/reservations',icon:'calendar_month',title:'Reservations',copy:'The service run sheet — arrivals, party sizes, and seating.',meta:`${bookings.length} booked`},{href:'/manager/guests',icon:'groups',title:'Guest book',copy:'Guest profiles, lifetime visits, and occasion tags for personal service.',meta:`${customers.length} guests`},{href:'/manager/settings',icon:'settings',title:'Settings',copy:'Restaurant branding, visit tiers, and occasion tags.',meta:`${occasionTags.length} tags`}].map(card=><Link className="manager-card" href={card.href} key={card.href}><span className="manager-card-icon">{icon(card.icon,22)}</span><strong>{card.title}</strong><p>{card.copy}</p><span className="manager-card-meta">{card.meta}{icon('arrow_forward',15)}</span></Link>)}</section>:managerView==='overview'?<><section className="manager-kpis">{[["Today's reservations",String(serviceMetrics.reservationCount),'event_seat'],['Covers',String(covers),'groups'],['Daily revenue',`$${revenue.toLocaleString()}`,'payments'],['Average spend',`${serviceMetrics.averageSpend.toLocaleString()}`,'trending_up'],['Floor occupancy',`${shownUnits.length?Math.round(shownUnits.filter(u=>u.status==='seated'||u.status==='prep').length/shownUnits.length*100):0}%`,'donut_large'],['Blocked units',String(shownUnits.filter(u=>u.status==='blocked').length),'block']].map(([label,value,symbol])=><div className="manager-kpi" key={label}><span className="stat-ico">{icon(symbol,20)}</span><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>)}</section><div className="lower-row"><section className="panel stats-panel"><div className="panel-title">Dining floor utilization</div><div className="area-bars"><div className="manager-area"><div className="area-row"><span>Tables</span><div className="bar"><div className="bar-fill" style={{width:`${shownUnits.length?shownUnits.filter(u=>u.status==='seated'||u.status==='prep').length/shownUnits.length*100:0}%`}}/></div><span>{shownUnits.filter(u=>u.status==='seated'||u.status==='prep').length}/{shownUnits.length}</span></div><div className="manager-help">{shownUnits.filter(u=>u.status==='available').length} available · {shownUnits.filter(u=>u.status==='blocked').length} out of service</div></div></div><div className="manager-health"><span>Service readiness</span><strong>{shownUnits.filter(u=>u.status==='available').length} available</strong><span>·</span><strong>{dueBookings.length} prep alerts</strong></div></section><section className="panel reservation-panel"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 className="panel-title">Upcoming reservations</h2><Link className="button small" href="/manager/reservations">All reservations {icon('arrow_forward',15)}</Link></div>{bookings.length===0?<p className="manager-help" style={{margin:'16px 0 4px'}}>No reservations for this service date yet — bookings from the host stand appear here as soon as they are made.</p>:bookings.slice().sort((a,b)=>a.time.localeCompare(b.time)).slice(0,5).map(b=><div className="reservation-row" key={b.id}><span className="res-time">{fmt(b.time)}</span><span className="res-name">{b.name}</span><span>{b.pax} pax</span><span className="res-unit">{b.kind} · {b.unit}</span><span className="booking-tag">{b.arrived?'ARRIVED':'BOOKED'}</span></div>)}</section></div></>:managerView==='layout'?<><div className="manager-layout-tools"><div><strong>Dining room layout</strong><div className="manager-help">Arrange tables, couches, and enclosed private rooms on the floor canvas.</div></div></div><EditableFloorPlan items={shownUnits} editable onChange={updateFloorPlan} />{sections.map((s,si)=>{const area=shownUnits.filter(u=>u.kind===s);return <section className="section" key={s}><div className="section-head"><div className="section-title">{icon('table_restaurant',20)}Dining tables<span className="section-meta">{area.length} units</span></div><button className="button small" onClick={()=>addUnit(s as Unit['kind'])}>{icon('add',16)}Add {s.toLowerCase()}</button></div><div className="section-grid-edit">{area.map(unit=><div className="edit-unit-row" key={unit.id}><input className="edit-field" aria-label={`${unit.id} name`} value={unit.id} onChange={e=>updateFloorPlan(units.map(u=>u.id===unit.id?{...u,id:e.target.value}:u))}/><label style={{display:'flex',alignItems:'center',gap:5}}><input className="edit-field" aria-label={`${unit.id} capacity`} type="number" min="1" max="30" value={unit.capacity} onChange={e=>updateUnit(unit.id,{capacity:Number(e.target.value)})}/><span style={{fontSize:10,color:'#a0a69d'}}>pax</span></label><select className="edit-field" aria-label={`${unit.id} service state`} value={unit.status==='blocked'?'blocked':'active'} onChange={e=>updateUnit(unit.id,{status:e.target.value==='blocked'?'blocked':'available',guest:e.target.value==='blocked'?unit.guest:undefined})}><option value="active">In service</option><option value="blocked">Blocked / OOS</option></select><button className="tiny-action" aria-label={`Archive ${unit.id}`} onClick={()=>updateUnit(unit.id,{archived:true})}>{icon('archive',16)}</button></div>)}</div></section>})}</>:managerView==='guests'?<GuestTagsManager customers={customers} monthlyVisitsByPhone={monthlyVisitsByPhone} visitTiers={visitTiers} occasionTags={occasionTags} onCustomersChange={updateCustomers} onDeleteCustomer={deleteCustomerDurable} saveStatus={configSaveStatus}/>:<section className="panel"><div className="overflow-x"><div style={{minWidth:720}}><div className="reservation-row" style={{fontWeight:700,color:'#aab0a6',borderTop:0}}><span>TIME</span><span>GUEST / PHONE</span><span>PAX</span><span>SEATING / UNIT</span><span>ARRIVAL</span></div>{bookings.slice().sort((a,b)=>a.time.localeCompare(b.time)).map(b=><div className="reservation-row" key={b.id}><span className="res-time">{fmt(b.time)}</span><span><span className="res-name">{b.name}</span><div className="res-note">{b.phone} · {b.note||'No special notes'}</div></span><span>{b.pax}</span><span>{b.kind} · {b.unit}</span><label className="check-row"><input type="checkbox" checked={!!b.arrived} onChange={()=>void setReservationArrival(b.id,!b.arrived)}/> Arrived</label></div>)}</div></div></section>}</>}
    {!manager&&<>
      <section className="console-strip" aria-label="Quick actions">
        <button className="button primary" onClick={()=>void seatNextArrival()}>{icon('event_seat',18)}Seat next arrival</button>
        <button className="button" onClick={()=>openBookingWizard({walkIn:true})}>{icon('person_add',18)}Walk-in</button>
        <button className="button" onClick={()=>openBookingWizard()}>{icon('edit_calendar',18)}New booking</button>
        {dueBookings.length>0&&<button className="console-chip" onClick={()=>tablesRef.current?.scrollIntoView({behavior:'smooth',block:'start'})} title={dueBookings.map(b=>`${b.unit} for ${b.name} in ${b.mins} min`).join(' · ')}>{icon('notifications_active',15)}Prep due · {dueBookings.length}</button>}
      </section>
      {serviceError&&<p className="console-error" role="alert">{serviceError}</p>}
      {consoleNotice&&<p className="console-notice" role="status">{consoleNotice}</p>}
      <div className="floor-view-toggle" role="group" aria-label="Table display">
        <button type="button" className={`floor-view-option ${floorView==='canvas'?'on':''}`} aria-pressed={floorView==='canvas'} aria-label="Canvas view" title="Canvas view" onClick={()=>setFloorView('canvas')}>{icon('spatial_gallery',15)}</button>
        <button type="button" className={`floor-view-option ${floorView==='grid'?'on':''}`} aria-pressed={floorView==='grid'} aria-label="Grid view" title="Grid view" onClick={()=>setFloorView('grid')}>{icon('grid_view',15)}</button>
      </div>
      <div className={`console-main ${floorView==='grid'?'grid-only':''}`}>
        {floorView==='canvas'&&<section className="console-floor-panel" aria-label="Floor plan">
          <EditableFloorPlan items={shownUnits} onActivate={(item) => { setSelected(item); if (item.status === 'seated') setModal('complete'); else if (item.status === 'prep') { const reservation = bookings.find((booking) => booking.unit === item.id); if (reservation) void seatReservation(reservation.id) } else if (item.status === 'available') openBookingWizard({ unitId: item.id }) }} />
        </section>}
        <div className="console-side" ref={tablesRef}>
      {floorView==='grid'&&sections.map((section,si)=>{const area=shownUnits.filter(u=>u.kind===section);return <section className="section" key={section}><div className="section-head"><div className="section-title"><span className="section-icon">{icon('table_restaurant',21)}</span>Dining tables<span className="section-meta">{area.length} units</span></div><div className="section-right">{manager&&<button className="button small" onClick={()=>addUnit(section as Unit['kind'])}>{icon('add',16)}Add unit</button>}{si===2&&<button className="button small" onClick={()=>{setMergeSet([]);setModal('merge')}}>{icon('table_rows',16)}Combine tables</button>}<span className="unit-count">{area.filter(u=>u.status==='available').length} available</span></div></div>
        {manager?<div className="section-grid-edit">{area.map(unit=><div className="edit-unit-row" key={unit.id}><input className="edit-field" aria-label="Unit name" value={unit.id} onChange={e=>updateFloorPlan(units.map(u=>u.id===unit.id?{...u,id:e.target.value}:u))}/><label style={{display:'flex',alignItems:'center',gap:5}}><input className="edit-field" aria-label="Capacity" type="number" min="1" max="30" value={unit.capacity} onChange={e=>updateUnit(unit.id,{capacity:Number(e.target.value)})}/><span style={{fontSize:10,color:'#a0a69d'}}>pax</span></label><select className="edit-field" aria-label="Unit status" value={unit.status==='blocked'?'blocked':'active'} onChange={e=>updateUnit(unit.id,{status:e.target.value==='blocked'?'blocked':'available',guest:e.target.value==='blocked'?unit.guest:undefined})}><option value="active">In service</option><option value="blocked">Blocked / OOS</option></select><button className="tiny-action" aria-label="Archive unit" onClick={()=>updateUnit(unit.id,{archived:true})}>{icon('archive',16)}</button></div>)}</div>:<div className="unit-grid">{area.map(unit=>{const activateUnit=()=>{setSelected(unit);if(unit.status==='seated'){setModal('complete')}else if(unit.status==='prep'){const reservation=bookings.find(booking=>booking.unit===unit.id);if(reservation)void seatReservation(reservation.id)}else if(unit.status==='available')openBookingWizard({unitId:unit.id})};return <div key={unit.id} className={`unit-card ${unit.status}`} style={{textAlign:'left',color:'inherit'}}><button type="button" className="unit-card-main" onClick={activateUnit}><div className="card-top"><span className="unit-id">{unit.id}{combined&&unit.id==='Table 3'?' + 4':''}</span><span className="capacity">{unit.capacity} seats</span></div><div className={`status ${unit.status}`}><span className="status-dot"/>{unit.status==='blocked'?'Out of service':unit.status==='seated'?'Seated':unit.status==='prep'?'Prep needed':'Available'}</div>{unit.guest&&<><div className="guest-line"><span>{unit.guest}</span><span>{unit.pax} pax</span></div><div className="guest-detail">{bookings.find(b=>b.unit===unit.id)?.time ? fmt(bookings.find(b=>b.unit===unit.id)!.time) : unit.time}{unit.note?` · ${unit.note}`:''}</div></>}{unit.status==='prep'&&<span className="prep-badge">Prep Table · Due in {bookings.find(b=>b.unit===unit.id)?minutesUntil(bookings.find(b=>b.unit===unit.id)!.time):20} min</span>}</button><div className="card-tools" onClick={e=>e.stopPropagation()}>{unit.status==='available'&&<button className="tiny-action" aria-label={`Block ${unit.id}`} title="Block table" onClick={()=>void updateUnit(unit.id,{status:'blocked'})}>{icon('block',15)}</button>}{unit.status==='blocked'&&<button className="tiny-action" aria-label={`Return ${unit.id} to service`} title="Return to service" onClick={()=>void updateUnit(unit.id,{status:'available'})}>{icon('check_circle',15)}</button>}{unit.status==='seated'&&<button className="tiny-action" aria-label={`Close out ${unit.id}`} title="Close out seating" onClick={()=>{setSelected(unit);setModal('complete')}}>{icon('receipt',15)}</button>}{unit.status==='prep'&&<button className="tiny-action" aria-label={`Seat ${unit.id}`} title="Seat the reservation" onClick={()=>{const reservation=bookings.find(b=>b.unit===unit.id);if(reservation)void seatReservation(reservation.id)}}>{icon('event_seat',15)}</button>}</div></div>})}</div>}
      </section>})}

      <section className="panel console-arrivals">
        <div className="console-arrivals-head"><h2 className="panel-title">{showAllArrivals?'Today’s reservations':'Next arrivals'}</h2><button className="button ghost small" onClick={()=>setShowAllArrivals(v=>!v)}>{showAllArrivals?<>Show next {icon('unfold_less',15)}</>:<>View all {icon('arrow_forward',15)}</>}</button></div>
        {bookings.length===0&&<p className="console-arrivals-empty">No reservations yet tonight — walk-ins are always welcome.</p>}
        {bookings.slice().sort((a,b)=>a.time.localeCompare(b.time)).slice(0,showAllArrivals?undefined:4).map(b=>{
          const unitState=shownUnits.find(u=>u.id===b.unit)
          return <div className="console-arrival-row" key={b.id}>
            <span className="res-time">{fmt(b.time)}</span>
            <span className="console-arrival-guest"><strong>{b.name}</strong><span>{b.pax} pax · {b.unit}{showAllArrivals?` · ${b.phone}${b.note?` · ${b.note}`:''}`:''}</span></span>
            <span className="console-arrival-actions">
              <span className="booking-tag">{unitState?.status==='seated'?'SEATED':b.arrived?'ARRIVED':'BOOKED'}</span>
              <button type="button" className={`arrive-toggle ${b.arrived?'on':''}`} aria-pressed={!!b.arrived} onClick={()=>void setReservationArrival(b.id,!b.arrived)}>{icon(b.arrived?'check_circle':'radio_button_unchecked',16)}{b.arrived?'Arrived':'Arrive'}</button>
              {(unitState?.status==='prep'||unitState?.status==='available')&&<button type="button" className="button small" onClick={()=>void seatReservation(b.id)}>Seat</button>}
            </span>
          </div>
        })}
      </section>
      </div>
      </div>
      </>}
    {pinOpen&&<div className="modal-backdrop" onClick={closePin}><div className={`modal narrow ${pinError?'shake':''}`} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Manager access" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="modal-title">Manager access</div><div className="modal-sub">Sign in with a manager staff account to edit the floor plan.</div></div><button className="close" onClick={closePin} aria-label="Close">{icon('close')}</button></div><div className="pin-dots" aria-label={`${pin.length} of 6 digits entered`}>{Array.from({length:6},(_,i)=><span className={`pin-dot ${i<pin.length?'filled':''}`} key={i}/>)}</div>{pinError&&<div style={{textAlign:'center',color:'var(--terracotta-salmon)',fontSize:12,marginBottom:10}}>Incorrect PIN. Please try again.</div>}<div className="pin-pad">{['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key=><button className="pin-key" key={key} disabled={pinBusy} onClick={()=>key==='clear'?setPin(''):key==='back'?setPin(pin.slice(0,-1)):unlock(key)}>{key==='clear'?'Clear':key==='back'?icon('backspace'):key}</button>)}</div><div style={{textAlign:'center',fontSize:10,color:'#777f75',marginTop:14}}>Manager access is secured for this workspace.</div></div></div>}
    {modal==='booking'&&<div className="modal-backdrop" onClick={()=>setModal(null)}><div className="modal booking-wizard" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={walkInBooking?'Walk-in seating':'New reservation'} onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><div className="eyebrow">{walkInBooking?'Host stand · Walk-in':'Host stand · New reservation'}</div><div className="modal-title" style={{marginTop:5}}>{['Pick their table','Who’s joining us?','Reservation details'][bookingStep]}</div><div className="modal-sub">{['Tap an open table on the floor — or let the stand choose for you.','We’ll recognise returning guests by phone.','Party, arrival time, and anything worth remembering.'][bookingStep]}</div></div><button className="close" onClick={()=>setModal(null)} aria-label="Close">{icon('close')}</button></div>
      <div className="wizard-steps" aria-label="Booking progress">{['Table','Guest','Details'].map((label,i)=><span key={label} className={`wizard-step ${i===bookingStep?'current':''} ${i<bookingStep?'done':''}`}>{i<bookingStep?icon('check',13):i+1}{label}</span>)}</div>
      {bookingStep===0&&<div className="wizard-map">
        <EditableFloorPlan items={shownUnits} onActivate={(item)=>{ if(item.status==='available'){ setBookingUnit(item.id); setKind(item.kind); setTableType(item.kind==='Table'?item.tableType:'any'); setWizardHint(''); setBookingStep(1) } else { setWizardHint(`${item.id} is ${item.status==='seated'?'seated':item.status==='prep'?'holding a reservation':'out of service'} — pick an open table.`) } }} />
        <div className="wizard-map-foot"><span className="wizard-hint" role="status">{wizardHint||'Tap an open table to choose it for this reservation.'}</span><button className="button ghost small" onClick={()=>{setBookingUnit(null);setWizardHint('');setBookingStep(1)}}>No preference — pick for me</button></div>
      </div>}
      {bookingStep===1&&<div className="wizard-form">
        <div className="field"><label className="field-label" htmlFor="phone">Guest phone number</label><input id="phone" className="input" inputMode="tel" placeholder="+961 70 123 456" value={query} onChange={e=>{const value=e.target.value;setQuery(value);const guest=customers.find(customer=>customer.phone===value.replace(/\D/g,''));if(guest){setGuestName(guest.name);setBookingTags(guest.occasionTags)}else setBookingTags([])}}/>{match&&<div className="guest-match"><div className="match-top"><strong>{match.name}</strong><span className="regular" title={`${monthlyVisitsByPhone[match.phone] ?? 0} completed visits this month`}>{monthlyVisitsByPhone[match.phone] ?? 0} visits this month · {[...visitTiers].sort((a,b)=>b.minVisits-a.minVisits).find(tier=>(monthlyVisitsByPhone[match.phone] ?? 0)>=tier.minVisits)?.label??'New'} guest</span></div><div className="match-note">{match.note}</div></div>}</div>
        <div className="field"><label className="field-label" htmlFor="guest-name">Guest name</label><input id="guest-name" className="input" placeholder="Full name" value={guestName} onChange={e=>setGuestName(e.target.value)}/></div>
        <div className="modal-actions"><button className="button" onClick={()=>bookingUnit?setBookingStep(0):setModal(null)}>{bookingUnit?'Change table':'Cancel'}</button><button className="button primary" disabled={!guestName.trim()||query.replace(/\D/g,'').length<7} onClick={()=>setBookingStep(2)}>Next · reservation details {icon('arrow_forward',15)}</button></div>
      </div>}
      {bookingStep===2&&<div className="wizard-form">
        <div className="wizard-summary"><span>{icon(walkInBooking?'person_add':'event_available',16)}</span><strong>{guestName.trim()||'Guest'}</strong><span>{query.replace(/\D/g,'')}</span><span className="wizard-summary-unit">{bookingUnit?`${bookingUnit} · ${shownUnits.find(u=>u.id===bookingUnit)?.capacity??'?'} seats`:'Auto-assign best open table'}</span></div>
        <div className="field"><span className="field-label">Party size{bookingUnit&&<span className="wizard-cap-hint"> · up to {shownUnits.find(u=>u.id===bookingUnit)?.capacity} at {bookingUnit}</span>}</span><div className="chip-row">{[2,4,6,8,10].map(n=>{const cap=bookingUnit?shownUnits.find(u=>u.id===bookingUnit)?.capacity??99:99;const over=n>cap;return <button className={`chip ${party===n?'active':''}`} key={n} disabled={over} title={over?`${bookingUnit} seats ${cap}`:undefined} onClick={()=>setParty(n)}>{n===10?'10+':n}</button>})}</div></div>
        {!bookingUnit&&<div className="field"><label className="field-label" htmlFor="table-style">Preferred table shape</label><select id="table-style" className="input" value={tableType} onChange={e=>setTableType(e.target.value as Booking['tableType'])}><option value="any">Any available table</option><option value="round">Round</option><option value="square">Square</option><option value="rectangle">Rectangle</option><option value="oval">Oval</option><option value="long">Long table</option></select></div>}
        <div className="field" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}><div><label className="field-label" htmlFor="booking-time">Arrival time</label><select id="booking-time" className="input" value={bookTime} onChange={e=>setBookTime(e.target.value)}>{timeSlots.map(val=><option value={val} key={val}>{fmt(val)}</option>)}</select></div><div><label className="field-label" htmlFor="pref-note">Preference / occasion note</label><input id="pref-note" className="input" placeholder="Optional note" value={note} onChange={e=>setNote(e.target.value)}/></div></div>
        <div className="field"><span className="field-label">Occasion tags</span><div className="chip-row">{occasionTags.map(tag=><button type="button" key={tag.id} aria-pressed={bookingTags.includes(tag.id)} className={`chip ${bookingTags.includes(tag.id)?'active':''}`} onClick={()=>setBookingTags(prev=>prev.includes(tag.id)?prev.filter(id=>id!==tag.id):[...prev,tag.id])}>{tag.label}</button>)}</div></div>
        {serviceError&&<p className="wizard-error" role="alert">{serviceError}</p>}
        <div className="modal-actions"><button className="button" onClick={()=>setBookingStep(1)}>Back</button><button className="button primary" onClick={saveBooking} disabled={bookingBusy||!guestName.trim()||query.replace(/\D/g,'').length<7}>{icon('event_available')}{bookingBusy?'Saving…':'Save reservation'}</button></div>
      </div>}
    </div></div>}
    {modal==='complete'&&selected&&<div className="modal-backdrop" onClick={()=>setModal(null)}><div className="modal narrow" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Complete seating" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">Close out seating</div><div className="modal-title" style={{marginTop:5}}>{selected.id}</div><div className="modal-sub">{selected.guest} · {selected.pax} guests · {selected.time}</div></div><button className="close" onClick={()=>setModal(null)} aria-label="Close">{icon('close')}</button></div><label className="field-label" htmlFor="bill">Total bill amount <span style={{color:'#8d9489'}}>(optional)</span></label><div style={{position:'relative',marginTop:7}}><span style={{position:'absolute',left:14,top:14,color:'var(--restaurant-primary,#c5ad71)'}}>$</span><input id="bill" className="input" style={{paddingLeft:30}} inputMode="decimal" type="number" min="0" placeholder="0.00" value={bill} onChange={e=>setBill(e.target.value)}/></div><div className="modal-actions"><button className="button" onClick={()=>setModal(null)}>Keep seated</button><button className="button primary" onClick={completeUnit}>{icon('check')}Complete / clear</button></div></div></div>}
    {modal==='merge'&&<div className="modal-backdrop" onClick={()=>setModal(null)}><div className="modal narrow" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Combine tables" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="modal-title">Combine tables</div><div className="modal-sub">Choose adjacent dining tables to link for this service.</div></div><button className="close" onClick={()=>setModal(null)} aria-label="Close">{icon('close')}</button></div><div className="chip-row">{shownUnits.filter(u=>u.kind==='Table').map(u=><button key={u.id} className={`merge-choice ${mergeSet.includes(u.id)?'active':''}`} onClick={()=>setMergeSet(prev=>prev.includes(u.id)?prev.filter(x=>x!==u.id):[...prev,u.id])}>{u.id}</button>)}</div><div className="modal-actions"><button className="button" onClick={()=>setModal(null)}>Cancel</button><button className="button primary" disabled={mergeSet.length<2} onClick={()=>{setCombined(!combined);setModal(null)}}>{icon('link')}Link selected ({mergeSet.length})</button></div></div></div>}
    </>}
  </main>
  <section className="run-sheet"><h1>{branding?.restaurantName ?? 'Saffron & Cedar'} — Today&apos;s Run Sheet</h1><p>Beirut · {now ? now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '—'}</p><table><thead><tr><th>Time</th><th>Guest Name</th><th>Phone</th><th>Pax</th><th>Seating Type &amp; Unit #</th><th>Special Notes</th><th>Arrived</th></tr></thead><tbody>{bookings.slice().sort((a,b)=>a.time.localeCompare(b.time)).map(b=><tr key={b.id}><td>{fmt(b.time)}</td><td>{b.name}</td><td>{b.phone}</td><td>{b.pax}</td><td>{b.kind} · {b.unit}</td><td>{b.note||'—'}</td><td className="checkbox">□</td></tr>)}</tbody></table></section>
</>
}
