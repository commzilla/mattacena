import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { api } from '../api'
import { DateNav } from '../components/DateNav'
import { Icon, Pill } from '../components/ui'
import { bbox, chairs, freeSpot, GRID, H, overlaps, snap, tableSize, W } from '../domain/floor'
import { busyOn, serviceOf, slotsOf } from '../domain/rules'
import type { Booking, Table } from '../domain/types'
import { isLive } from '../domain/types'
import { fmtShort, nowMin, t2m, today } from '../lib/date'
import { useAuth } from '../state/auth'
import { useData } from '../state/data'
import { useOpenBooking } from '../state/drawer'
import { canManage } from '../state/permissions'
import { useToast } from '../state/toast'

type TState = 'free' | 'soon' | 'booked' | 'pending' | 'seated'

export function Sala() {
  const { boot, bookings, date, patch, setStatus, mergeBoot, attempt, refresh } = useData()
  const { user } = useAuth()
  const open = useOpenBooking()
  const toast = useToast()
  const manager = !!user && canManage(user.role)

  const [mode, setMode] = useState<'servizio' | 'modifica'>('servizio')
  const [area, setArea] = useState<string>('')
  const [time, setTime] = useState<string>('')
  const [selTable, setSelTable] = useState<string | null>(null)
  const [pick, setPick] = useState<string | null>(null) // booking waiting to be assigned
  const [zoom, setZoom] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragInfo = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const cardDrag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null)

  const settings = boot?.settings
  const areaId = boot && boot.areas.some((a) => a.id === area) ? area : boot?.areas[0]?.id || ''
  const slots = useMemo(() => (settings ? slotsOf(settings, date).map((s) => s.t) : []), [settings, date])

  // Default time: the service in progress or coming up.
  useEffect(() => {
    if (!slots.length) return
    if (time && slots.includes(time)) return
    if (date === today()) {
      const n = nowMin(), dur = settings?.duration || 60
      setTime(slots.find((t) => t2m(t) + dur > n) || slots[slots.length - 1])
    } else setTime(slots.find((t) => t >= '20:00') || slots[0])
  }, [slots, date, time, settings])

  // Dragging a booking card from the side panel onto a table (service mode).
  const assignRef = useRef<(bid: string, tid: string) => void>(() => {})
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const c = cardDrag.current
      if (!c) return
      if (!c.moved && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6) return
      c.moved = true
      setGhost({ id: c.id, x: e.clientX, y: e.clientY })
      setPick(c.id)
    }
    const up = (e: PointerEvent) => {
      const c = cardDrag.current
      cardDrag.current = null
      setGhost(null)
      if (!c) return
      if (!c.moved) { setPick((p) => (p === c.id ? null : c.id)); return }
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-tid]') as HTMLElement | null
      if (el?.dataset.tid) assignRef.current(c.id, el.dataset.tid)
      else setPick(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  if (!boot || !settings) return <div className="loading">Caricamento…</div>
  const edit = mode === 'modifica'
  const dur = settings.duration
  const areaName = (id: string) => boot.areas.find((a) => a.id === id)?.name || ''
  const tname = (id: string) => boot.tables.find((t) => t.id === id)?.name || '?'
  const list = boot.tables.filter((t) => t.area === areaId).map((t) => (drag && drag.id === t.id ? { ...t, x: drag.x, y: drag.y } : t))
  const bad = edit ? overlaps(list) : new Set<string>()
  const picked = pick ? bookings.find((b) => b.id === pick) : undefined
  const tm = time || '20:00'

  function stateOf(t: Table): { st: TState; b?: Booking } {
    const m = t2m(tm)
    const cur = bookings.find((b) => b.date === date && isLive(b) && b.tables.includes(t.id) && t2m(b.time) <= m && m < t2m(b.time) + dur)
    if (cur) return { st: cur.status === 'arrivata' ? 'seated' : cur.status === 'attesa' ? 'pending' : 'booked', b: cur }
    const soon = bookings.find((b) => b.date === date && isLive(b) && b.tables.includes(t.id) && t2m(b.time) > m && t2m(b.time) <= m + 60)
    return soon ? { st: 'soon', b: soon } : { st: 'free' }
  }

  async function assign(bid: string, tid: string) {
    const b = bookings.find((x) => x.id === bid), t = boot!.tables.find((x) => x.id === tid)
    setPick(null)
    if (!b || !t) return
    if (b.tables.includes(tid)) return toast(`${b.name} è già al tavolo ${t.name}`)
    const c = busyOn(bookings, dur, tid, b.date, b.time, b.id)
    if (c) return toast(`Il tavolo ${t.name} è occupato alle ${c.time} da ${c.name}`)
    const saved = await patch(bid, { tables: [...b.tables, tid] })
    if (!saved) return
    const seats = saved.tables.reduce((n, id) => n + (boot!.tables.find((x) => x.id === id)?.seats || 0), 0)
    toast(seats < saved.guests ? `${saved.name} → ${t.name}. Mancano ${saved.guests - seats} posti: aggiungi un tavolo.` : `${saved.name} → tavolo ${saved.tables.map(tname).join(' + ')}`)
  }

  assignRef.current = assign

  /* ---------- pointer handling ---------- */
  const svgPoint = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!, p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    return p.matrixTransform(svg.getScreenCTM()!.inverse())
  }

  function onTableDown(e: RPointerEvent, t: Table) {
    if (!edit) return
    const p = svgPoint(e)
    dragInfo.current = { id: t.id, dx: p.x - t.x, dy: p.y - t.y, moved: false }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setSelTable(t.id)
    setConfirm(null)
  }
  function onTableMove(e: RPointerEvent) {
    const d = dragInfo.current
    if (!d) return
    const t = boot!.tables.find((x) => x.id === d.id)!
    const b = bbox({ ...t, x: 0, y: 0 }), p = svgPoint(e)
    const x = Math.min(Math.max(snap(p.x - d.dx), 36 - b.x1), W - 36 - b.x2)
    const y = Math.min(Math.max(snap(p.y - d.dy), 36 - b.y1), H - 36 - b.y2)
    if (!drag || drag.x !== x || drag.y !== y) {
      d.moved = d.moved || x !== t.x || y !== t.y
      setDrag({ id: d.id, x, y })
    }
  }
  async function onTableUp(t: Table) {
    if (!edit) {
      if (cardDrag.current) return // a booking card is being dropped here: the window handler assigns it
      if (pick) assign(pick, t.id)
      else setSelTable((s) => (s === t.id ? null : t.id))
      return
    }
    const d = dragInfo.current
    dragInfo.current = null
    if (!d || !d.moved || !drag) { setDrag(null); return }
    const moved = { ...t, x: drag.x, y: drag.y }
    mergeBoot({ tables: boot!.tables.map((x) => (x.id === t.id ? moved : x)) })
    setDrag(null)
    const r = await attempt(api.saveLayout([{ id: t.id, x: moved.x, y: moved.y, shape: moved.shape, rot: moved.rot }]))
    if (r) mergeBoot({ tables: r.tables })
  }

  /* ---------- floor-plan edits ---------- */
  const sel = selTable ? boot.tables.find((t) => t.id === selTable && t.area === areaId) : undefined

  async function addTable(shape: Table['shape']) {
    const seats = shape === 'round' ? 2 : shape === 'square' ? 4 : 6
    const nums = boot!.tables.map((t) => parseInt(t.name.replace(/\D/g, ''), 10)).filter((n) => n > 0 && n < 100)
    let n = 1
    while (nums.includes(n)) n++
    const pos = freeSpot(list, { shape, seats, rot: 0 })
    const r = await attempt(api.createTable({ area: areaId, name: '#' + n, seats, shape, rot: 0, ...pos }))
    if (r) { mergeBoot({ tables: r.tables }); setSelTable(r.id); toast(`Tavolo #${n} aggiunto`) }
  }
  async function updateSel(p: Partial<Table>) {
    if (!sel) return
    mergeBoot({ tables: boot!.tables.map((t) => (t.id === sel.id ? { ...t, ...p } : t)) })
    const r = await attempt(api.updateTable(sel.id, p))
    if (r) mergeBoot({ tables: r.tables })
  }
  async function deleteSel() {
    if (!sel) return
    const r = await attempt(api.deleteTable(sel.id))
    if (r) { mergeBoot({ tables: r.tables }); setSelTable(null); setConfirm(null); toast(`Tavolo ${sel.name} eliminato`); refresh() }
  }
  async function addArea() {
    let k = boot!.areas.length + 1, name: string
    do name = 'Nuova sala ' + k++
    while (boot!.areas.some((a) => a.name === name))
    const r = await attempt(api.createArea(name))
    if (r) { mergeBoot({ areas: r.areas }); setArea(r.id); setSelTable(null) }
  }
  async function renameArea(name: string) {
    if (!name.trim() || name === areaName(areaId)) return
    const r = await attempt(api.updateArea(areaId, name.trim()))
    if (r) mergeBoot({ areas: r.areas })
  }
  async function deleteArea() {
    const nm = areaName(areaId)
    const r = await attempt(api.deleteArea(areaId))
    if (r) { mergeBoot({ areas: r.areas }); setArea(r.areas[0]?.id || ''); setConfirm(null); toast(`Sala ${nm} eliminata`) }
  }

  /* ---------- render ---------- */
  const svc = slots.includes(tm) ? serviceOf(tm) : null
  const unassigned = bookings.filter((b) => b.date === date && isLive(b) && !b.tables.length && b.status !== 'arrivata' && (!svc || serviceOf(b.time) === svc))
  const states = list.map((t) => stateOf(t).st)

  return (
    <>
      <header className="top">
        <h1>Sala</h1>
        {!edit && <DateNav />}
        <span className="spacer" />
        {manager && (
          <div className="seg" role="group" aria-label="Modalità">
            <button aria-pressed={!edit} onClick={() => { setMode('servizio'); setSelTable(null); setConfirm(null) }}>Servizio</button>
            <button aria-pressed={edit} onClick={() => { setMode('modifica'); setSelTable(null); setPick(null) }}>Modifica pianta</button>
          </div>
        )}
        {!edit && <button className="btn primary new-top" onClick={() => open({ id: null })}><Icon name="plus" />Nuova prenotazione</button>}
      </header>
      <main className="view">
        <nav className="tabs" role="tablist" aria-label="Sale">
          {boot.areas.map((a) => {
            const ts = boot.tables.filter((t) => t.area === a.id)
            return (
              <button key={a.id} className="tab" role="tab" aria-selected={a.id === areaId} onClick={() => { setArea(a.id); setSelTable(null); setConfirm(null) }}>
                {a.name}<span className="n">{ts.length} · {ts.reduce((n, t) => n + t.seats, 0)}p</span>
              </button>
            )
          })}
          {edit && <button className="tab add" onClick={addArea}>+ Nuova sala</button>}
        </nav>

        <div className="sala">
          <section className={'card map-card' + (edit ? ' edit' : '')}>
            <div className="map-tools">
              <button className="btn sm map-zoom" aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>{zoom ? 'Vedi tutta la sala' : 'Ingrandisci'}</button>
              {edit ? (
                <>
                  <span className="fl">Aggiungi</span>
                  <button className="btn sm" onClick={() => addTable('round')}>Rotondo</button>
                  <button className="btn sm" onClick={() => addTable('square')}>Quadrato</button>
                  <button className="btn sm" onClick={() => addTable('rect')}>Rettangolare</button>
                </>
              ) : (
                <>
                  <label className="fl" htmlFor="sala-time">Situazione alle</label>
                  <select id="sala-time" style={{ width: 'auto', minHeight: 32, padding: '4px 8px' }} value={tm} onChange={(e) => setTime(e.target.value)}>
                    {slots.length ? slots.map((t) => <option key={t}>{t}</option>) : <option>Chiuso</option>}
                  </select>
                  {picked && <><span className="tag red">Tocca un tavolo per assegnare {picked.name}</span><button className="btn sm ghost" onClick={() => setPick(null)}>Annulla</button></>}
                </>
              )}
            </div>
            <div className={'map-wrap' + (zoom ? ' zoom' : '')}>
              <svg ref={svgRef} id="map" viewBox={`0 0 ${W} ${H}`} aria-label={'Pianta di ' + areaName(areaId)}
                onPointerDown={(e) => { if ((e.target as Element).getAttribute('data-bg')) { setSelTable(null); setPick(null); setConfirm(null) } }}>
                <defs>
                  <pattern id="gr" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><path d={`M${GRID} 0H0V${GRID}`} fill="none" stroke="var(--grid)" /></pattern>
                  <pattern id="gr4" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse"><rect width={GRID * 4} height={GRID * 4} fill="url(#gr)" /><path d={`M${GRID * 4} 0H0V${GRID * 4}`} fill="none" stroke="var(--grid)" strokeWidth="2" /></pattern>
                </defs>
                <rect width={W} height={H} fill="url(#gr4)" data-bg="1" />
                <rect x="30" y="30" width={W - 60} height={H - 60} fill="none" stroke="var(--wall)" strokeWidth="6" rx="4" pointerEvents="none" />
                <text x="46" y={H - 46} fontFamily="Montserrat,sans-serif" fontWeight="800" fontSize="26" letterSpacing="3" fill="var(--muted)" opacity=".45" pointerEvents="none">{areaName(areaId).toUpperCase()}</text>
                {list.map((t) => {
                  const s = tableSize(t)
                  let cls = 'tbl', sub = t.seats + ' p.'
                  if (edit) {
                    if (bad.has(t.id)) cls += ' overlap'
                    if (selTable === t.id) cls += ' sel'
                  } else {
                    const st = stateOf(t)
                    if (st.st !== 'free') cls += ' st-' + st.st
                    if (st.b && st.st !== 'soon') sub = st.b.name.split(' ').slice(-1)[0].slice(0, 9) + ' ' + st.b.guests
                    else if (st.st === 'soon' && st.b) sub = 'alle ' + st.b.time
                    if (selTable === t.id) cls += ' sel'
                    if (picked) cls += !busyOn(bookings, dur, t.id, picked.date, picked.time, picked.id) && !picked.tables.includes(t.id) ? ' fit' : ' nofit'
                  }
                  return (
                    <g key={t.id} className={cls} data-tid={t.id} transform={`translate(${t.x} ${t.y})`} tabIndex={0} role="button" aria-label={`Tavolo ${t.name}, ${t.seats} posti`}
                      onPointerDown={(e) => onTableDown(e, t)} onPointerMove={onTableMove} onPointerUp={() => onTableUp(t)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTableUp(t) } }}>
                      <g transform={`rotate(${t.rot})`}>
                        {chairs(t).map((c, i) => <rect key={i} className="chair" x="-15" y="-7" width="30" height="14" rx="5" transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${c.rot.toFixed(1)})`} />)}
                        {t.shape === 'round' ? <circle className="top" r={s.r} fill="var(--tbl)" /> : <rect className="top" x={-s.w / 2} y={-s.h / 2} width={s.w} height={s.h} rx={t.shape === 'square' ? 7 : 9} fill="var(--tbl)" />}
                      </g>
                      <text className="nm" y="-7">{t.name}</text>
                      <text className="sub" y="11">{sub}</text>
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="legend">
              {edit ? (
                <><span><i className="sw" style={{ borderColor: 'var(--red)', borderStyle: 'dashed' }} />Tavoli troppo vicini</span><span style={{ marginLeft: 'auto' }}>1 quadretto = 50 cm · trascina per spostare</span></>
              ) : (
                <>
                  <span><i className="sw" style={{ borderColor: 'var(--ink)', background: 'var(--tbl)' }} />Libero</span>
                  <span><i className="sw" style={{ borderColor: 'var(--olive)', background: 'var(--booked)' }} />Prenotato</span>
                  <span><i className="sw" style={{ borderColor: 'var(--copper)', borderStyle: 'dashed', background: 'var(--booked)' }} />Da confermare</span>
                  <span><i className="sw" style={{ borderColor: 'var(--seated)', background: 'var(--seated)' }} />Seduti</span>
                  <span><i className="sw" style={{ borderColor: 'var(--olive)', borderStyle: 'dotted' }} />In arrivo entro 1 ora</span>
                </>
              )}
            </div>
          </section>

          <aside className="card">
            {edit ? (
              sel ? (
                <div className="panel">
                  <div><div className="eyebrow">Tavolo selezionato</div><h3>{sel.name}</h3>{bad.has(sel.id) && <div className="err" style={{ marginTop: 4 }}>Troppo vicino a un altro tavolo</div>}</div>
                  <label className="f">Nome<input type="text" key={'n' + sel.id} defaultValue={sel.name} maxLength={20} onBlur={(e) => e.target.value.trim() && e.target.value !== sel.name && updateSel({ name: e.target.value.trim() })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></label>
                  <div><div className="fl" style={{ marginBottom: 6 }}>Posti</div>
                    <div className="stepper">
                      <button onClick={() => sel.seats > 1 && updateSel({ seats: sel.seats - 1 })} aria-label="Meno posti">−</button>
                      <output>{sel.seats}</output>
                      <button onClick={() => sel.seats < 30 && updateSel({ seats: sel.seats + 1 })} aria-label="Più posti">+</button>
                    </div>
                  </div>
                  <div><div className="fl" style={{ marginBottom: 6 }}>Forma</div>
                    <div className="seg">{([['round', 'Rotondo'], ['square', 'Quadrato'], ['rect', 'Rettang.']] as [Table['shape'], string][]).map(([k, l]) => <button key={k} aria-pressed={sel.shape === k} onClick={() => updateSel({ shape: k, ...(k === 'rect' && sel.seats < 4 ? { seats: 4 } : {}) })}>{l}</button>)}</div>
                  </div>
                  <div><div className="fl" style={{ marginBottom: 6 }}>Rotazione</div>
                    <div className="seg">{[0, 45, 90, 135].map((r) => <button key={r} aria-pressed={sel.rot === r} onClick={() => updateSel({ rot: r })}>{r}°</button>)}</div>
                  </div>
                  <label className="f">Sala
                    <select value={sel.area} onChange={(e) => { const pos = freeSpot(boot.tables.filter((t) => t.area === e.target.value), sel); updateSel({ area: e.target.value, ...pos }); setArea(e.target.value) }}>
                      {boot.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                  <div className="row">
                    <button className="btn sm" onClick={() => setSelTable(null)}>Chiudi</button>
                    <button className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => setConfirm('table')}>Elimina</button>
                  </div>
                  {confirm === 'table' && (
                    <div className="confirm">Eliminare il tavolo <b>{sel.name}</b>? Le prenotazioni future perdono questo tavolo; lo storico resta.
                      <div className="row"><button className="btn sm danger solid" onClick={deleteSel}>Elimina tavolo</button><button className="btn sm" onClick={() => setConfirm(null)}>No, tienilo</button></div>
                    </div>
                  )}
                  <p className="hint">Le modifiche si salvano subito e valgono anche per il modulo di prenotazione del sito.</p>
                </div>
              ) : (
                <div className="panel">
                  <div><div className="eyebrow">Sala</div><h3>{areaName(areaId)}</h3></div>
                  <label className="f">Nome della sala<input type="text" key={'a' + areaId} defaultValue={areaName(areaId)} maxLength={40} onBlur={(e) => renameArea(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></label>
                  <div className="stats">
                    <div className="stat"><b>{list.length}</b><small>tavoli</small></div>
                    <div className="stat"><b>{list.reduce((n, t) => n + t.seats, 0)}</b><small>posti</small></div>
                    <div className="stat"><b>{boot.tables.reduce((n, t) => n + t.seats, 0)}</b><small>posti totali</small></div>
                  </div>
                  {bad.size > 0 && <div className="err">{bad.size} tavoli sono troppo vicini: lascia spazio per passare.</div>}
                  <p className="hint">Trascina i tavoli per disporli come in sala. Tocca un tavolo per cambiare nome, posti, forma e rotazione.</p>
                  <div className="row"><button className="btn sm danger" disabled={list.length > 0 || boot.areas.length < 2} onClick={() => setConfirm('area')}>Elimina sala</button></div>
                  {list.length > 0 && <p className="hint">Per eliminare la sala, prima sposta o elimina i suoi tavoli.</p>}
                  {confirm === 'area' && (
                    <div className="confirm">Eliminare la sala {areaName(areaId)}?
                      <div className="row"><button className="btn sm danger solid" onClick={deleteArea}>Elimina sala</button><button className="btn sm" onClick={() => setConfirm(null)}>No</button></div>
                    </div>
                  )}
                </div>
              )
            ) : selTable && boot.tables.some((t) => t.id === selTable && t.area === areaId) ? (
              <TablePanel tableId={selTable} onClose={() => setSelTable(null)} time={tm}
                onSeat={(b) => setStatus(b.id, 'arrivata').then((r) => r && toast(`${b.name}: arrivati`))}
                onUnassign={(b) => patch(b.id, { tables: b.tables.filter((x) => x !== selTable) }).then((r) => r && toast(`${b.name} tolto dal tavolo ${tname(selTable)}`))} />
            ) : (
              <div className="panel">
                <div><div className="eyebrow">{date === today() ? 'Oggi' : fmtShort(date)} alle {tm}</div><h3>{areaName(areaId)}</h3></div>
                <div className="stats">
                  <div className="stat"><b>{states.filter((s) => s === 'free' || s === 'soon').length}</b><small>liberi</small></div>
                  <div className="stat"><b>{states.filter((s) => s === 'booked' || s === 'pending').length}</b><small>prenotati</small></div>
                  <div className="stat"><b>{states.filter((s) => s === 'seated').length}</b><small>seduti</small></div>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="fl">Da assegnare{svc ? ' · ' + svc : ''}</span><span className="mono muted">{unassigned.length}</span></div>
                {unassigned.length ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {unassigned.map((b) => (
                        <div key={b.id} className="dcard" role="button" tabIndex={0} aria-pressed={pick === b.id}
                          onPointerDown={(e) => { if (e.button === 0) cardDrag.current = { id: b.id, x: e.clientX, y: e.clientY, moved: false } }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick((p) => (p === b.id ? null : b.id)) } }}>
                          <span className="t">{b.time}</span>
                          <div style={{ flex: 1, minWidth: 0 }}><b>{b.name}</b><div className="small muted">{b.guests} persone{b.notes ? ' · ' + b.notes : ''}</div></div>
                          {b.status === 'attesa' && <Pill status="attesa" />}
                        </div>
                      ))}
                    </div>
                    <p className="hint">Trascina una prenotazione su un tavolo, oppure toccala e poi tocca il tavolo. I tavoli liberi si evidenziano in verde.</p>
                  </>
                ) : <p className="hint">Tutte le prenotazioni di questo servizio hanno un tavolo.</p>}
                <p className="hint">Tocca un tavolo per vedere le sue prenotazioni della giornata.</p>
              </div>
            )}
          </aside>
        </div>
      </main>
      {ghost && (() => { const b = bookings.find((x) => x.id === ghost.id); return b ? <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{b.time} · {b.name} · {b.guests} p.</div> : null })()}
    </>
  )
}

function TablePanel({ tableId, time, onClose, onSeat, onUnassign }: { tableId: string; time: string; onClose: () => void; onSeat: (b: Booking) => void; onUnassign: (b: Booking) => void }) {
  const { boot, bookings, date } = useData()
  const open = useOpenBooking()
  const t = boot!.tables.find((x) => x.id === tableId)!
  const tname = (id: string) => boot!.tables.find((x) => x.id === id)?.name || '?'
  const day = bookings.filter((b) => b.date === date && b.tables.includes(t.id) && b.status !== 'cancellata').sort((a, b) => a.time.localeCompare(b.time))
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="eyebrow">{boot!.areas.find((a) => a.id === t.area)?.name} · {t.seats} posti</div><h3>Tavolo {t.name}</h3></div>
        <button className="btn icon ghost" onClick={onClose} aria-label="Chiudi"><Icon name="close" /></button>
      </div>
      <div className="fl">Prenotazioni di {date === today() ? 'oggi' : fmtShort(date)}</div>
      {day.length ? day.map((b) => (
        <div key={b.id}>
          <div className="dcard" style={{ cursor: 'pointer' }} onClick={() => open({ id: b.id })}>
            <span className="t">{b.time}</span>
            <div style={{ flex: 1, minWidth: 0 }}><b>{b.name}</b><div className="small muted">{b.guests} persone{b.tables.length > 1 ? ' · con ' + b.tables.filter((x) => x !== t.id).map(tname).join(', ') : ''}</div></div>
            <Pill status={b.status} />
          </div>
          <div className="row" style={{ margin: '6px 0 4px' }}>
            {b.status === 'confermata' && <button className="btn sm" onClick={() => onSeat(b)}>Arrivati</button>}
            <button className="btn sm ghost" onClick={() => onUnassign(b)}>Togli dal tavolo</button>
          </div>
        </div>
      )) : <p className="hint">Nessuna prenotazione su questo tavolo.</p>}
      <button className="btn" onClick={() => open({ id: null, table: t.id, time })}><Icon name="plus" />Prenota questo tavolo alle {time}</button>
    </div>
  )
}
