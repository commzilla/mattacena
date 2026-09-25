import { useMemo, useState, type ReactNode } from 'react'
import { Icon, Pill } from '../components/ui'
import type { Booking, Source, Status } from '../domain/types'
import { isLive, SOURCE_LABEL, STATUS_LABEL } from '../domain/types'
import { addD, fmtLong, today } from '../lib/date'
import { useData } from '../state/data'
import { useOpenBooking } from '../state/drawer'
import { useToast } from '../state/toast'

type Period = 'oggi' | '7' | 'future' | 'passate' | 'tutte'
const PAGE = 120

export function Prenotazioni() {
  const { boot, bookings } = useData()
  const open = useOpenBooking()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>('future')
  const [src, setSrc] = useState<'' | Source>('')
  const [stf, setStf] = useState<Set<Status>>(new Set(['attesa', 'confermata', 'arrivata', 'noshow']))
  const [limit, setLimit] = useState(PAGE)

  const tname = (id: string) => boot?.tables.find((t) => t.id === id)?.name || '?'
  const list = useMemo(() => {
    const T = today(), end7 = addD(T, 7), qq = q.trim().toLowerCase()
    let l = bookings.filter((b) => stf.has(b.status) && (!src || b.source === src))
    if (period === 'oggi') l = l.filter((b) => b.date === T)
    if (period === '7') l = l.filter((b) => b.date >= T && b.date <= end7)
    if (period === 'future') l = l.filter((b) => b.date >= T)
    if (period === 'passate') l = l.filter((b) => b.date < T)
    if (qq) l = l.filter((b) => (b.name + ' ' + b.phone + ' ' + b.email + ' ' + b.notes + ' ' + b.tables.map(tname).join(' ')).toLowerCase().includes(qq))
    const dir = period === 'passate' ? -1 : 1
    return l.sort((a, b) => dir * (a.date + a.time).localeCompare(b.date + b.time))
  }, [bookings, q, period, src, stf, boot])

  const reset = () => setLimit(PAGE)
  const shown = list.slice(0, limit)

  async function copyCsv() {
    const rows = [['Data', 'Ora', 'Nome', 'Persone', 'Tavoli', 'Stato', 'Origine', 'Occasione', 'Telefono', 'Email', 'Note']]
      .concat(list.map((b) => [b.date, b.time, b.name, String(b.guests), b.tables.map(tname).join(' + '), STATUS_LABEL[b.status], SOURCE_LABEL[b.source], b.occasion, b.phone, b.email, b.notes]))
    const csv = rows.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\n')
    try {
      await navigator.clipboard.writeText(csv)
      toast(`${list.length} righe copiate: incollale in Excel`)
    } catch {
      toast('Copia non consentita da questo browser')
    }
  }

  let lastDay = ''
  const rows: ReactNode[] = []
  shown.forEach((b: Booking) => {
    if (b.date !== lastDay) {
      lastDay = b.date
      const cov = list.filter((x) => x.date === b.date && isLive(x)).reduce((n, x) => n + x.guests, 0)
      rows.push(<tr className="dayrow" key={'d' + b.date}><td colSpan={8}>{b.date === today() ? 'Oggi · ' : ''}{fmtLong(b.date)} · {cov} coperti</td></tr>)
    }
    rows.push(
      <tr key={b.id} onClick={() => open({ id: b.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open({ id: b.id })}>
        <td className="mono">{b.time}</td>
        <td><b>{b.name}</b>{b.notes && <div className="small muted">{b.notes}</div>}</td>
        <td className="mono">{b.guests}</td>
        <td>{b.tables.length ? b.tables.map((id) => <span key={id} className="tag" style={{ marginRight: 4 }}>{tname(id)}</span>) : isLive(b) ? <span className="tag warn">Nessuno</span> : '–'}</td>
        <td><Pill status={b.status} /></td>
        <td className="small">{SOURCE_LABEL[b.source]}</td>
        <td className="small">{b.occasion}{b.discount && <div className="muted">{b.discount}</div>}</td>
        <td className="small muted mono">{b.phone}</td>
      </tr>,
    )
  })

  return (
    <>
      <header className="top">
        <h1>Prenotazioni</h1>
        <span className="spacer" />
        <button className="btn primary new-top" onClick={() => open({ id: null })}><Icon name="plus" />Nuova prenotazione</button>
      </header>
      <main className="view">
        <div className="filters">
          <input type="search" className="search" id="q" placeholder="Cerca nome, telefono, email, tavolo…" value={q} aria-label="Cerca" onChange={(e) => { setQ(e.target.value); reset() }} />
          <div className="seg">
            {([['oggi', 'Oggi'], ['7', 'Prossimi 7 giorni'], ['future', 'Future'], ['passate', 'Passate'], ['tutte', 'Tutte']] as [Period, string][]).map(([k, l]) => (
              <button key={k} aria-pressed={period === k} onClick={() => { setPeriod(k); reset() }}>{l}</button>
            ))}
          </div>
          <select id="src" style={{ width: 'auto' }} aria-label="Origine" value={src} onChange={(e) => { setSrc(e.target.value as '' | Source); reset() }}>
            <option value="">Tutte le origini</option>
            {(Object.keys(SOURCE_LABEL) as Source[]).map((k) => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}
          </select>
        </div>
        <div className="chips" role="group" aria-label="Stato">
          {(Object.keys(STATUS_LABEL) as Status[]).map((k) => (
            <button key={k} className="chip" aria-pressed={stf.has(k)} onClick={() => { const n = new Set(stf); n.has(k) ? n.delete(k) : n.add(k); setStf(n); reset() }}>{STATUS_LABEL[k]}</button>
          ))}
        </div>
        <section className="card">
          <div className="card-h">
            <span><b>{list.length}</b> prenotazioni · <b>{list.filter(isLive).reduce((n, b) => n + b.guests, 0)}</b> coperti</span>
            <button className="btn sm" onClick={copyCsv}>Copia come CSV</button>
          </div>
          {list.length ? (
            <>
              <div className="tbl-wrap">
                <table className="list bk-table">
                  <thead><tr><th>Ora</th><th>Cliente</th><th>Pers.</th><th>Tavolo</th><th>Stato</th><th>Origine</th><th>Occasione</th><th>Telefono</th></tr></thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
              {list.length > limit && <div className="card-b" style={{ textAlign: 'center' }}><button className="btn" onClick={() => setLimit(limit + PAGE)}>Mostra altre {Math.min(PAGE, list.length - limit)}</button></div>}
            </>
          ) : <div className="empty">Nessuna prenotazione con questi filtri.</div>}
        </section>
      </main>
    </>
  )
}
