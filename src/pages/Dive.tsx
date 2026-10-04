import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Header, burst } from '../ui'
import { CREATURES, M_PER_MIN, ZONES, dayKey, diveElapsedMs, weekStart, zoneAt } from '../lib'

const MAX_M = 11_000

/** Sonar ping via Web Audio — no audio assets needed. */
function ping() {
  const a = new AudioContext(), o = a.createOscillator(), g = a.createGain()
  o.frequency.setValueAtTime(1200, a.currentTime); o.frequency.exponentialRampToValueAtTime(600, a.currentTime + 1.2)
  g.gain.setValueAtTime(0.2, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 1.5)
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 1.5)
}

export default function Dive() {
  const { arms, dives, active, set, add, patch } = useStore(useShallow((s) => ({ arms: s.arms, dives: s.dives, active: s.activeDive, set: s.set, add: s.add, patch: s.patch })))
  const [qs] = useSearchParams()
  const [armId, setArmId] = useState(qs.get('arm') ?? '')
  const [intention, setIntention] = useState(qs.get('intent') ?? '')
  const [target, setTarget] = useState(Number(qs.get('min')) || 50)
  const [outcome, setOutcome] = useState('')
  const [ending, setEnding] = useState<number | null>(null) // minutes to log, once Surface is pressed
  const [, tick] = useState(0)
  const pinged = useRef(false)

  useEffect(() => { if (!active) return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [active])

  const ms = active ? diveElapsedMs(active) : 0
  const min = ms / 60000
  const depth = Math.round(min * M_PER_MIN)
  const zone = zoneAt(depth)
  const seen = CREATURES.filter((c) => depth >= c.at)
  useEffect(() => {
    if (active && min >= active.targetMin && !pinged.current) { pinged.current = true; ping() }
    if (!active) pinged.current = false
  }, [active, min])

  const start = () => set({ activeDive: { startedAt: Date.now(), pausedMs: 0, armId: armId || undefined, intention, targetMin: target } })
  const pause = () => active && set({ activeDive: active.pausedAt ? { ...active, pausedAt: undefined, pausedMs: active.pausedMs + Date.now() - active.pausedAt } : { ...active, pausedAt: Date.now() } })
  // Forgot the timer? Way past target → suggest logging only the target.
  const askSurface = () => active && setEnding(Math.round(min > active.targetMin + 10 ? active.targetMin : min))
  const surface = (save: boolean) => {
    if (!active) return
    if (save && ending && ending >= 1) add('dives', { startedAt: active.startedAt, minutes: ending, armId: active.armId, intention: active.intention, outcome })
    if (save && active.armId) patch('arms', active.armId, { touchedAt: Date.now() })
    if (save) burst(document.querySelector('.depth'), '#3df5d3')
    set({ activeDive: undefined }); setOutcome(''); setEnding(null)
  }
  const mmss = `${Math.floor(min)}:${String(Math.floor((ms / 1000) % 60)).padStart(2, '0')}`
  const over = !!active && min > active.targetMin

  const week = dives.filter((d) => dayKey(new Date(d.startedAt)) >= weekStart(dayKey()))
  const byArm = arms.map((a) => ({ a, m: week.filter((d) => d.armId === a.id).reduce((s, d) => s + d.minutes, 0) })).filter((x) => x.m).sort((x, y) => y.m - x.m)
  const total = week.reduce((s, d) => s + d.minutes, 0)

  return (
    <div className="dive" style={{ ['--zone' as string]: active ? zone.bg : undefined }}>
      <Header no="06" tag="DIVE · focus timer" title={active ? (active.intention || 'Focusing…') : 'Focus on one thing.'}
        sub={active ? `${zone.name} — the longer you focus, the deeper the octopus goes.` : 'A focus timer. Pick one task, start, and don’t switch until it ends. Your focus time is logged per project, so you can see where your hours really went.'} />
      <div className="grid2 wide-left">
        <div className="card gauge-card">
          {active && ending !== null ? (
            <div className="form">
              <h3>Back on the surface</h3>
              <label className="field">Minutes to log (fix it if you forgot the timer)
                <input type="number" min={0} value={ending} onChange={(e) => setEnding(Math.max(0, +e.target.value))} />
              </label>
              <textarea rows={2} placeholder="What did you get done?" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
              <div className="row">
                <button className="btn" onClick={() => surface(true)}>Save dive</button>
                <button className="btn ghost" onClick={() => setEnding(null)}>Keep going</button>
                <button className="btn ghost danger" onClick={() => surface(false)}>Discard</button>
              </div>
            </div>
          ) : active ? (
            <>
              <div className="depth mono">{mmss}</div>
              <div className="mono muted">of {active.targetMin} min {active.pausedAt ? '· paused' : ''} · ≈ {depth.toLocaleString()} m deep</div>
              {over && <p className="whisper warn">Time’s up. Still focused? Keep going, or surface to log it.</p>}
              <div className="gauge">
                {ZONES.map((z) => <div key={z.name} className="band" style={{ top: `${(z.from / MAX_M) * 100}%` }}><small>{z.name}</small></div>)}
                <div className="target" style={{ top: `${((active.targetMin * M_PER_MIN) / MAX_M) * 100}%` }} />
                <div className="diver" style={{ top: `${Math.min(100, (depth / MAX_M) * 100)}%` }} />
              </div>
              {seen.length > 0 && <p className="creature">You passed {seen[seen.length - 1].what}.</p>}
              <div className="row">
                <button className="btn ghost" onClick={pause}>{active.pausedAt ? 'Resume' : 'Pause'}</button>
                <button className="btn" onClick={askSurface}>Stop & log ↑</button>
              </div>
            </>
          ) : (
            <div className="form">
              <input autoFocus placeholder="Intention: what will exist after this dive?" value={intention} onChange={(e) => setIntention(e.target.value)} />
              <select value={armId} onChange={(e) => setArmId(e.target.value)}>
                <option value="">No arm</option>
                {arms.filter((a) => a.status === 'active').map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <div className="row">
                {[[25, 'Midnight · 25m'], [50, 'Abyss · 50m'], [90, 'Trench · 90m']].map(([m, l]) => (
                  <button key={m} className={`chip ${target === m ? 'on' : ''}`} onClick={() => setTarget(m as number)}>{l}</button>
                ))}
                <input type="number" className="narrow" min={5} value={target} onChange={(e) => setTarget(Math.max(1, +e.target.value))} />
              </div>
              <button className="btn big" onClick={start}>▼ Dive</button>
            </div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h3>This week underwater</h3>
            <p className="depth-sm mono">{(total / 60).toFixed(1)}h</p>
            {byArm.map(({ a, m }) => (
              <div key={a.id} className="bar"><span>{a.title}</span><i style={{ width: `${(m / total) * 100}%`, background: a.color }} /><small className="mono">{m}m</small></div>
            ))}
          </div>
          <div className="card">
            <h3>Dive log</h3>
            {dives.slice(-6).reverse().map((d) => (
              <p key={d.id} className="small"><span className="mono muted">{new Date(d.startedAt).toLocaleDateString()} · {d.minutes}m · {(d.minutes * M_PER_MIN).toLocaleString()}m deep</span><br />{d.intention} {d.outcome && `→ ${d.outcome}`}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
