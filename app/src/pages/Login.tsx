import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api'
import { DEMO_USERS } from '../api/mock'
import { ROLE_LABEL } from '../domain/types'
import { useAuth } from '../state/auth'

// Staff reset their password through WordPress, which owns the accounts.
const LOST_PASSWORD_URL = 'https://mattacena.com/wp-login.php?action=lostpassword'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => emailRef.current?.focus(), [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await login(email, password)
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Accesso non riuscito')
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-ring" />
        <div className="auth-mark">M</div>
        <div className="auth-brand-text">
          <b>Mattacena</b>
          <span>Cucina tradizionale toscana</span>
        </div>
        <p className="auth-brand-foot">Prenotazioni, sala e clienti in un'unica app.</p>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-mobile-brand" aria-hidden="true">
            <div className="auth-mark sm">M</div>
            <b>Mattacena</b>
          </div>

          <div>
            <h1>Accedi</h1>
            <p className="auth-sub">Usa l’email e la password del tuo account mattacena.com.</p>
          </div>

          <label className="auth-field">
            <span>Email</span>
            <input ref={emailRef} type="email" id="login-email" autoComplete="username" inputMode="email" placeholder="nome@mattacena.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required aria-invalid={!!err} />
          </label>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="login-password">Password</label>
              <a href={LOST_PASSWORD_URL} target="_blank" rel="noopener noreferrer">Password dimenticata?</a>
            </div>
            <div className="auth-pw">
              <input type={show ? 'text' : 'password'} id="login-password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required aria-invalid={!!err} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Nascondi password' : 'Mostra password'} aria-pressed={show}>
                {show ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3.1 4.1M6.1 6.1C3.9 7.6 2.5 9.8 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.2-1" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {err && (
            <div className="auth-error" role="alert">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10" cy="10" r="8" /><path d="M10 6v5M10 14h.01" /></svg>
              {err}
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={busy || !email || !password}>
            {busy ? <><span className="spin" aria-hidden="true" />Accesso in corso…</> : 'Entra'}
          </button>

          {api.mode === 'mock' ? (
            <div className="auth-demo">
              <p>Versione dimostrativa con dati di prova. Scegli un ruolo:</p>
              {DEMO_USERS.map((u) => (
                <button type="button" key={u.id} onClick={() => { setEmail(u.email); setPassword(u.password); setErr('') }}>
                  <b>{ROLE_LABEL[u.role]}</b><span>{u.email}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="auth-help">Non hai un account? Chiedi al titolare di abilitarti.</p>
          )}
        </form>
      </main>
    </div>
  )
}
