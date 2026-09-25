// Booking rules shared by the demo API and the UI.
// The WordPress plugin implements the same rules server-side; the server is the source of truth.
import { dow, m2t, t2m } from '../lib/date'
import type { Booking, Closure, DiscountRule, Service, Settings, Table } from './types'
import { isLive } from './types'

export interface Slot { t: string; svc: Service }

export const closureOf = (s: Settings, date: string): Closure | undefined => s.closures.find((c) => c.date === date)
export const serviceOf = (time: string): Service => (t2m(time) < 17 * 60 ? 'pranzo' : 'cena')

export function slotsOf(s: Settings, date: string): Slot[] {
  const c = closureOf(s, date)
  if (c && c.type === 'chiuso') return []
  const ranges =
    c && c.type === 'orario' && c.start && c.end
      ? [{ svc: serviceOf(c.start), start: c.start, end: c.end }]
      : (['pranzo', 'cena'] as Service[])
          .filter((k) => s.week[dow(date)][k].on)
          .map((k) => ({ svc: k, start: s.week[dow(date)][k].start, end: s.week[dow(date)][k].end }))
  const out: Slot[] = []
  for (const r of ranges) for (let m = t2m(r.start); m <= t2m(r.end) - 30; m += s.interval) out.push({ t: m2t(m), svc: r.svc })
  return out
}

const overlaps = (a: string, b: string, dur: number) => t2m(a) < t2m(b) + dur && t2m(a) + dur > t2m(b)

/** The live booking occupying `tableId` at `date` `time`, ignoring `excl`. */
export function busyOn(bookings: Booking[], dur: number, tableId: string, date: string, time: string, excl?: string | null) {
  return bookings.find((x) => x.id !== excl && x.date === date && isLive(x) && x.tables.includes(tableId) && overlaps(x.time, time, dur))
}

/** Smallest free table that fits, else the smallest pair in the same area, else a greedy group. */
export function suggestTables(tables: Table[], bookings: Booking[], dur: number, date: string, time: string, guests: number, excl?: string | null): string[] {
  const taken = new Set<string>()
  for (const x of bookings) if (x.date === date && x.id !== excl && isLive(x) && overlaps(x.time, time, dur)) x.tables.forEach((id) => taken.add(id))
  const free = tables.filter((t) => !taken.has(t.id))
  const single = free.filter((t) => t.seats >= guests).sort((a, b) => a.seats - b.seats)[0]
  if (single) return [single.id]
  let best: { s: number; ids: string[] } | null = null
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j]
      if (a.area !== b.area) continue
      const s = a.seats + b.seats
      if (s >= guests && (!best || s < best.s)) best = { s, ids: [a.id, b.id] }
    }
  if (best) return best.ids
  const byArea: Record<string, Table[]> = {}
  free.forEach((t) => (byArea[t.area] = byArea[t.area] || []).push(t))
  for (const k in byArea) {
    const ids: string[] = []
    let s = 0
    for (const t of byArea[k].sort((a, b) => b.seats - a.seats)) {
      ids.push(t.id)
      s += t.seats
      if (s >= guests) return ids
    }
  }
  return []
}

export function discountFor(s: Settings, bookings: Booking[], date: string, time: string, guests: number, excl?: string | null): DiscountRule | null {
  const rule = s.discounts.find((x) => guests >= x.min && guests <= x.max)
  if (!rule) return null
  const used = bookings.filter((b) => b.id !== excl && b.date === date && b.time === time && isLive(b) && b.discount === rule.text).length
  return used < rule.qty ? rule : null
}
