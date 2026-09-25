import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ROLE_LABEL } from '../domain/types'
import { today } from '../lib/date'
import { useAuth } from '../state/auth'
import { useData } from '../state/data'
import { ACCESS, type View } from '../state/permissions'
import { Icon } from './ui'

export const VIEW_LABEL: Record<View, string> = {
  oggi: 'Oggi', sala: 'Sala', prenotazioni: 'Prenotazioni', calendario: 'Calendario',
  fidelity: 'Fidelity', impostazioni: 'Impostazioni', modulo: 'Modulo clienti',
}
const TAB_ORDER: View[] = ['oggi', 'sala', 'prenotazioni', 'fidelity']
const FAB_VIEWS = ['/oggi', '/sala', '/prenotazioni', '/calendario']

export function Layout({ children, onNewBooking }: { children: ReactNode; onNewBooking: () => void }) {
  const { user, logout } = useAuth()
  const { bookings, online, error } = useData()
  const loc = useLocation()
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [loc.pathname])
  if (!user) return null

  const views = ACCESS[user.role]
  const pending = bookings.filter((b) => b.status === 'attesa' && b.date >= today()).length
  // Bottom bar shows up to 4 sections; anything else goes under "Altro".
  const tabs = TAB_ORDER.filter((v) => views.includes(v))
  const extra = views.filter((v) => !tabs.includes(v))
  const current = loc.pathname.slice(1) as View

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><b>Mattacena</b><small>Gestione</small></div>
        <nav className="nav" aria-label="Sezioni">
          {views.map((v) => (
            <NavLink key={v} to={'/' + v} aria-current={current === v ? 'page' : undefined}>
              <Icon name={v} />
              <span className="lbl">{VIEW_LABEL[v]}</span>
              {v === 'oggi' && pending > 0 && <span className="badge" title="Da confermare">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot" style={{ padding: 0 }}>
          <div className="userbox">
            <div><b>{user.name}</b>{ROLE_LABEL[user.role]}</div>
            <button onClick={logout}>Esci</button>
          </div>
        </div>
      </aside>

      <div className="main">
        {!online && <div className="offline">Sei offline: vedi gli ultimi dati caricati. Le modifiche non vengono salvate.</div>}
        {online && error && <div className="offline">{error}</div>}
        {children}
      </div>

      <nav className="tabbar" aria-label="Menu principale" style={{ gridTemplateColumns: `repeat(${tabs.length + 1},minmax(0,1fr))` }}>
        {tabs.map((v) => (
          <NavLink key={v} to={'/' + v} aria-current={current === v && !more ? 'page' : undefined}>
            <Icon name={v} />
            <span>{v === 'prenotazioni' ? 'Prenotaz.' : VIEW_LABEL[v]}</span>
            {v === 'oggi' && pending > 0 && <span className="badge">{pending}</span>}
          </NavLink>
        ))}
        {/* Always present: it also holds the account and sign-out. */}
        <button onClick={() => setMore((m) => !m)} aria-expanded={more} aria-current={more || extra.includes(current) ? 'page' : undefined}>
          <Icon name="menu" />
          <span>Altro</span>
        </button>
      </nav>

      {more && (
        <>
          <div className="scrim" style={{ zIndex: 44 }} onClick={() => setMore(false)} />
          <div className="more-sheet" role="dialog" aria-label="Altre sezioni">
            <div className="grab" />
            {views.map((v) => (
              <NavLink key={v} to={'/' + v} aria-current={current === v ? 'page' : undefined}>
                <Icon name={v} />
                {VIEW_LABEL[v]}
              </NavLink>
            ))}
            <div className="userbox" style={{ color: 'var(--muted)', borderColor: 'var(--line)' }}>
              <div><b style={{ color: 'var(--ink)' }}>{user.name}</b>{ROLE_LABEL[user.role]}</div>
              <button onClick={logout} style={{ color: 'var(--ink)', borderColor: 'var(--line2)' }}>Esci</button>
            </div>
          </div>
        </>
      )}

      {FAB_VIEWS.includes(loc.pathname) && (
        <button className="fab" onClick={onNewBooking} aria-label="Nuova prenotazione"><Icon name="plus" /></button>
      )}
    </div>
  )
}
