import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Header, Modal, Octopus, burst } from '../ui'
import { MAX_ARMS, PALETTE, addDays, dayKey, daysSince, fmtTime, freeSlot } from '../lib'
import type { Arm, ArmStatus } from '../types'

function ArmForm({ onDone, arm }: { onDone: () => void; arm?: Arm }) {
  const { hearts, arms, add, patch } = useStore(useShallow((s) => ({ hearts: s.hearts, arms: s.arms, add: s.add, patch: s.patch })))
  const [f, setF] = useState({ title: arm?.title ?? '', purpose: arm?.purpose ?? '', heartId: arm?.heartId ?? '', color: arm?.color ?? PALETTE[arms.length % 8] })
  const full = arms.filter((a) => a.status === 'active').length >= MAX_ARMS
  const save = () => {
    if (!f.title.trim()) return
    const p = { ...f, heartId: f.heartId || undefined, touchedAt: Date.now() }
    if (arm) patch('arms', arm.id, p)
    else add('arms', { ...p, status: full ? 'clutch' : 'active', createdAt: Date.now() })
    onDone()
  }
  return (
    <div className="form">
      <input autoFocus placeholder="Project name" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input placeholder="Why does this arm exist?" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />
      <select value={f.heartId} onChange={(e) => setF({ ...f, heartId: e.target.value })}>
        <option value="">Serves which heart?</option>
        {hearts.map((h) => <option key={h.id} value={h.id}>♥ {h.title}</option>)}
      </select>
      <div className="row">{PALETTE.map((c) => <button key={c} aria-label={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} />)}</div>
      {!arm && full && <p className="muted">All 8 arms busy — this one goes to the clutch as an egg.</p>}
      <button className="btn" onClick={save}>{arm ? 'Save' : 'Grow it'}</button>
    </div>
  )
}

export function Arms() {
  const { arms, tasks, patch } = useStore(useShallow((s) => ({ arms: s.arms, tasks: s.tasks, patch: s.patch })))
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const by = (s: ArmStatus) => arms.filter((a) => a.status === s)
  const active = by('active')
  const hatch = (a: Arm) => active.length < MAX_ARMS && patch('arms', a.id, { status: 'active', touchedAt: Date.now() })

  return (
    <>
      <Header no="04" tag="ARMS · projects" title="Eight arms. No more." sub="Your projects — max 8 at once, one per arm. Bumps on an arm are its tasks (glowing = done). Extra projects wait in the Clutch; finished ones go to the Midden.">
        <button className="btn" onClick={() => setOpen(true)}>+ Grow an arm</button>
      </Header>
      <div className="grid2 wide-left">
        <Octopus arms={active} tasks={tasks} skin="var(--coral)" onFree={() => setOpen(true)} />
        <div className="stack">
          <div className="card">
            <h3>🥚 The clutch <span className="muted">· someday / incubating</span></h3>
            {by('clutch').map((a) => (
              <div key={a.id} className="row between">
                <span className="link" onClick={() => nav(`/arms/${a.id}`)}>{a.title}</span>
                <button className="btn ghost" disabled={active.length >= MAX_ARMS} onClick={() => hatch(a)}>Hatch</button>
              </div>
            ))}
            {!by('clutch').length && <p className="muted">No eggs. Park future projects here so they stop haunting you.</p>}
          </div>
          <div className="card">
            <h3>🐚 The midden <span className="muted">· done pile</span></h3>
            <p className="muted small">Real octopuses stack empty shells outside their den. These are yours.</p>
            {by('midden').map((a) => <Link key={a.id} to={`/arms/${a.id}`} className="chip">{a.title}</Link>)}
          </div>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Grow a new arm"><ArmForm onDone={() => setOpen(false)} /></Modal>
    </>
  )
}

