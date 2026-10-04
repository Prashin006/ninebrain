import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { Command, Droplet, House, Nut, Shell, WavesArrowDown, WavesArrowUp, WavesHorizontal, Wind } from 'lucide-react'
import { useStore } from './store'
import { resolve, useSync } from './sync'
import { useAuth } from './auth'
import { Logo, MarineSnow } from './ui'
import { diveElapsedMs } from './lib'
import Currents from './pages/Currents'
import Hatch from './pages/Hatch'
import Login from './pages/Login'

const Den = lazy(() => import('./pages/Den'))
const Ink = lazy(() => import('./pages/Ink'))
const Arms = lazy(() => import('./pages/Arms').then((m) => ({ default: m.Arms })))
const ArmDetail = lazy(() => import('./pages/Arms').then((m) => ({ default: m.ArmDetail })))
const Tides = lazy(() => import('./pages/Tides'))
const Dive = lazy(() => import('./pages/Dive'))
const Reef = lazy(() => import('./pages/Reef'))
const Surface = lazy(() => import('./pages/Surface'))
const Coconut = lazy(() => import('./pages/Coconut'))

const ArmsIcon = ({ size = 18 }: { size?: number }) => <Logo size={size} />
const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent)
const ALT = MAC ? '⌥' : 'Alt'
const MOD = MAC ? '⌘' : 'Ctrl'
const NAV = [
  { to: '/', label: 'Currents', sub: 'habits · home', Icon: Wind },
  { to: '/den', label: 'Den', sub: 'overview', Icon: House },
  { to: '/ink', label: 'Ink', sub: 'brain dump', Icon: Droplet },
  { to: '/arms', label: 'Arms', sub: 'projects', Icon: ArmsIcon },
  { to: '/tides', label: 'Tides', sub: 'schedule', Icon: WavesHorizontal },
  { to: '/dive', label: 'Dive', sub: 'deep focus', Icon: WavesArrowDown },
  { to: '/reef', label: 'Reef', sub: 'idea vault', Icon: Shell },
  { to: '/surface', label: 'Surface', sub: 'reviews', Icon: WavesArrowUp },
  { to: '/coconut', label: 'Coconut', sub: 'settings', Icon: Nut },
]

function Palette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const nav = useNavigate()
  const add = useStore((s) => s.add)
  const items = useMemo(() => {
    const pages = NAV.filter((n) => (n.label + n.sub).toLowerCase().includes(q.toLowerCase()))
      .map((n) => ({ label: `Go to ${n.label} — ${n.sub}`, run: () => nav(n.to) }))
    const ink = { label: `Squirt ink: “${q.trim()}”`, run: () => { add('blots', { text: q.trim(), createdAt: Date.now() }) } }
    return q.trim() ? [ink, ...pages] : pages
  }, [q, nav, add])
  const run = (k: number) => { items[k]?.run(); onClose() }
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="palette card" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Jump somewhere, or type a thought to ink it…" value={q}
          onChange={(e) => { setQ(e.target.value); setI(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setI((i + 1) % items.length)
            if (e.key === 'ArrowUp') setI((i - 1 + items.length) % items.length)
            if (e.key === 'Enter') run(i)
            if (e.key === 'Escape') onClose()
          }} />
        {items.map((it, k) => (
          <button key={it.label} className={`pal-item ${k === i ? 'on' : ''}`} onMouseEnter={() => setI(k)} onClick={() => run(k)}>{it.label}</button>
        ))}
      </div>
    </div>
  )
}

function SyncBadge() {
  const { status, message } = useSync()
  if (status === 'off') return null
  const label = { syncing: 'syncing…', synced: 'synced', offline: 'offline — saved here', error: message, conflict: 'needs you', off: '' }[status]
  return <NavLink to="/coconut" className={`sync-badge ${status}`} title={message}><i />{label}</NavLink>
}

