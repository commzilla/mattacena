// Demo backend that lives in the browser (localStorage). Used until the WordPress plugin is deployed.
// Areas, tables, hours, occasions and discounts are the real values from the current site;
// customers and bookings are invented.
import { addD, dow, nowMin, t2m, today } from '../lib/date'
import { slotsOf, suggestTables } from '../domain/rules'
import type { Area, Booking, BookingInput, Bootstrap, Settings, Status, Table, User } from '../domain/types'
import { isLive } from '../domain/types'
import { ApiError, type Api } from './client'

const KEY = 'mattacena-app-demo-v1'
const SESSION = 'mattacena-app-demo-session'

const AREAS: [number, string][] = [[2, 'Sala 1'], [3, 'Sala 2'], [4, 'Sala 3'], [5, 'Pedana'], [6, 'Sala vini']]
const TABLES: [string, number, number][] = [['#101', 2, 2], ['#1', 2, 2], ['#2', 2, 2], ['#3', 2, 2], ['#4', 4, 2], ['#104', 2, 2], ['#5', 4, 2], ['#6', 2, 2], ['#108', 2, 2],
  ['#9', 4, 3], ['#10', 4, 3], ['#11', 2, 3], ['#12', 2, 3], ['#109', 2, 3],
  ['#13', 2, 4], ['#14', 8, 4], ['#15', 2, 4], ['#16', 4, 4], ['#17', 4, 4], ['#18', 2, 4], ['#19', 2, 4], ['#20', 2, 4], ['#27', 2, 4],
  ['#21', 6, 5], ['#22', 4, 5], ['#23', 4, 5], ['#24', 4, 5], ['#25', 2, 5], ['#26', 2, 5], ['#7', 2, 6], ['#8', 4, 6]]

export const DEMO_USERS: (User & { password: string })[] = [
  { id: 'u1', name: 'Titolare', email: 'titolare@mattacena.com', role: 'titolare', password: 'demo' },
  { id: 'u2', name: 'Responsabile di sala', email: 'sala@mattacena.com', role: 'responsabile', password: 'demo' },
  { id: 'u3', name: 'Cameriere', email: 'cameriere@mattacena.com', role: 'cameriere', password: 'demo' },
]

const NAMES = ['Giulia Bianchi', 'Marco Rossi', 'Sophie Martin', 'James Walker', 'Lukas Becker', 'Chiara Conti', 'Hannah Schmidt', 'Luca Ferrari', 'Emma Johnson', 'Pierre Dubois', 'Sara Romano', 'Anna Novak', 'Tommaso Greco', 'Olivia Brown', 'Matteo Galli', 'Laura Moretti', 'Kenji Tanaka', 'Elena Ricci', 'Daniel Müller', 'Francesca Bruno', 'Carlos García', 'Martina Esposito', 'Noah Wilson', 'Alessandro Costa', 'Isabelle Leroy', 'Federico Marino', 'Mia Fischer', 'Giorgio Lombardi', 'Charlotte Taylor', 'Davide Fontana']
const NOTES = ['Allergia al glutine', 'Seggiolone per bambino', 'Tavolo tranquillo, possibilmente in Sala vini', 'Un vegetariano nel gruppo', 'Portano una torta di compleanno', 'Arrivano con 15 minuti di ritardo', 'Intolleranza al lattosio', 'Carrozzina: serve un tavolo accessibile']

interface Db { v: 1; seededOn: string; uid: number; areas: Area[]; tables: Table[]; settings: Settings; bookings: Booking[] }

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function defaultSettings(): Settings {
  const week: Settings['week'] = {}
  for (let d = 0; d < 7; d++) week[d] = { pranzo: { on: true, start: '12:00', end: '15:30' }, cena: { on: true, start: '19:00', end: '22:30' } }
  return {
    duration: 60, interval: 30, maxOnline: 27, defaultStatus: 'attesa',
    occasions: ['Casual', 'Lavoro', 'Compleanno', 'Anniversario'], week,
    closures: [
      { id: 'c1', date: '2026-12-24', type: 'orario', start: '12:00', end: '15:30', note: 'Vigilia: solo pranzo' },
      { id: 'c2', date: '2026-12-25', type: 'chiuso', note: 'Natale' },
    ],
    discounts: [
      { id: 'd1', min: 2, max: 4, pct: 50, qty: 4, text: 'Sconto 50%' },
      { id: 'd2', min: 4, max: 8, pct: 30, qty: 4, text: 'Sconto 30%' },
      { id: 'd3', min: 9, max: 20, pct: 20, qty: 6, text: 'Sconto 20%' },
    ],
    notify: { confirm: true, reminder: true, staff: true, review: false },
  }
}

function layout(): { areas: Area[]; tables: Table[] } {
  const areas = AREAS.map(([id, name]) => ({ id: 'a' + id, name }))
  const tables: Table[] = []
  let uid = 1
  for (const a of areas) {
    let x = 150, y = 150, rowH = 0
    for (const [name, seats] of TABLES.filter((t) => 'a' + t[2] === a.id)) {
      const shape = seats <= 2 ? 'round' : seats <= 4 ? 'square' : 'rect'
      const w = shape === 'round' ? 2 * Math.max(38, 24 + seats * 7) : shape === 'square' ? (seats <= 2 ? 70 : 85) : 160
      if (x + w / 2 > 1090) { x = 150; y += rowH + 110; rowH = 0 }
      tables.push({ id: 't' + uid++, area: a.id, name, seats, shape, rot: 0, x: Math.round(x / 25) * 25, y: Math.round(y / 25) * 25 })
      x += w + 120
      rowH = Math.max(rowH, shape === 'rect' ? 85 : w)
    }
  }
  return { areas, tables }
}

