export type Status = 'attesa' | 'confermata' | 'arrivata' | 'noshow' | 'cancellata'
export type Source = 'online' | 'telefono' | 'walkin'
export type Role = 'titolare' | 'responsabile' | 'cameriere'
export type Service = 'pranzo' | 'cena'

export interface Area { id: string; name: string }

export interface Table {
  id: string
  area: string
  name: string
  seats: number
  shape: 'round' | 'square' | 'rect'
  rot: number
  x: number
  y: number
}

export interface Booking {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  guests: number
  name: string
  phone: string
  email: string
  occasion: string
  notes: string
  source: Source
  status: Status
  tables: string[]
  discount: string
}

export type BookingInput = Omit<Booking, 'id' | 'discount'> & { discount?: string }

export interface ServiceHours { on: boolean; start: string; end: string }

export interface Closure {
  id: string
  date: string
  type: 'chiuso' | 'orario'
  start?: string
  end?: string
  note: string
}

export interface DiscountRule { id: string; min: number; max: number; pct: number; qty: number; text: string }

export interface Settings {
  duration: number
  interval: number
  maxOnline: number
  defaultStatus: Status
  occasions: string[]
  week: Record<number, Record<Service, ServiceHours>>
  closures: Closure[]
  discounts: DiscountRule[]
  notify: { confirm: boolean; reminder: boolean; staff: boolean; review: boolean }
}

export interface User { id: string; name: string; email: string; role: Role }

export interface Bootstrap { areas: Area[]; tables: Table[]; settings: Settings }

export const STATUS_LABEL: Record<Status, string> = {
  attesa: 'In attesa',
  confermata: 'Confermata',
  arrivata: 'Arrivata',
  noshow: 'No-show',
  cancellata: 'Cancellata',
}
export const STATUS_CLASS: Record<Status, string> = {
  attesa: 's-attesa',
  confermata: 's-confermata',
  arrivata: 's-arrivata',
  noshow: 's-noshow',
  cancellata: 's-cancellata',
}
export const SOURCE_LABEL: Record<Source, string> = { online: 'Online', telefono: 'Telefono', walkin: 'Walk-in' }
export const ROLE_LABEL: Record<Role, string> = { titolare: 'Titolare', responsabile: 'Responsabile di sala', cameriere: 'Cameriere' }

export const isLive = (b: Booking) => b.status !== 'cancellata' && b.status !== 'noshow'
