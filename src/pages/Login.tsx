import { useState, type FormEvent } from 'react'
import { login } from '../auth'
import { Logo } from '../ui'

/** Invite-only sign in; accounts are created by the admin. */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await login(email, password) } catch (x) { setError((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="hatch">
      <form className="card" onSubmit={submit}>
        <div className="egg"><Logo size={64} /></div>
        <div className="specimen">NINEBRAIN — SIGN IN</div>
        <h1>Welcome back.</h1>
        <input type="email" autoComplete="username" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn big" disabled={busy}>{busy ? 'Surfacing…' : 'Sign in'}</button>
        {error && <p className="small danger" role="alert">{error}</p>}
        <p className="muted small">Invite-only. Ask the admin for an account.</p>
      </form>
    </div>
  )
}
