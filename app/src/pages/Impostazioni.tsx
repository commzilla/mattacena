import { useState } from 'react'
import { api } from '../api'
import { Icon } from '../components/ui'
import type { Closure, DiscountRule, Service, Settings } from '../domain/types'
import { addD, DAYS, fmtLong, m2t, pd, t2m, today } from '../lib/date'
import { useData } from '../state/data'
import { useToast } from '../state/toast'

type Tab = 'orari' | 'chiusure' | 'sconti' | 'regole'
const TABS: [Tab, string][] = [['orari', 'Orari di apertura'], ['chiusure', 'Chiusure e festività'], ['sconti', 'Sconti'], ['regole', 'Regole prenotazione']]

const timeOptions = (from = 600, to = 1440, step = 15) => {
  const out: string[] = []
  for (let m = from; m <= to; m += step) out.push(m === 1440 ? '24:00' : m2t(m))
  return out
}
const TIMES = timeOptions()

export function Impostazioni() {
  const { boot } = useData()
  const [tab, setTab] = useState<Tab>('orari')
  if (!boot) return <div className="loading">Caricamento…</div>
  return (
    <>
      <header className="top"><h1>Impostazioni</h1><span className="spacer" /><span className="demo">Valgono anche per il modulo di prenotazione del sito</span></header>
      <main className="view">
        <div className="set-grid">
          <nav className="set-nav">{TABS.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>
          <section className="card">
            {tab === 'orari' && <Orari key="o" />}
            {tab === 'chiusure' && <Chiusure key="c" />}
            {tab === 'sconti' && <Sconti key="s" />}
            {tab === 'regole' && <Regole key="r" />}
          </section>
        </div>
      </main>
    </>
  )
}

/** Shared save logic: sends only the given settings keys. */
function useSave() {
  const { mergeBoot, attempt } = useData()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const save = async (patch: Partial<Settings>, msg: string) => {
    setBusy(true)
    const r = await attempt(api.saveSettings(patch))
    setBusy(false)
    if (!r) return false
    mergeBoot({ settings: r.settings })
    toast(r.notes.length ? r.notes.join(' ') : msg)
    return true
  }
  return { save, busy }
}

function SaveBar({ dirty, busy, onSave, onReset }: { dirty: boolean; busy: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="card-b row" style={{ borderTop: '1px solid var(--line)', justifyContent: 'flex-end' }}>
      {dirty && <span className="small muted" style={{ marginRight: 'auto' }}>Modifiche non salvate</span>}
      <button className="btn" disabled={!dirty || busy} onClick={onReset}>Annulla</button>
      <button className="btn primary" disabled={!dirty || busy} onClick={onSave}>{busy ? 'Salvataggio…' : 'Salva'}</button>
    </div>
  )
}

function Orari() {
  const { boot } = useData()
  const { save, busy } = useSave()
  const initial = boot!.settings.week
  const [week, setWeek] = useState(() => structuredClone(initial))
  const dirty = JSON.stringify(week) !== JSON.stringify(initial)
  const set = (d: number, k: Service, p: Partial<Settings['week'][number][Service]>) => setWeek((w) => ({ ...w, [d]: { ...w[d], [k]: { ...w[d][k], ...p } } }))
  const invalid = Object.values(week).some((d) => (['pranzo', 'cena'] as Service[]).some((k) => d[k].on && d[k].end !== '24:00' && t2m(d[k].end) <= t2m(d[k].start)))
  const pos = (t: string) => ((t === '24:00' ? 1440 : t2m(t)) - 600) / 840 * 100

  return (
    <>
      <div className="card-h"><h2>Orari di apertura</h2><span className="small muted">Fasce ogni {boot!.settings.interval} min</span></div>
      <div className="tbl-wrap">
        <table className="week">
          <thead><tr><th>Giorno</th><th>Pranzo</th><th>Cena</th><th style={{ minWidth: 180 }}>10:00 → 24:00</th></tr></thead>
          <tbody>
            {DAYS.map((name, d) => (
              <tr key={d}>
                <td><b>{name}</b></td>
                {(['pranzo', 'cena'] as Service[]).map((k) => {
                  const h = week[d][k]
                  return (
                    <td key={k} data-label={k === 'pranzo' ? 'Pranzo' : 'Cena'}>
                      <div className={'svc-cell' + (h.on ? '' : ' off')}>
                        <button className="sw-toggle" role="switch" aria-checked={h.on} aria-label={`${k} ${name}`} onClick={() => set(d, k, { on: !h.on })} />
                        <select aria-label={`Inizio ${k} ${name}`} disabled={!h.on} value={h.start} onChange={(e) => set(d, k, { start: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                        <span className="muted">–</span>
                        <select aria-label={`Fine ${k} ${name}`} disabled={!h.on} value={h.end} onChange={(e) => set(d, k, { end: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                      </div>
                    </td>
                  )
                })}
                <td>
                  <div className="track">
                    {(['pranzo', 'cena'] as Service[]).filter((k) => week[d][k].on).map((k) => <i key={k} style={{ left: pos(week[d][k].start) + '%', width: Math.max(0, pos(week[d][k].end) - pos(week[d][k].start)) + '%' }} />)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-b">
        {invalid && <div className="err" style={{ marginBottom: 8 }}>In almeno un giorno l’orario di fine viene prima dell’inizio.</div>}
        <p className="hint">Se tutti i giorni aperti hanno gli stessi orari di pranzo e cena, vengono usati anche dal modulo di prenotazione del sito. Oggi il modulo ha un’unica fascia 12:00–22:00.</p>
      </div>
      <SaveBar dirty={dirty} busy={busy || invalid} onReset={() => setWeek(structuredClone(initial))} onSave={() => save({ week }, 'Orari salvati')} />
    </>
  )
}

function Chiusure() {
  const { boot } = useData()
  const { save, busy } = useSave()
  const toast = useToast()
  const list = boot!.settings.closures
  const [date, setDate] = useState(addD(today(), 7))
  const [type, setType] = useState<Closure['type']>('chiuso')
  const [start, setStart] = useState('19:00')
  const [end, setEnd] = useState('22:30')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const upcoming = list.filter((c) => c.date >= today()).sort((a, b) => a.date.localeCompare(b.date))
  const past = list.filter((c) => c.date < today())

  async function add() {
    if (!date) return toast('Scegli una data')
    if (list.some((c) => c.date === date)) return toast('C’è già una regola per quel giorno')
    if (type === 'orario' && t2m(end) <= t2m(start)) return toast('L’orario di fine deve venire dopo l’inizio')
    const c: Closure = { id: 'new', date, type, note: note.trim() || (type === 'chiuso' ? 'Chiuso' : 'Orario speciale'), ...(type === 'orario' ? { start, end } : {}) }
    if (await save({ closures: [...list, c] }, `${fmtLong(date)} aggiunto`)) setNote('')
  }
  const remove = (id: string) => save({ closures: list.filter((c) => c.id !== id) }, 'Chiusura rimossa').then(() => setConfirm(null))

  return (
    <>
      <div className="card-h"><h2>Chiusure e festività</h2></div>
      <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="two">
          <label className="f">Data<input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} /></label>
          <div><div className="fl" style={{ marginBottom: 5 }}>Tipo</div>
            <div className="seg"><button aria-pressed={type === 'chiuso'} onClick={() => setType('chiuso')}>Chiuso</button><button aria-pressed={type === 'orario'} onClick={() => setType('orario')}>Orario speciale</button></div>
          </div>
        </div>
        {type === 'orario' && (
          <div className="two">
            <label className="f">Dalle<select value={start} onChange={(e) => setStart(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="f">Alle<select value={end} onChange={(e) => setEnd(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>
        )}
        <label className="f">Nota<input type="text" value={note} maxLength={60} placeholder="Es. Chiusura per ferie" onChange={(e) => setNote(e.target.value)} /></label>
        <div><button className="btn primary" disabled={busy} onClick={add}><Icon name="plus" />Aggiungi</button></div>
      </div>
      <div className="side-list">
        {upcoming.length ? upcoming.map((c) => (
          <div className="item" key={c.id} style={{ alignItems: 'center' }}>
            <div style={{ flex: 1 }}><b>{fmtLong(c.date)} {pd(c.date).getFullYear()}</b><div className="small muted">{c.type === 'chiuso' ? 'Chiuso tutto il giorno' : `Aperto solo ${c.start}–${c.end}`}{c.note ? ' · ' + c.note : ''}</div></div>
            {confirm === c.id
              ? <><button className="btn sm danger solid" disabled={busy} onClick={() => remove(c.id)}>Rimuovi</button><button className="btn sm" onClick={() => setConfirm(null)}>No</button></>
              : <button className="btn sm ghost" onClick={() => setConfirm(c.id)}>Rimuovi</button>}
          </div>
        )) : <div className="empty small">Nessuna chiusura in programma.</div>}
      </div>
      {past.length > 0 && <div className="card-b"><p className="hint">Ci sono anche {past.length} chiusure passate, conservate nello storico.</p></div>}
    </>
  )
}

function Sconti() {
  const { boot } = useData()
  const { save, busy } = useSave()
  const initial = boot!.settings.discounts
  const [rules, setRules] = useState<DiscountRule[]>(() => structuredClone(initial))
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial)
  const set = (i: number, p: Partial<DiscountRule>) => setRules((l) => l.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const overlaps: string[] = []
  rules.forEach((a, i) => rules.slice(i + 1).forEach((b) => {
    if (a.min <= b.max && b.min <= a.max) overlaps.push(`“${a.text}” e “${b.text}” valgono entrambe per ${Math.max(a.min, b.min)}${Math.min(a.max, b.max) > Math.max(a.min, b.min) ? '–' + Math.min(a.max, b.max) : ''} persone`)
  }))
  const invalid = rules.some((r) => r.min < 1 || r.max < r.min || r.pct < 1 || r.pct > 90 || r.qty < 1)
  const num = (v: string) => Math.max(0, parseInt(v, 10) || 0)

  return (
    <>
      <div className="card-h"><h2>Sconti per numero di persone</h2>
        <button className="btn sm" onClick={() => setRules((l) => [...l, { id: 'n' + Date.now(), min: 2, max: 2, pct: 10, qty: 2, text: 'Sconto 10%' }])}><Icon name="plus" />Nuova regola</button></div>
      <div className="card-b">
        {overlaps.length > 0 && <div className="confirm" style={{ marginBottom: 6 }}><b>Regole sovrapposte</b>{overlaps.map((o) => <span key={o}>{o}.</span>)}<span>Conviene correggere i limiti.</span></div>}
        {rules.map((r, i) => (
          <div className="rule" key={r.id}>
            <label className="f">Da persone<input type="number" min={1} max={50} value={r.min} onChange={(e) => set(i, { min: num(e.target.value) })} /></label>
            <label className="f">A persone<input type="number" min={1} max={50} value={r.max} onChange={(e) => set(i, { max: num(e.target.value) })} /></label>
            <label className="f">Sconto %<input type="number" min={5} max={90} step={5} value={r.pct} onChange={(e) => set(i, { pct: num(e.target.value) })} /></label>
            <label className="f">Quantità per fascia<input type="number" min={1} max={50} value={r.qty} onChange={(e) => set(i, { qty: num(e.target.value) })} /></label>
            <label className="f">Testo mostrato<input type="text" maxLength={30} value={r.text} onChange={(e) => set(i, { text: e.target.value })} /></label>
            <button className="btn sm ghost" onClick={() => setRules((l) => l.filter((_, j) => j !== i))} aria-label="Elimina regola"><Icon name="close" /></button>
          </div>
        ))}
        {!rules.length && <p className="hint">Nessuno sconto attivo.</p>}
        {invalid && <div className="err" style={{ marginTop: 8 }}>Controlla i valori: “Da” non può superare “A”, lo sconto va da 1 a 90%.</div>}
        <p className="hint" style={{ marginTop: 12 }}>Lo sconto compare sulle fasce orarie del modulo del sito finché non si esaurisce la quantità per quella fascia.</p>
      </div>
      <SaveBar dirty={dirty} busy={busy || invalid} onReset={() => setRules(structuredClone(initial))} onSave={() => save({ discounts: rules }, 'Sconti salvati')} />
    </>
  )
}

function Regole() {
  const { boot } = useData()
  const { save, busy } = useSave()
  const s = boot!.settings
  const initial = { duration: s.duration, interval: s.interval, maxOnline: s.maxOnline, defaultStatus: s.defaultStatus, occasions: s.occasions }
  const [d, setD] = useState(() => structuredClone(initial))
  const [newOcc, setNewOcc] = useState('')
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)

  return (
    <>
      <div className="card-h"><h2>Regole prenotazione</h2></div>
      <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        <div className="two">
          <label className="f">Durata di una prenotazione
            <select value={d.duration} onChange={(e) => setD({ ...d, duration: +e.target.value })}>{[45, 60, 75, 90, 105, 120, 150, 180].map((v) => <option key={v} value={v}>{v} minuti</option>)}</select>
          </label>
          <label className="f">Intervallo tra le fasce
            <select value={d.interval} onChange={(e) => setD({ ...d, interval: +e.target.value })}>{[15, 30, 60].map((v) => <option key={v} value={v}>{v} minuti</option>)}</select>
          </label>
        </div>
        <div className="two">
          <label className="f">Massimo persone online<input type="number" min={1} max={100} value={d.maxOnline} onChange={(e) => setD({ ...d, maxOnline: Math.max(1, +e.target.value || 1) })} /></label>
          <div><div className="fl" style={{ marginBottom: 5 }}>Le prenotazioni dal sito arrivano</div>
            <div className="seg">
              <button aria-pressed={d.defaultStatus === 'attesa'} onClick={() => setD({ ...d, defaultStatus: 'attesa' })}>Da confermare</button>
              <button aria-pressed={d.defaultStatus === 'confermata'} onClick={() => setD({ ...d, defaultStatus: 'confermata' })}>Già confermate</button>
            </div>
          </div>
        </div>
        <div>
          <div className="fl" style={{ marginBottom: 6 }}>Occasioni</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
            {d.occasions.map((o, i) => (
              <input key={i} type="text" value={o} maxLength={30} aria-label={`Occasione ${i + 1}`} onChange={(e) => setD({ ...d, occasions: d.occasions.map((x, j) => (j === i ? e.target.value : x)) })} />
            ))}
          </div>
          <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap', maxWidth: 360 }}>
            <input type="text" placeholder="Nuova occasione" maxLength={30} value={newOcc} onChange={(e) => setNewOcc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newOcc.trim()) { setD({ ...d, occasions: [...d.occasions, newOcc.trim()] }); setNewOcc('') } }} />
            <button className="btn sm" disabled={!newOcc.trim()} onClick={() => { setD({ ...d, occasions: [...d.occasions, newOcc.trim()] }); setNewOcc('') }}>Aggiungi</button>
          </div>
          <p className="hint" style={{ marginTop: 6 }}>Le occasioni già usate nelle prenotazioni si possono rinominare ma non eliminare.</p>
        </div>
        <p className="hint">Oltre il massimo di persone il modulo invita a chiamare il ristorante.</p>
      </div>
      <SaveBar dirty={dirty} busy={busy || d.occasions.some((o) => !o.trim())} onReset={() => setD(structuredClone(initial))} onSave={() => save(d, 'Regole salvate')} />
    </>
  )
}
