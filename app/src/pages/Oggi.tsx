import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DateNav } from '../components/DateNav'
import { Icon, Pill } from '../components/ui'
import { closureOf, serviceOf } from '../domain/rules'
import type { Booking, Service } from '../domain/types'
import { isLive, SOURCE_LABEL, STATUS_CLASS } from '../domain/types'
import { fmtLong, m2t, nowMin, t2m, today } from '../lib/date'
import { useData } from '../state/data'
import { useOpenBooking } from '../state/drawer'
import { useToast } from '../state/toast'

type Svc = 'tutto' | Service

export function Oggi() {
  const { boot, bookings, date, setStatus } = useData()
  const open = useOpenBooking()
  const toast = useToast()
  const [svc, setSvc] = useState<Svc>('tutto')
  const [mode, setMode] = useState<'lista' | 'timeline'>('lista')
  if (!boot) return <div className="loading">Caricamento…</div>

  const tname = (id: string) => boot.tables.find((t) => t.id === id)?.name || '?'
  const all = bookings.filter((b) => b.date === date).sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
  const bs = all.filter((b) => svc === 'tutto' || serviceOf(b.time) === svc)
  const act = bs.filter(isLive)
  const cov = act.reduce((n, b) => n + b.guests, 0)
  const cap = boot.tables.reduce((n, t) => n + t.seats, 0) * (svc === 'tutto' ? 2 : 1)
  const arrived = bs.filter((b) => b.status === 'arrivata').reduce((n, b) => n + b.guests, 0)
  const pending = bs.filter((b) => b.status === 'attesa')
  const unassigned = act.filter((b) => !b.tables.length && b.status !== 'arrivata')
  const closure = closureOf(boot.settings, date)

  const change = async (b: Booking, s: Booking['status'], label: string) => {
    if (await setStatus(b.id, s)) toast(`${b.name}: ${label}`)
  }

  const actions = (b: Booking) => {
    const late = b.date < today() || (b.date === today() && t2m(b.time) + 15 < nowMin())
    if (b.status === 'attesa') return <button className="btn sm" onClick={(e) => { e.stopPropagation(); change(b, 'confermata', 'confermata') }}>Conferma</button>
    if (b.status === 'confermata')
      return (
        <>
          <button className="btn sm" onClick={(e) => { e.stopPropagation(); change(b, 'arrivata', 'arrivati') }}>Arrivati</button>
          {late && <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); change(b, 'noshow', 'no-show') }}>No-show</button>}
        </>
      )
    return null
  }

  const groups: Record<string, Booking[]> = {}
  bs.forEach((b) => (groups[b.time] = groups[b.time] || []).push(b))

  return (
    <>
      <header className="top">
        <h1>{date === today() ? 'Oggi, ' : ''}{fmtLong(date)}</h1>
        <DateNav />
        <span className="spacer" />
        <button className="btn primary new-top" onClick={() => open({ id: null })}><Icon name="plus" />Nuova prenotazione</button>
      </header>
      <main className="view">
        {closure && (
          <div className="card card-b row">
            <span className={'tag ' + (closure.type === 'chiuso' ? 'red' : 'warn')}>{closure.type === 'chiuso' ? 'Chiuso' : `Orario speciale ${closure.start}–${closure.end}`}</span>
            <span>{closure.note}</span>
          </div>
        )}
        <div className="row">
          <div className="seg" role="group" aria-label="Servizio">
            {([['tutto', 'Tutto il giorno'], ['pranzo', 'Pranzo'], ['cena', 'Cena']] as [Svc, string][]).map(([k, l]) => <button key={k} aria-pressed={svc === k} onClick={() => setSvc(k)}>{l}</button>)}
          </div>
          <span className="spacer" style={{ flex: 1 }} />
          <div className="seg" role="group" aria-label="Vista">
            <button aria-pressed={mode === 'lista'} onClick={() => setMode('lista')}>Lista</button>
            <button aria-pressed={mode === 'timeline'} onClick={() => setMode('timeline')}>Timeline tavoli</button>
          </div>
        </div>

        <div className="kpis">
          <div className="card kpi"><div className="v">{act.length}</div><div className="l">Prenotazioni</div></div>
          <div className="card kpi"><div className="v">{cov}<small> / {cap}</small></div><div className="l">Coperti su posti</div><div className="bar"><i style={{ width: Math.min(100, (cov / cap) * 100).toFixed(0) + '%' }} /></div></div>
          <div className="card kpi"><div className="v">{arrived}</div><div className="l">Coperti arrivati</div></div>
          <div className={'card kpi' + (pending.length ? ' alert' : '')}><div className="v">{pending.length}</div><div className="l">Da confermare</div></div>
          <div className="card kpi"><div className="v">{unassigned.length}</div><div className="l">Senza tavolo</div></div>
        </div>

        <div className="grid-oggi">
          <section className="card">
            {mode === 'timeline' ? <Timeline bs={bs} svc={svc} /> : !bs.length ? (
              <div className="empty">Nessuna prenotazione per {svc === 'tutto' ? 'questo giorno' : 'questo servizio'}.<br /><br />
                <button className="btn" onClick={() => open({ id: null })}><Icon name="plus" />Aggiungi prenotazione</button></div>
            ) : Object.keys(groups).sort().map((t) => {
              const l = groups[t]
              return (
                <div className="slot" key={t}>
                  <div className="slot-h"><span className="t">{t}</span><span className="small muted">{l.filter(isLive).reduce((n, b) => n + b.guests, 0)} coperti · {l.filter(isLive).length} prenotazioni</span></div>
                  {l.map((b) => (
                    <div key={b.id} className={'bk' + (isLive(b) ? '' : ' dim')} role="button" tabIndex={0} onClick={() => open({ id: b.id })} onKeyDown={(e) => e.key === 'Enter' && open({ id: b.id })}>
                      <div className="who">
                        <span className="name">{b.name}</span><span className="pax">{b.guests} p.</span>
                        {b.tables.length ? b.tables.map((id) => <span key={id} className="tag">{tname(id)}</span>) : isLive(b) ? <span className="tag warn">Senza tavolo</span> : null}
                        {b.occasion !== 'Casual' && <span className="tag">{b.occasion}</span>}
                        {b.discount && <span className="tag">{b.discount}</span>}
                        <span className="small muted">{SOURCE_LABEL[b.source]}</span>
                      </div>
                      <div className="acts"><Pill status={b.status} />{actions(b)}</div>
                      {b.notes && <div className="note"><Icon name="note" />{b.notes}</div>}
                    </div>
                  ))}
                </div>
              )
            })}
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section className="card">
              <div className="card-h"><h2>Da confermare</h2><span className="mono muted">{pending.length}</span></div>
              <div className="side-list">
                {pending.length ? pending.map((b) => (
                  <div className="item" key={b.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}><b className="mono">{b.time}</b><b>{b.name}</b><span className="tag">{b.guests} p.</span></div>
                      <div className="small muted">{SOURCE_LABEL[b.source]}{b.discount ? ' · ' + b.discount : ''}{b.occasion !== 'Casual' ? ' · ' + b.occasion : ''}</div>
                      <div className="row" style={{ marginTop: 8 }}>
                        <button className="btn sm" onClick={() => change(b, 'confermata', 'confermata')}>Conferma</button>
                        <button className="btn sm ghost" onClick={() => change(b, 'cancellata', 'rifiutata')}>Rifiuta</button>
                        <button className="btn sm ghost" onClick={() => open({ id: b.id })}>Apri</button>
                      </div>
                    </div>
                  </div>
                )) : <div className="empty small">Nessuna richiesta in attesa.</div>}
              </div>
            </section>
            <section className="card">
              <div className="card-h"><h2>Da sapere</h2></div>
              <div className="side-list">
                {act.filter((b) => b.notes || b.occasion === 'Compleanno' || b.occasion === 'Anniversario').map((b) => (
                  <div className="item" key={b.id} style={{ cursor: 'pointer' }} onClick={() => open({ id: b.id })}>
                    <b className="mono" style={{ minWidth: 44 }}>{b.time}</b>
                    <div style={{ minWidth: 0 }}><b>{b.name}</b> {(b.occasion === 'Compleanno' || b.occasion === 'Anniversario') && <span className="tag warn">{b.occasion}</span>}<div className="small muted">{b.notes}</div></div>
                  </div>
                ))}
                {!act.some((b) => b.notes || b.occasion === 'Compleanno' || b.occasion === 'Anniversario') && <div className="empty small">Nessuna nota per questo servizio.</div>}
              </div>
            </section>
            {unassigned.length > 0 && (
              <section className="card card-b"><div className="row" style={{ justifyContent: 'space-between' }}><span><b>{unassigned.length}</b> prenotazioni senza tavolo</span><Link className="btn sm" to="/sala">Assegna in sala</Link></div></section>
            )}
          </div>
        </div>
      </main>
    </>
  )
}

