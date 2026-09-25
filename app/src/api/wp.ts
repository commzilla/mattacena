// Client for the WordPress plugin API (wp-plugin/mattacena-core). See docs/API.md for the contract.
import type { Booking, BookingInput, Bootstrap, Status, User } from '../domain/types'
import { ApiError, type Api } from './client'

const TOKEN = 'mattacena-token'

export function createWpApi(base: string): Api {
  let token: string | null = null
  try { token = localStorage.getItem(TOKEN) } catch { /* private mode */ }
  const setToken = (t: string | null) => {
    token = t
    try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN) } catch { /* ignore */ }
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetch(base + path, {
        method,
        // X-MC-Token rather than Authorization: some Apache setups (SiteGround included) strip Authorization.
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-MC-Token': token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError('Connessione assente. Controlla la rete e riprova.', 0)
    }
    if (res.status === 401) setToken(null)
    if (!res.ok) {
      let msg = 'Errore del server (' + res.status + ')'
      try { const j = await res.json(); if (j && j.message) msg = j.message } catch { /* not json */ }
      throw new ApiError(msg, res.status)
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }

  return {
    mode: 'wp',
    async login(email, password) {
      const r = await call<{ token: string; user: User }>('POST', '/auth/login', { email, password })
      setToken(r.token)
      return r.user
    },
    async logout() {
      try { await call('POST', '/auth/logout') } finally { setToken(null) }
    },
    async me() {
      if (!token) return null
      try { return await call<User>('GET', '/auth/me') } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e }
    },
    bootstrap: () => call<Bootstrap>('GET', '/bootstrap'),
    listBookings: (from, to) => call<Booking[]>('GET', `/bookings?from=${from}&to=${to}`),
    createBooking: (input: BookingInput) => call<Booking>('POST', '/bookings', input),
    updateBooking: (id, patch) => call<Booking>('PATCH', '/bookings/' + encodeURIComponent(id), patch),
    setStatus: (id, status: Status) => call<Booking>('POST', `/bookings/${encodeURIComponent(id)}/status`, { status }),
    deleteBooking: (id) => call<void>('DELETE', '/bookings/' + encodeURIComponent(id)),
  }
}
