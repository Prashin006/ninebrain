import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { demoData, emptyData, snapshot, useStore } from '../store'
import { Header } from '../ui'
import { pull, useSync } from '../sync'
import { api, changePassword, logout, useAuth } from '../auth'
import { PALETTE, dayKey, uid } from '../lib'
import type { Data } from '../types'

const LOCKED = 'Past habit days and breaks are locked, so those parts were kept as they were.'

function Account() {
  const user = useAuth((s) => s.user)
  const sync = useSync()
  const [pw, setPw] = useState({ current: '', next: '' })
  const [msg, setMsg] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try { await changePassword(pw.current, pw.next); setPw({ current: '', next: '' }); setMsg('Password changed. Other devices were signed out.') }
    catch (x) { setMsg((x as Error).message) }
  }
  return (
    <div className="card form">
      <h3>Account <span className="muted">· {user?.email}</span></h3>
      <p className="small"><span className={`sync-badge ${sync.status}`}><i />{sync.status}</span> {sync.message} {sync.lastSync > 0 && <span className="muted">· last {new Date(sync.lastSync).toLocaleTimeString()}</span>}</p>
      <div className="row wrap">
        <button className="btn ghost" onClick={() => pull()}>Sync now</button>
        <button className="btn ghost danger" onClick={logout}>Sign out</button>
      </div>
      <form className="form" onSubmit={submit}>
        <input type="password" autoComplete="current-password" required placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <input type="password" autoComplete="new-password" required minLength={10} placeholder="New password (10+ characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <div className="row"><button className="btn">Change password</button></div>
      </form>
      {msg && <p className="small" role="status">{msg}</p>}
    </div>
  )
}

interface Member { email: string; admin: boolean; createdAt: number }
function Crew() {
  const [list, setList] = useState<Member[]>([])
  const [f, setF] = useState({ email: '', password: '' })
  const [msg, setMsg] = useState('')
  const load = () => api<Member[]>('users').then(setList).catch((e) => setMsg(e.message))
  useEffect(() => { load() }, [])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try { await api('users', 'POST', f); setMsg(`Added ${f.email}. Share the password privately; they can change it in Coconut.`); setF({ email: '', password: '' }); load() }
    catch (x) { setMsg((x as Error).message) }
  }
  return (
    <div className="card form">
      <h3>Crew <span className="muted">· admin</span></h3>
      {list.map((m) => <div key={m.email} className="row between small"><span>{m.email}{m.admin && <span className="muted"> · admin</span>}</span><span className="muted mono">{new Date(m.createdAt).toLocaleDateString()}</span></div>)}
      <form className="form" onSubmit={submit}>
        <input type="email" required autoComplete="off" placeholder="Their email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input type="password" required minLength={10} autoComplete="new-password" placeholder="Starting password (10+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <div className="row"><button className="btn">Add member</button></div>
      </form>
      {msg && <p className="small" role="status">{msg}</p>}
    </div>
  )
}

export default function Coconut() {
  const { settings, hearts, setSettings, patch, add, remove, restore } = useStore(useShallow((s) => ({ settings: s.settings, hearts: s.hearts, setSettings: s.setSettings, patch: s.patch, add: s.add, remove: s.remove, restore: s.restore })))
  const admin = useAuth((s) => !!s.user?.admin)
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `ninebrain-${dayKey()}.json` }).click()
    URL.revokeObjectURL(url)
  }
  const importJson = async (f?: File) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text()) as Data
      if (!d || typeof d !== 'object' || !Array.isArray(d.arms) || !d.settings) throw new Error('Not a Ninebrain backup')
      setMsg(restore(d) ? `Restored. ${LOCKED}` : 'Restored. Welcome back.')
    } catch (e) { setMsg(`Import failed: ${(e as Error).message}`) }
  }
  const num = (k: 'capacityH' | 'dayStart' | 'dayEnd', label: string, min: number, max: number) => (
    <label className="field">{label}<input type="number" min={min} max={max} value={settings[k]} onChange={(e) => setSettings({ [k]: Math.min(max, Math.max(min, +e.target.value)) })} /></label>
  )

  return (
    <>
      <Header no="09" tag="COCONUT · settings & backups" title="The coconut shell." sub="Veined octopuses carry coconut halves around as portable homes. This is yours: preferences, hearts, and backups." />
      <div className="grid2">
        <div className="card form">
          <h3>You</h3>
          <label className="field">Name<input value={settings.name} onChange={(e) => setSettings({ name: e.target.value })} /></label>
          {num('capacityH', 'Daily focus capacity (hours)', 1, 16)}
          <div className="row">{num('dayStart', 'Day starts', 0, 12)}{num('dayEnd', 'Day ends', 13, 24)}</div>
          <label className="row check"><input type="checkbox" checked={settings.theme === 'shallows'} onChange={(e) => setSettings({ theme: e.target.checked ? 'shallows' : 'abyss' })} /> Shallows (light) theme</label>
          <label className="row check"><input type="checkbox" checked={settings.snow} onChange={(e) => setSettings({ snow: e.target.checked })} /> Marine snow & glowing trail</label>
        </div>
        <div className="stack">
          <div className="card form">
            <h3>Three hearts <span className="muted">· core goals</span></h3>
            {hearts.map((h) => (
              <div key={h.id} className="row"><span className="swatch" style={{ background: h.color }} />
                <input value={h.title} onChange={(e) => patch('hearts', h.id, { title: e.target.value })} />
                <button className="icon" onClick={() => remove('hearts', h.id)}>×</button></div>
            ))}
            {hearts.length < 3 && <button className="btn ghost" onClick={() => add('hearts', { id: uid(), title: 'New heart', color: PALETTE[hearts.length] })}>+ Heart</button>}
          </div>
          <Account />
          {admin && <Crew />}
          <div className="card form">
            <h3>Backups</h3>
            <p className="muted small">Data lives in this browser and your account. Restores can't rewrite past habit days or breaks.</p>
            <div className="row wrap">
              <button className="btn" onClick={exportJson}>Export JSON</button>
              <button className="btn ghost" onClick={() => file.current?.click()}>Import JSON</button>
              <input ref={file} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
              <button className="btn ghost" onClick={() => confirm('Replace everything with demo data?') && setMsg(restore(demoData(settings.name)) ? `Demo loaded. ${LOCKED}` : 'Demo loaded.')}>Load demo ocean</button>
              <button className="btn ghost danger" onClick={() => confirm('Erase everything? Export first!') && setMsg(restore(emptyData()) ? `Drained. ${LOCKED}` : 'Drained.')}>Drain the ocean</button>
            </div>
            {msg && <p className="small">{msg}</p>}
          </div>
        </div>
      </div>
    </>
  )
}