function ConflictPrompt() {
  const theirs = useSync((s) => s.theirs)
  if (!theirs) return null
  return (
    <div className="scrim">
      <div className="modal card" role="alertdialog">
        <h3>Two octopuses, one brain.</h3>
        <p className="muted">Another device saved changes while this one also had unsaved changes. Only one copy can win.</p>
        <p className="small">Other device saved: {new Date(theirs.updatedAt).toLocaleString()}</p>
        <div className="row wrap">
          <button className="btn" onClick={() => resolve('theirs')}>Use the other device’s copy</button>
          <button className="btn ghost" onClick={() => resolve('mine')}>Keep this device’s copy</button>
        </div>
      </div>
    </div>
  )
}

function Frame() {
  const s = useStore((s) => s.settings)
  const blots = useStore((s) => s.blots.length)
  const dive = useStore((s) => s.activeDive)
  const user = useAuth((s) => s.user)
  const [pal, setPal] = useState(false)
  const loc = useLocation()
  const go = useNavigate()

  useEffect(() => { document.documentElement.dataset.theme = s.theme }, [s.theme])
  // cursor spotlight on cards
  useEffect(() => {
    const m = (e: PointerEvent) => {
      const c = (e.target as Element | null)?.closest?.<HTMLElement>('.card, .stat')
      if (!c) return
      const r = c.getBoundingClientRect()
      c.style.setProperty('--mx', `${e.clientX - r.left}px`)
      c.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    addEventListener('pointermove', m)
    return () => removeEventListener('pointermove', m)
  }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const palette = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
      if (palette) { e.preventDefault(); setPal((p) => !p) }
      // e.code, not e.key: Option+digit types symbols on macOS
      const digit = e.code.match(/^Digit([1-9])$/)
      if (e.altKey && digit) { e.preventDefault(); go(NAV[+digit[1] - 1].to) }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [go])
  useEffect(() => {
    if (!dive) { document.title = 'Ninebrain'; return }
    const t = setInterval(() => { const m = Math.floor(diveElapsedMs(dive) / 60000); document.title = `▼ ${m} min focused — Ninebrain` }, 1000)
    return () => clearInterval(t)
  }, [dive])

  if (user === undefined) return <MarineSnow />
  if (!user) return <><MarineSnow /><Login /></>
  if (!s.hatched) return <><MarineSnow /><Hatch /></>
  return (
    <div className="app">
      {s.snow && <MarineSnow />}
      <aside className="side">
        <div className="brand"><Logo /><div><b>NINEBRAIN</b><small>borrow eight more brains</small></div></div>
        <nav>
          {NAV.map(({ to, label, sub, Icon }, i) => (
            <NavLink key={to} to={to} end={to === '/'} className="nav" title={`${ALT}+${i + 1}`}>
              <Icon size={18} /><span>{label}<small>{sub}</small></span>
              {to === '/ink' && blots > 0 && <em className="bubble">{blots}</em>}
              {to === '/dive' && dive && <em className="bubble pulse">●</em>}
            </NavLink>
          ))}
        </nav>
        <SyncBadge />
        <button className="ghost kbd" onClick={() => setPal(true)}><Command size={14} /> {MOD} K — anything</button>
      </aside>
      <main key={loc.pathname} className="main">
        <Suspense fallback={<p className="muted">Swimming over…</p>}>
        <Routes>
          <Route path="/" element={<Currents />} />
          <Route path="/den" element={<Den />} />
          <Route path="/ink" element={<Ink />} />
          <Route path="/arms" element={<Arms />} />
          <Route path="/arms/:id" element={<ArmDetail />} />
          <Route path="/tides" element={<Tides />} />
          <Route path="/dive" element={<Dive />} />
          <Route path="/reef" element={<Reef />} />
          <Route path="/surface" element={<Surface />} />
          <Route path="/coconut" element={<Coconut />} />
          <Route path="*" element={<Currents />} />
        </Routes>
        </Suspense>
      </main>
      <button className="fab" title={`Quick ink (${MOD} K)`} onClick={() => setPal(true)}><Droplet /></button>
      {pal && <Palette onClose={() => setPal(false)} />}
      <ConflictPrompt />
    </div>
  )
}

export default function App() {
  return <HashRouter><Frame /></HashRouter>
}
