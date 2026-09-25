import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { DEMO_USERS } from '../api/mock'
import { ROLE_LABEL } from '../domain/types'
import { useAuth } from '../state/auth'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await login(email, password)
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Accesso non riuscito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><b>Mattacena</b><small>Gestione prenotazioni</small></div>
        <label className="f">Email<input type="email" id="login-email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="f">Password<input type="password" id="login-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ minHeight: 44 }}>{busy ? 'Accesso…' : 'Entra'}</button>
        {api.mode === 'mock' && (
          <div className="demo-users">
            <p className="hint">Versione dimostrativa con dati di prova. Entra con un ruolo:</p>
            {DEMO_USERS.map((u) => (
              <button type="button" key={u.id} className="btn" onClick={() => { setEmail(u.email); setPassword(u.password) }}>
                <span>{ROLE_LABEL[u.role]}</span><span className="small muted">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}
