import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api'
import { addD, today } from '../lib/date'
import type { Booking, BookingInput, Bootstrap, Status } from '../domain/types'
import { useToast } from './toast'

// Bookings are loaded for a window around the selected day and refreshed in the background,
// so changes made by colleagues on other phones appear within REFRESH_MS.
const REFRESH_MS = 20_000
const BACK = 40
const AHEAD = 60

interface DataState {
  boot: Bootstrap | null
  bookings: Booking[]
  error: string
  online: boolean
  date: string
  setDate: (d: string) => void
  /** Makes sure bookings around `d` are loaded (used when browsing far months). */
  ensureLoaded: (d: string) => void
  refresh: () => Promise<void>
  save: (id: string | null, input: BookingInput) => Promise<Booking | null>
  setStatus: (id: string, status: Status) => Promise<Booking | null>
  remove: (id: string) => Promise<boolean>
  /** Saves only the given fields (e.g. tables) of a booking. */
  patch: (id: string, p: Partial<BookingInput>) => Promise<Booking | null>
  /** Replaces parts of the floor plan / settings after a successful save. */
  mergeBoot: (p: Partial<Bootstrap>) => void
  /** Runs a backend call; on failure shows the server's message and returns null. */
  attempt: <T>(p: Promise<T>) => Promise<T | null>
}

const DataCtx = createContext<DataState>(null as unknown as DataState)

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [error, setError] = useState('')
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [date, setDate] = useState(today())
  const range = useRef({ from: addD(today(), -BACK), to: addD(today(), AHEAD) })

  const refresh = useCallback(async () => {
    try {
      const [b, list] = await Promise.all([boot ? Promise.resolve(boot) : api.bootstrap(), api.listBookings(range.current.from, range.current.to)])
      if (!boot) setBoot(b)
      setBookings(list)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di caricamento')
    }
  }, [boot])

  // Move the loaded window when the user browses far from it.
  const ensureLoaded = useCallback((d: string) => {
    const r = range.current
    if (d < addD(r.from, 7) || d > addD(r.to, -7)) {
      range.current = { from: addD(d, -BACK), to: addD(d, AHEAD) }
      refresh()
    }
  }, [refresh])
  useEffect(() => ensureLoaded(date), [date, ensureLoaded])

  useEffect(() => {
    refresh()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, REFRESH_MS)
    const vis = () => { if (document.visibilityState === 'visible') refresh() }
    const on = () => { setOnline(true); refresh() }
    const off = () => setOnline(false)
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const upsert = (b: Booking) => setBookings((l) => (l.some((x) => x.id === b.id) ? l.map((x) => (x.id === b.id ? b : x)) : [...l, b]))
  const fail = (e: unknown) => {
    toast(e instanceof ApiError || e instanceof Error ? e.message : 'Operazione non riuscita')
    return null
  }

  const save = useCallback(async (id: string | null, input: BookingInput) => {
    try {
      const b = id ? await api.updateBooking(id, input) : await api.createBooking(input)
      upsert(b)
      return b
    } catch (e) { return fail(e) }
  }, [])

  const setStatus = useCallback(async (id: string, status: Status) => {
    // Optimistic: the change shows immediately and is rolled back if the server refuses it.
    let prev: Booking | undefined
    setBookings((l) => l.map((x) => (x.id === id ? ((prev = x), { ...x, status }) : x)))
    try {
      const b = await api.setStatus(id, status)
      upsert(b)
      return b
    } catch (e) {
      if (prev) upsert(prev)
      return fail(e)
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await api.deleteBooking(id)
      setBookings((l) => l.filter((x) => x.id !== id))
      return true
    } catch (e) { fail(e); return false }
  }, [])

  const patch = useCallback(async (id: string, p: Partial<BookingInput>) => {
    try {
      const b = await api.updateBooking(id, p)
      upsert(b)
      return b
    } catch (e) { return fail(e) }
  }, [])

  const mergeBoot = useCallback((p: Partial<Bootstrap>) => setBoot((b) => (b ? { ...b, ...p } : b)), [])
  const attempt = useCallback(async <T,>(p: Promise<T>) => {
    try { return await p } catch (e) { return fail(e) }
  }, [])

  const value = useMemo(
    () => ({ boot, bookings, error, online, date, setDate, ensureLoaded, refresh, save, setStatus, remove, patch, mergeBoot, attempt }),
    [boot, bookings, error, online, date, ensureLoaded, refresh, save, setStatus, remove, patch, mergeBoot, attempt],
  )
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export const useData = () => useContext(DataCtx)