function seed(): Db {
  const { areas, tables } = layout()
  const db: Db = { v: 1, seededOn: today(), uid: 1, areas, tables, settings: defaultSettings(), bookings: [] }
  const r = rng(20260925), pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const dist: [number, number][] = [[1, .15], [2, .46], [3, .13], [4, .12], [5, .04], [6, .04], [7, .02], [8, .02], [10, .01], [12, .01]]
  const guests = () => { const x = r(); let a = 0; for (const [g, p] of dist) { a += p; if (x < a) return g } return 2 }
  const now = nowMin(), T = today()
  for (let off = -35; off <= 45; off++) {
    const date = addD(T, off), wk = dow(date) >= 4
    for (const svc of ['pranzo', 'cena'] as const) {
      const sl = slotsOf(db.settings, date).filter((x) => x.svc === svc).map((x) => x.t)
      if (!sl.length) continue
      let n = svc === 'cena' ? (wk ? 9 + Math.floor(r() * 6) : 4 + Math.floor(r() * 5)) : (wk ? 4 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3))
      if (off > 14) n = Math.max(0, Math.round(n * (off > 30 ? 0.25 : 0.5)))
      if (off === 0) n = svc === 'cena' ? 13 : 6
      const day: Booking[] = []
      for (let i = 0; i < n; i++) {
        const t = svc === 'cena' ? pick(sl.filter((x) => x >= '19:30' && x <= '21:30').concat(sl)) : pick(sl.filter((x) => x <= '14:00'))
        const g = guests(), name = pick(NAMES)
        const source = off <= 0 && r() < 0.1 ? 'walkin' : r() < 0.58 ? 'online' : 'telefono'
        const end = t2m(t) + db.settings.duration
        let status: Status
        if (off < 0 || (off === 0 && end <= now)) status = r() < 0.06 ? 'noshow' : r() < 0.06 ? 'cancellata' : 'arrivata'
        else if (off === 0 && t2m(t) <= now) status = 'arrivata'
        else status = r() < 0.04 ? 'cancellata' : source === 'online' && r() < 0.35 ? 'attesa' : 'confermata'
        if (source === 'walkin') status = off === 0 && t2m(t) > now ? 'confermata' : 'arrivata'
        const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
        const disc = source === 'online' && r() < 0.3 ? db.settings.discounts.find((x) => g >= x.min && g <= x.max) : undefined
        day.push({
          id: 'b' + db.uid++, date, time: t, guests: g, name,
          phone: source === 'walkin' ? '' : '+39 3' + Math.floor(r() * 90 + 10) + ' ' + Math.floor(r() * 900 + 100) + ' ' + Math.floor(r() * 9000 + 1000),
          email: source === 'online' ? slug(name.split(' ')[0]) + '.' + slug(name.split(' ').slice(-1)[0]) + '@example.com' : '',
          occasion: r() < 0.72 ? 'Casual' : pick(['Lavoro', 'Compleanno', 'Compleanno', 'Anniversario']),
          notes: r() < 0.22 ? pick(NOTES) : '', source, status, tables: [], discount: disc ? disc.text : '',
        })
      }
      day.sort((a, b) => a.time.localeCompare(b.time))
      for (const b of day) {
        if (isLive(b) && !(off === 0 && t2m(b.time) > now && r() < 0.3) && !(off > 0 && r() < 0.35))
          b.tables = suggestTables(db.tables, db.bookings, db.settings.duration, b.date, b.time, b.guests, b.id)
        db.bookings.push(b)
      }
    }
  }
  return db
}

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms))

export function createMockApi(): Api {
  let db: Db
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Db) : null
    db = parsed && parsed.v === 1 && parsed.seededOn === today() ? parsed : seed()
  } catch {
    db = seed()
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full or blocked: keep in memory */ } }
  save()
  const find = (id: string) => {
    const b = db.bookings.find((x) => x.id === id)
    if (!b) throw new ApiError('Prenotazione non trovata', 404)
    return b
  }
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

  return {
    mode: 'mock',
    async login(email, password) {
      await wait(250)
      const u = DEMO_USERS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password)
      if (!u) throw new ApiError('Email o password non corrette', 401)
      const { password: _pw, ...user } = u
      try { localStorage.setItem(SESSION, JSON.stringify(user)) } catch { /* ignore */ }
      return user
    },
    async logout() { try { localStorage.removeItem(SESSION) } catch { /* ignore */ } },
    async me() {
      try { const raw = localStorage.getItem(SESSION); return raw ? (JSON.parse(raw) as User) : null } catch { return null }
    },
    async bootstrap(): Promise<Bootstrap> { await wait(); return clone({ areas: db.areas, tables: db.tables, settings: db.settings }) },
    async listBookings(from, to) { await wait(); return clone(db.bookings.filter((b) => b.date >= from && b.date <= to)) },
    async createBooking(input) {
      await wait()
      const b: Booking = { discount: '', ...input, id: 'b' + db.uid++ }
      db.bookings.push(b); save(); return clone(b)
    },
    async updateBooking(id, patch) { await wait(); const b = find(id); Object.assign(b, patch); save(); return clone(b) },
    async setStatus(id, status) { await wait(80); const b = find(id); b.status = status; save(); return clone(b) },
    async deleteBooking(id) { await wait(); db.bookings = db.bookings.filter((b) => b.id !== id); save() },
  }
}