function Timeline({ bs, svc }: { bs: Booking[]; svc: Svc }) {
  const { boot, date } = useData()
  const open = useOpenBooking()
  const dur = boot!.settings.duration
  const [from, to] = svc === 'pranzo' ? [690, 990] : svc === 'cena' ? [1110, 1410] : [690, 1410]
  const ppm = svc === 'tutto' ? 1.5 : 3
  const w = (to - from) * ppm
  const act = bs.filter((b) => b.status !== 'cancellata')

  const row = (key: string, label: ReactNode, sub: string | number, list: Booking[]) => {
    const lanes: number[] = []
    const placed = [...list].sort((a, b) => a.time.localeCompare(b.time)).map((b) => {
      const s = t2m(b.time)
      let i = lanes.findIndex((e) => e <= s)
      if (i < 0) { i = lanes.length; lanes.push(0) }
      lanes[i] = s + dur
      return { b, lane: i }
    })
    return (
      <div className="g-row" key={key}>
        <div className="g-lab">{label}<small>{sub}</small></div>
        <div className="g-track" style={{ height: Math.max(1, lanes.length) * 27 + 4 }}>
          {placed.map(({ b, lane }) => {
            const s = t2m(b.time)
            if (s + dur < from || s > to) return null
            return (
              <div key={b.id} className={'g-bar ' + STATUS_CLASS[b.status]} role="button" tabIndex={0} onClick={() => open({ id: b.id })}
                style={{ left: (s - from) * ppm, width: dur * ppm - 3, top: 3 + lane * 27 }} title={`${b.time} ${b.name} · ${b.guests} p.`}>
                {b.guests} · {b.name.split(' ').slice(-1)[0]}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const hours: number[] = []
  for (let m = Math.ceil(from / 60) * 60; m <= to; m += 60) hours.push(m)
  const un = act.filter((b) => !b.tables.length)
  const n = nowMin()

  return (
    <>
      <div className="gantt-wrap">
        <div className="gantt" style={{ ['--w' as string]: w + 'px', ['--ppm' as string]: ppm }}>
          <div className="g-row head"><div className="g-lab">Tavolo</div><div className="g-hours">{hours.map((m) => <span key={m} style={{ left: (m - from) * ppm }}>{m2t(m)}</span>)}</div></div>
          {un.length > 0 && row('un', <span style={{ color: 'var(--copper)' }}>Senza tavolo</span>, un.length, un)}
          {boot!.areas.map((a) => {
            const ts = boot!.tables.filter((t) => t.area === a.id)
            if (!ts.length) return null
            return [
              <div className="g-row" key={'h' + a.id}><div className="g-area">{a.name}</div></div>,
              ...ts.map((t) => row(t.id, t.name, t.seats + 'p', act.filter((b) => b.tables.includes(t.id)))),
            ]
          })}
          {date === today() && n >= from && n <= to && <div className="g-now" style={{ left: 120 + (n - from) * ppm }} />}
        </div>
      </div>
      <div className="legend">
        <span><i className="sw" style={{ borderColor: 'var(--olive)' }} />Confermata</span>
        <span><i className="sw" style={{ borderColor: 'var(--copper)', borderStyle: 'dashed' }} />In attesa</span>
        <span><i className="sw" style={{ borderColor: 'var(--seated)', background: 'var(--seated)' }} />Arrivati</span>
        <span><i className="sw" style={{ borderColor: 'var(--red)' }} />No-show</span>
        <span>Durata prenotazione: {dur} min</span>
      </div>
    </>
  )
}
