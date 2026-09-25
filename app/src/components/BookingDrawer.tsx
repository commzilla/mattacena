import { useEffect, useMemo, useRef, useState } from 'react'
import { busyOn, closureOf, discountFor, slotsOf, suggestTables } from '../domain/rules'
import type { BookingInput, Source, Status } from '../domain/types'
import { SOURCE_LABEL, STATUS_LABEL } from '../domain/types'
import { nowMin, t2m, today } from '../lib/date'
import { useAuth } from '../state/auth'
import { useData } from '../state/data'
import { canManage } from '../state/permissions'
import { useToast } from '../state/toast'
import { Icon, Pill } from './ui'

export interface DrawerRequest { id: string | null; table?: string; time?: string }

type Draft = BookingInput & { id: string | null }

export function BookingDrawer({ req, onClose }: { req: DrawerRequest; onClose: () => void }) {
  const { boot, bookings, date, save, remove } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const nameRef = useRef<HTMLInputElement>(null)
  const settings = boot!.settings
  const tables = boot!.tables

  const [d, setD] = useState<Draft>(() => {
    const existing = req.id ? bookings.find((b) => b.id === req.id) : undefined
    if (existing) return { ...existing, tables: [...existing.tables] }
    const sl = slotsOf(settings, date).map((s) => s.t)
    const time = req.time || (date === today() ? sl.find((t) => t2m(t) > nowMin()) : sl.find((t) => t >= '20:00')) || sl[0] || ''
    return { id: null, date, time, guests: 2, name: '', phone: '', email: '', occasion: settings.occasions[0] || 'Casual', notes: '', source: 'telefono', status: 'confermata', tables: req.table ? [req.table] : [], discount: '' }
  })
  const [err, setErr] = useState<{ name?: string; time?: string }>({})
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const isNew = d.id === null

  useEffect(() => {
    if (isNew) nameRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [isNew, onClose])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const slots = slotsOf(settings, d.date)
  const closure = closureOf(settings, d.date)
  const freeFor = (time: string) => suggestTables(tables, bookings, settings.duration, d.date, time, d.guests, d.id).length > 0
  const seats = d.tables.reduce((n, id) => n + (tables.find((t) => t.id === id)?.seats || 0), 0)
  const disc = useMemo(() => (d.time ? discountFor(settings, bookings, d.date, d.time, d.guests, d.id) : null), [settings, bookings, d.date, d.time, d.guests, d.id])

  // Drop tables that are no longer free after changing day or time.
  const dropBusy = (next: Draft) => ({ ...next, tables: next.tables.filter((id) => !busyOn(bookings, settings.duration, id, next.date, next.time, next.id)) })

  async function submit() {
    const e: typeof err = {}
    if (!d.name.trim()) e.name = 'Scrivi il nome del cliente.'
    if (!d.time) e.time = 'Scegli un orario.'
    setErr(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const { id, ...input } = d
    const saved = await save(id, { ...input, name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), notes: d.notes.trim() })
    setBusy(false)
    if (saved) {
      toast(isNew ? `Prenotazione di ${saved.name} salvata` : 'Modifiche salvate')
      onClose()
    }
  }

  async function del() {
    if (!d.id) return
    setBusy(true)
    if (await remove(d.id)) { toast(`Prenotazione di ${d.name} eliminata`); onClose() }
    setBusy(false)
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title">
        <div className="dh">
          <h2 id="dr-title">{isNew ? 'Nuova prenotazione' : d.name || 'Prenotazione'}</h2>
          {!isNew && <Pill status={d.status} />}
          <button className="btn icon ghost" onClick={onClose} aria-label="Chiudi"><Icon name="close" /></button>
        </div>
        <div className="db">
          <div className="two">
            <label className="f">Giorno<input type="date" id="dr-date" value={d.date} onChange={(e) => e.target.value && setD((x) => dropBusy({ ...x, date: e.target.value, time: slotsOf(settings, e.target.value).some((s) => s.t === x.time) ? x.time : '' }))} /></label>
            <div>
              <div className="fl" style={{ marginBottom: 5 }}>Persone</div>
              <div className="stepper">
                <button type="button" onClick={() => d.guests > 1 && set('guests', d.guests - 1)} aria-label="Meno persone">−</button>
                <output className="mono">{d.guests}</output>
                <button type="button" onClick={() => d.guests < 60 && set('guests', d.guests + 1)} aria-label="Più persone">+</button>
              </div>
            </div>
          </div>

          <div>
            <div className="fl" style={{ marginBottom: 6 }}>Orario {closure && <span className="tag red">{closure.note}</span>}</div>
            {slots.length ? (
              <>
                <div className="tm-grid">
                  {slots.map((s) => {
                    const full = !freeFor(s.t)
                    return (
                      <button type="button" key={s.t} aria-pressed={d.time === s.t} className={full ? 'full' : ''} title={full ? `Nessun tavolo libero per ${d.guests} persone` : undefined}
                        onClick={() => { setD((x) => dropBusy({ ...x, time: s.t })); setErr((x) => ({ ...x, time: undefined })) }}>{s.t}</button>
                    )
                  })}
                </div>
                <p className="hint" style={{ marginTop: 6 }}>Gli orari tratteggiati non hanno tavoli liberi: puoi prenotare lo stesso e sistemare in sala.</p>
              </>
            ) : <p className="err">Il ristorante è chiuso questo giorno.</p>}
            {err.time && <div className="err">{err.time}</div>}
          </div>

          <label className="f">Nome e cognome<input ref={nameRef} type="text" id="dr-name" value={d.name} autoComplete="off" onChange={(e) => set('name', e.target.value)} /></label>
          {err.name && <div className="err" style={{ marginTop: -10 }}>{err.name}</div>}
          <div className="two">
            <label className="f">Telefono<input type="tel" id="dr-phone" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label className="f">Email<input type="email" id="dr-email" value={d.email} onChange={(e) => set('email', e.target.value)} /></label>
          </div>
          <div className="two">
            <label className="f">Occasione
              <select id="dr-occ" value={d.occasion} onChange={(e) => set('occasion', e.target.value)}>
                {settings.occasions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <div>
              <div className="fl" style={{ marginBottom: 5 }}>Origine</div>
              <div className="seg">
                {(Object.keys(SOURCE_LABEL) as Source[]).map((k) => <button type="button" key={k} aria-pressed={d.source === k} onClick={() => set('source', k)}>{SOURCE_LABEL[k]}</button>)}
              </div>
            </div>
          </div>
          <label className="f">Note<textarea id="dr-notes" value={d.notes} placeholder="Allergie, seggiolone, richieste…" onChange={(e) => set('notes', e.target.value)} /></label>
          <div>
            <div className="fl" style={{ marginBottom: 5 }}>Stato</div>
            <div className="chips">
              {(Object.keys(STATUS_LABEL) as Status[]).map((k) => <button type="button" key={k} className="chip" aria-pressed={d.status === k} onClick={() => set('status', k)}>{STATUS_LABEL[k]}</button>)}
            </div>
          </div>

          <div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="fl">Tavoli {d.tables.length > 0 && `· ${seats} posti per ${d.guests} persone`}</span>
              <button type="button" className="btn sm" disabled={!d.time} onClick={() => {
                const s = suggestTables(tables, bookings, settings.duration, d.date, d.time, d.guests, d.id)
                if (s.length) { set('tables', s); toast('Tavolo scelto: ' + s.map((id) => tables.find((t) => t.id === id)?.name).join(' + ')) } else toast('Nessun tavolo libero a quell’ora')
              }}>Scegli in automatico</button>
            </div>
            {d.tables.length > 0 && seats < d.guests && <div className="err" style={{ marginTop: 6 }}>Mancano {d.guests - seats} posti: aggiungi un tavolo.</div>}
            {boot!.areas.map((a) => (
              <div key={a.id}>
                <div className="small muted" style={{ fontWeight: 700, margin: '6px 0 4px' }}>{a.name}</div>
                <div className="tchips">
                  {tables.filter((t) => t.area === a.id).map((t) => {
                    const on = d.tables.includes(t.id)
                    const busyBy = d.time ? busyOn(bookings, settings.duration, t.id, d.date, d.time, d.id) : undefined
                    return (
                      <button type="button" key={t.id} className="tchip" aria-pressed={on} disabled={!!busyBy && !on} title={busyBy ? `Occupato da ${busyBy.name} alle ${busyBy.time}` : undefined}
                        onClick={() => set('tables', on ? d.tables.filter((x) => x !== t.id) : [...d.tables, t.id])}>{t.name}<small>{t.seats}p</small></button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {(d.discount || disc) && <div className="tag" style={{ alignSelf: 'flex-start' }}>{d.discount || `Sconto disponibile: ${disc!.text}`}</div>}

          {confirmDel && (
            <div className="confirm">
              Eliminare definitivamente questa prenotazione? Se il cliente ha disdetto, meglio impostare lo stato su Cancellata.
              <div className="row">
                <button className="btn sm danger solid" onClick={del} disabled={busy}>Elimina</button>
                <button className="btn sm" onClick={() => setConfirmDel(false)}>No, tienila</button>
              </div>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn primary" onClick={submit} disabled={busy}>{isNew ? 'Salva prenotazione' : 'Salva modifiche'}</button>
          <button className="btn" onClick={onClose}>Annulla</button>
          {!isNew && user && canManage(user.role) && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDel(true)}>Elimina</button>}
        </div>
      </div>
    </>
  )
}

