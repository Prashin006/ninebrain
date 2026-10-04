import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { snapshot, useStore } from '../store'
import { CountUp, Octopus, burst } from '../ui'
import { chroma, dayKey, fmtTime, isDue, weekStart, whispers } from '../lib'

const greet = (h: number) => (h < 5 ? 'Still up' : h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening')

export default function Den() {
  const d = useStore(useShallow((s) => ({ settings: s.settings, arms: s.arms, tasks: s.tasks, blocks: s.blocks, habits: s.habits, breaks: s.breaks, blots: s.blots, days: s.days, dives: s.dives, hearts: s.hearts })))
  const { add, toggleHabit } = useStore(useShallow((s) => ({ add: s.add, toggleHabit: s.toggleHabit })))
  const [ink, setInk] = useState('')
  const nav = useNavigate()
  const today = dayKey()
  const now = new Date()
  const log = d.days[today]
  const active = d.arms.filter((a) => a.status === 'active')
  const w = useMemo(() => whispers(snapshot()), [d])
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextBlocks = d.blocks.filter((b) => b.day === today && b.start + b.dur > nowMin).sort((a, b) => a.start - b.start).slice(0, 4)
  const due = d.habits.filter((h) => isDue(h, today, d.breaks))
  const diveMin = d.dives.filter((x) => dayKey(new Date(x.startedAt)) >= weekStart(today)).reduce((s, x) => s + x.minutes, 0)

  return (
    <div className="den">
      <section>
        <div className="specimen">№ 02 — THE DEN · {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>{greet(now.getHours())}, {d.settings.name || 'cephalopod'}.</h1>
        <form className="ink-line" onSubmit={(e) => { e.preventDefault(); if (ink.trim()) { add('blots', { text: ink.trim(), createdAt: Date.now() }); setInk(''); burst(e.currentTarget, '#ff4fd8') } }}>
          <input value={ink} onChange={(e) => setInk(e.target.value)} placeholder="Squirt a thought. Anything. Sort it later…" />
          <button className="btn">Ink it</button>
        </form>
        <Octopus arms={active} tasks={d.tasks} skin={log?.mood ? chroma(log.energy, log.mood) : 'var(--coral)'} onFree={() => nav('/arms')} />
        <div className="hearts">
          {d.hearts.map((h) => <span key={h.id} className="chip" style={{ borderColor: h.color }}><i style={{ background: h.color }} />♥ {h.title}</span>)}
        </div>
      </section>

      <section className="stack">
        <div className="stats">
          <Link to="/ink" className="stat"><b><CountUp value={d.blots.length} /></b><small>ink blots</small></Link>
          <Link to="/arms" className="stat"><b><CountUp value={active.length} />/8</b><small>arms busy</small></Link>
          <Link to="/dive" className="stat"><b><CountUp value={diveMin / 60} decimals={1} />h</b><small>dived this week</small></Link>
        </div>
        <div className="card">
          <h3>Otto whispers</h3>
          {w.length ? w.slice(0, 5).map((x, i) => <Link key={i} to={x.to} className={`whisper ${x.tone}`}>{x.text}</Link>) : <p className="muted">Calm waters. Nothing to nag about.</p>}
        </div>
        {log?.beats.some(Boolean) && (
          <div className="card"><h3>Today’s heartbeats</h3>{log.beats.filter(Boolean).map((b, i) => <p key={i}>♥ {b}</p>)}</div>
        )}
        <div className="card">
          <h3>Next on the tide</h3>
          {nextBlocks.length ? nextBlocks.map((b) => (
            <div key={b.id} className="row between"><span><span className="mono muted">{fmtTime(b.start)}</span> {b.title}</span><span className={`kind ${b.kind}`}>{b.kind}</span></div>
          )) : <p className="muted">Nothing charted. <Link to="/tides">Block time →</Link></p>}
        </div>
        <div className="card">
          <h3>Currents today</h3>
          {due.length ? due.map((h) => (
            <label key={h.id} className="row check">
              <input type="checkbox" checked={h.log.includes(today)} onChange={(e) => { if (!h.log.includes(today)) burst(e.currentTarget, h.color); toggleHabit(h.id, today) }} />
              <span style={{ color: h.color }}>●</span> {h.title}
            </label>
          )) : <p className="muted">No currents due.</p>}
        </div>
      </section>
    </div>
  )
}
