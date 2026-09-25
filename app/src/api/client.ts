import type { Booking, BookingInput, Bootstrap, Status, User } from '../domain/types'

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
}

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message)
  }
}
