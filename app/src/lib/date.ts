export const pad = (n: number) => String(n).padStart(2, '0')
export const t2m = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const m2t = (m: number) => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60)
export const ymd = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
export const pd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addD = (s: string, n: number) => {
  const d = pd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}
/** Monday = 0 … Sunday = 6 */
export const dow = (s: string) => (pd(s).getDay() + 6) % 7

export const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
export const DAYS3 = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
export const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

export const fmtLong = (s: string) => {
  const d = pd(s)
  return DAYS[dow(s)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]
}
export const fmtShort = (s: string) => {
  const d = pd(s)
  return DAYS3[dow(s)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3)
}
export const today = () => ymd(new Date())
export const nowMin = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