export function ArmDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { arm, tasks, hearts, dives, blocks, settings, add, patch, remove } = useStore(useShallow((s) => ({
    arm: s.arms.find((a) => a.id === id), tasks: s.tasks, hearts: s.hearts, dives: s.dives, blocks: s.blocks, settings: s.settings, add: s.add, patch: s.patch, remove: s.remove,
  })))
  const [t, setT] = useState('')
  const [edit, setEdit] = useState(false)
  const [placed, setPlaced] = useState('')
  if (!arm) return <p className="muted">This arm was eaten. <Link to="/arms">Back</Link></p>
  const mine = tasks.filter((x) => x.armId === arm.id)
  const touch = () => patch('arms', arm.id, { touchedAt: Date.now() })
  const min = dives.filter((d) => d.armId === arm.id).reduce((s, d) => s + d.minutes, 0)
  const heart = hearts.find((h) => h.id === arm.heartId)
  const move = (status: ArmStatus) => patch('arms', arm.id, { status, touchedAt: Date.now() })
  const schedule = (title: string) => {
    const now = new Date(), today = dayKey(now), end = settings.dayEnd * 60
    let day = today, start = freeSlot(blocks, today, 60, Math.max(settings.dayStart * 60, now.getHours() * 60 + now.getMinutes()), end)
    if (start === null) { day = addDays(today, 1); start = freeSlot(blocks, day, 60, settings.dayStart * 60, end) }
    if (start === null) return setPlaced('No free hour today or tomorrow — the tide is full.')
    add('blocks', { day, start, dur: 60, title, kind: 'deep', armId: arm.id })
    setPlaced(`“${title}” → ${day === today ? 'today' : 'tomorrow'} ${fmtTime(start)}`)
  }

  return (
    <>
      <Header no="03·" tag={`ARM · ${arm.status}`} title={arm.title} sub={arm.purpose || 'No purpose written. An arm without a why tends to go limp.'}>
        <button className="btn ghost" onClick={() => setEdit(true)}>Edit</button>
        {arm.status !== 'active' && <button className="btn ghost" onClick={() => move('active')}>Make active</button>}
        {arm.status !== 'clutch' && <button className="btn ghost" onClick={() => move('clutch')}>Back to clutch</button>}
        {arm.status !== 'midden' && <button className="btn" onClick={(e) => { burst(e.currentTarget, arm.color); move('midden') }}>Done → midden</button>}
      </Header>
      <div className="grid2 wide-left">
        <div className="card" style={{ borderTop: `3px solid ${arm.color}` }}>
          <h3>Suckers <span className="muted">· tasks</span></h3>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { add('tasks', { title: t.trim(), armId: arm.id, done: false, createdAt: Date.now() }); setT(''); touch() } }}>
            <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Next physical action…" /><button className="btn">Add</button>
          </form>
          {placed && <p className="small whisper">{placed} <Link to="/tides">open Tides →</Link></p>}
          {[...mine].sort((a, b) => Number(a.done) - Number(b.done)).map((x) => (
            <div key={x.id} className={`row between task ${x.done ? 'done' : ''}`}>
              <label className="row check"><input type="checkbox" checked={x.done} onChange={(e) => { if (!x.done) burst(e.currentTarget, arm.color); patch('tasks', x.id, { done: !x.done, doneAt: Date.now() }); touch() }} />{x.title}</label>
              <span className="row">
                {!x.done && <button className="icon" title="Block an hour for it in Tides" onClick={() => schedule(x.title)}>⏱</button>}
                <button className="icon" title="Dive into it" onClick={() => nav(`/dive?arm=${arm.id}&intent=${encodeURIComponent(x.title)}`)}>▼</button>
                <button className="icon" onClick={() => remove('tasks', x.id)}>×</button>
              </span>
            </div>
          ))}
        </div>
        <div className="stack">
          <div className="stats">
            <div className="stat"><b>{mine.filter((x) => x.done).length}/{mine.length}</b><small>suckers lit</small></div>
            <div className="stat"><b>{Math.round(min / 6) / 10}h</b><small>dived</small></div>
            <div className="stat"><b>{daysSince(arm.touchedAt)}d</b><small>since touched</small></div>
          </div>
          {heart && <div className="card"><small className="specimen">Serves heart</small><p style={{ color: heart.color }}>♥ {heart.title}</p></div>}
          <button className="btn ghost danger" onClick={() => { if (confirm('Cut off this arm and its tasks?')) { mine.forEach((x) => remove('tasks', x.id)); remove('arms', arm.id); nav('/arms') } }}>Amputate arm</button>
        </div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit arm"><ArmForm arm={arm} onDone={() => setEdit(false)} /></Modal>
    </>
  )
}
