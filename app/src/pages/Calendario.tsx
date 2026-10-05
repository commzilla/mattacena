import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'
import { closureOf, serviceOf } from '../domain/rules'
import { isLive } from '../domain/types'
import { addD, DAYS3, MONTHS, pd, today, ymd } from '../lib/date'
import { useData } from '../state/data'
import { useOpenBooking } from '../state/drawer'

export function Calendario() {
  const { boot, bookings, setDate, ensureLoaded } = useData()
  const open = useOpenBooking()
  const nav = useNavigate()
  const [month, setMonth] = useState(today().slice(0, 7))
  useEffect(() => ensureLoaded(month + '-15'), [month, ensureLoaded])
  if (!boot) return <div className="loading">Caricamento…</div>

  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = addD(ymd(first), -((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => addD(start, i))
  const rows = days[35].slice(0, 7) !== month ? 35 : 42
  const cap = boot.tables.reduce((n, t) => n + t.seats, 0)
  const mb = bookings.filter((b) => b.date.slice(0, 7) === month)
  const past = mb.filter((b) => b.date < today() && (b.status === 'arrivata' || b.status === 'noshow'))
  const noShow = past.length ? Math.round((past.filter((b) => b.status === 'noshow').length / past.length) * 100) : 0
  const shift = (n: number) => setMonth(ymd(new Date(y, m - 1 + n, 1)).slice(0, 7))

  return (
    <>
      <header className="top">
        <h1 style={{ textTransform: 'capitalize' }}>{MONTHS[m - 1]} {y}</h1>
        <div className="row">
          <button className="btn icon" onClick={() => shift(-1)} aria-label="Mese precedente"><Icon name="left" /></button>
          <button className="btn icon" onClick={() => shift(1)} aria-label="Mese successivo"><Icon name="right" /></button>
          {month !== today().slice(0, 7) && <button className="btn" onClick={() => setMonth(today().slice(0, 7))}>Questo mese</button>}
        </div>
        <span className="spacer" />
        <button className="btn primary new-top" onClick={() => open({ id: null })}><Icon name="plus" />Nuova prenotazione</button>
      </header>
      <main className="view">
        <div className="kpis k4">
          <div className="card kpi"><div className="v">{mb.filter(isLive).length}</div><div className="l">Prenotazioni</div></div>
          <div className="card kpi"><div className="v">{mb.filter(isLive).reduce((n, b) => n + b.guests, 0)}</div><div className="l">Coperti</div></div>
          <div className="card kpi"><div className="v">{noShow}%</div><div className="l">No-show (giorni passati)</div></div>
          <div className="card kpi"><div className="v">{mb.filter((b) => b.source === 'online').length}</div><div className="l">Arrivate dal sito</div></div>
        </div>
        <section className="card card-b">
          <div className="cal">
            {DAYS3.map((d) => <div className="dow" key={d}>{d}</div>)}
            {days.slice(0, rows).map((d) => {
              const bs = bookings.filter((b) => b.date === d && isLive(b))
              const cv = bs.reduce((n, b) => n + b.guests, 0)
              const lunch = bs.filter((b) => serviceOf(b.time) === 'pranzo').reduce((n, b) => n + b.guests, 0)
              const c = closureOf(boot.settings, d)
              const heat = c?.type === 'chiuso' ? 0 : Math.min(85, Math.round((cv / (cap * 1.2)) * 100))
              const pend = bs.filter((b) => b.status === 'attesa').length
              const cls = ['day', d.slice(0, 7) !== month && 'out', d === today() && 'today', c?.type === 'chiuso' && 'closed', heat > 45 && 'hot'].filter(Boolean).join(' ')
              return (
                <button key={d} className={cls} style={{ ['--heat' as string]: heat + '%' }} aria-label={`${d}: ${cv} coperti`}
                  onClick={() => { setDate(d); nav('/oggi') }}>
                  <span className="row" style={{ justifyContent: 'space-between', gap: 4 }}>
                    <span className="d">{pd(d).getDate()}</span>
                    {pend > 0 && <span className="tag warn" title="Da confermare">{pend}</span>}
                  </span>
                  {c && <span className={'tag' + (c.type === 'chiuso' ? ' red' : '')}>{c.type === 'chiuso' ? 'Chiuso' : 'Orario speciale'}</span>}
                  {cv > 0 && (
                    <>
                      <span className="cv">{cv}<small> cop.</small></span>
                      <span className="minibars" title={`Pranzo ${lunch} · Cena ${cv - lunch}`}>
                        <i><b style={{ width: Math.min(100, (lunch / cap) * 100) + '%' }} /></i>
                        <i><b style={{ width: Math.min(100, ((cv - lunch) / cap) * 100) + '%' }} /></i>
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <div className="heat-legend">Meno pieno <i /> Più pieno</div>
            <span className="small muted">Le due barrette sono pranzo e cena. Tocca un giorno per aprirlo.</span>
          </div>
        </section>
      </main>
    </>
  )
}
