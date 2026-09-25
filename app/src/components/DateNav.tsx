import { addD, today } from '../lib/date'
import { useData } from '../state/data'
import { Icon } from './ui'

export function DateNav() {
  const { date, setDate } = useData()
  return (
    <div className="row">
      <button className="btn icon" onClick={() => setDate(addD(date, -1))} aria-label="Giorno precedente"><Icon name="left" /></button>
      <input type="date" id="date-pick" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 'auto' }} />
      <button className="btn icon" onClick={() => setDate(addD(date, 1))} aria-label="Giorno successivo"><Icon name="right" /></button>
      {date !== today() && <button className="btn" onClick={() => setDate(today())}>Oggi</button>}
    </div>
  )
}
