import type { Area, Booking, BookingInput, Bootstrap, Settings, Status, Table, User } from '../domain/types'

export type TablePos = Pick<Table, 'id' | 'x' | 'y' | 'shape' | 'rot'>
export type TableInput = Omit<Table, 'id'>

/** Everything the app needs from the backend. Implemented by the demo API and by the WordPress API. */
export interface Api {
  mode: 'mock' | 'wp'
  login(email: string, password: string): Promise<User>
  logout(): Promise<void>
  /** The signed-in user, or null when the session has expired. */
  me(): Promise<User | null>
  bootstrap(): Promise<Bootstrap>
  listBookings(from: string, to: string): Promise<Booking[]>
  createBooking(input: BookingInput): Promise<Booking>
  updateBooking(id: string, patch: Partial<BookingInput>): Promise<Booking>
  setStatus(id: string, status: Status): Promise<Booking>
  deleteBooking(id: string): Promise<void>

  // Floor plan. Each call returns the full, updated list.
  saveLayout(tables: TablePos[]): Promise<{ tables: Table[] }>
  createTable(t: TableInput): Promise<{ tables: Table[]; id: string }>
  updateTable(id: string, patch: Partial<TableInput>): Promise<{ tables: Table[] }>
  deleteTable(id: string): Promise<{ tables: Table[] }>
  createArea(name: string): Promise<{ areas: Area[]; id: string }>
  updateArea(id: string, name: string): Promise<{ areas: Area[] }>
  deleteArea(id: string): Promise<{ areas: Area[] }>

  /** Partial update: only the keys passed are saved. `notes` explains anything not applied. */
  saveSettings(patch: Partial<Settings>): Promise<{ settings: Settings; notes: string[] }>
}

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message)
  }
}
