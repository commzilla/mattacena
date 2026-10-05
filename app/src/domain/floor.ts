// Floor-plan geometry. The plan is drawn in a 1200 × 760 coordinate space; one grid step is 25 units (50 cm).
import type { Table } from './types'

export const W = 1200
export const H = 760
export const GRID = 25
export const snap = (v: number) => Math.round(v / GRID) * GRID

export function tableSize(t: Pick<Table, 'shape' | 'seats'>) {
  if (t.shape === 'round') {
    const r = Math.max(38, 24 + t.seats * 7)
    return { w: r * 2, h: r * 2, r, ends: 0 }
  }
  if (t.shape === 'square') {
    const s = t.seats <= 2 ? 70 : t.seats <= 4 ? 85 : 100
    return { w: s, h: s, r: 0, ends: 0 }
  }
  const ends = t.seats >= 6 ? 2 : 0
  const per = Math.ceil((t.seats - ends) / 2)
  return { w: Math.max(140, per * 62 + 20), h: 85, r: 0, ends }
}

/** Chair positions relative to the table centre, before the table's own rotation. */
export function chairs(t: Pick<Table, 'shape' | 'seats'>) {
  const s = tableSize(t), out: { x: number; y: number; rot: number }[] = [], off = 18
  if (t.shape === 'round') {
    for (let i = 0; i < t.seats; i++) {
      const a = (i / t.seats) * Math.PI * 2 - Math.PI / 2
      out.push({ x: Math.cos(a) * (s.r + off), y: Math.sin(a) * (s.r + off), rot: (a * 180) / Math.PI + 90 })
    }
    return out
  }
  if (t.shape === 'square') {
    const sides: [number, number, number][] = [[0, -1, 0], [0, 1, 180], [-1, 0, 270], [1, 0, 90]]
    const counts = [0, 0, 0, 0], order = t.seats <= 2 ? [0, 1] : [0, 1, 2, 3]
    for (let i = 0; i < t.seats; i++) counts[order[i % order.length]]++
    sides.forEach(([dx, dy, r], k) => {
      for (let i = 0; i < counts[k]; i++) {
        const along = (i - (counts[k] - 1) / 2) * 34
        out.push({ x: dx ? dx * (s.w / 2 + off) : along, y: dy ? dy * (s.h / 2 + off) : along, rot: r })
      }
    })
    return out
  }
  const top = Math.ceil((t.seats - s.ends) / 2), bot = t.seats - s.ends - top
  const place = (c: number, sg: number) => {
    for (let i = 0; i < c; i++) out.push({ x: (i - (c - 1) / 2) * ((s.w - 20) / Math.max(c, 1)), y: sg * (s.h / 2 + off), rot: sg < 0 ? 0 : 180 })
  }
  place(top, -1)
  place(bot, 1)
  if (s.ends) out.push({ x: -(s.w / 2 + off), y: 0, rot: 270 }, { x: s.w / 2 + off, y: 0, rot: 90 })
  return out
}

export function bbox(t: Pick<Table, 'shape' | 'seats' | 'rot' | 'x' | 'y'>) {
  const s = tableSize(t)
  let hw = s.w / 2, hh = s.h / 2
  const r = ((t.rot % 180) + 180) % 180
  if (r === 90) [hw, hh] = [hh, hw]
  else if (r === 45 || r === 135) hw = hh = (s.w + s.h) / 2 / Math.SQRT2
  return { x1: t.x - hw, y1: t.y - hh, x2: t.x + hw, y2: t.y + hh }
}

/** Ids of tables closer than ~30 cm to another one. */
export function overlaps(list: Table[]) {
  const bad = new Set<string>()
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = bbox(list[i]), b = bbox(list[j]), m = 14
      if (a.x1 < b.x2 + m && a.x2 + m > b.x1 && a.y1 < b.y2 + m && a.y2 + m > b.y1) {
        bad.add(list[i].id)
        bad.add(list[j].id)
      }
    }
  return bad
}

/** First free grid spot in an area for a new table. */
export function freeSpot(list: Table[], t: Pick<Table, 'shape' | 'seats' | 'rot'>) {
  for (let y = 150; y < H - 100; y += GRID * 2)
    for (let x = 150; x < W - 100; x += GRID * 2) {
      const c = { ...t, x, y, id: '__new', area: '', name: '' } as Table
      if (!overlaps([...list, c]).has('__new')) return { x, y }
    }
  return { x: W / 2, y: H / 2 }
}
