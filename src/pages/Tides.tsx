import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Header, Modal } from '../ui'
import { addDays, dayKey, fmtDay, fmtTime, weekDays } from '../lib'
import type { Block, BlockKind } from '../types'

const PX = 56 // pixels per hour
const SNAP = 15
const KINDS: BlockKind[] = ['deep', 'shallow', 'life', 'break']
type Drag = { id: string; mode: 'move' | 'size'; y0: number; x0: number; start: number; dur: number; day: string; moved: boolean }

/** Time-blocking grid: click empty space to create, drag to move (across days), drag bottom edge to resize. */
export default function Tides() {
  const { blocks, arms, settings, add, patch, remove } = useStore(useShallow((s) => ({ blocks: s.blocks, arms: s.arms, settings: s.settings, add: s.add, patch: s.patch, remove: s.remove })))
  const [view, setView] = useState<'day' | 'week'>('week')
  const [anchor, setAnchor] = useState(dayKey())
  const [editing, setEditing] = useState<Block | null>(null)
  const [now, setNow] = useState(new Date())
  const drag = useRef<Drag | null>(null)
  const cols = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const days = view === 'week' ? weekDays(anchor) : [anchor]
  const { dayStart: h0, dayEnd: h1 } = settings
  const snap = (m: number) => Math.round(m / SNAP) * SNAP
  const clamp = (m: number, dur: number) => Math.max(h0 * 60, Math.min(h1 * 60 - dur, m))

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dm = snap(((e.clientY - d.y0) / PX) * 60)
    if (Math.abs(e.clientY - d.y0) + Math.abs(e.clientX - d.x0) > 4) d.moved = true
    if (d.mode === 'size') return patch('blocks', d.id, { dur: Math.max(SNAP, d.dur + dm) })
    const colW = (cols.current?.clientWidth ?? 1) / days.length
    const shift = Math.round((e.clientX - d.x0) / colW)
    const idx = Math.max(0, Math.min(days.length - 1, days.indexOf(d.day) + shift))
    patch('blocks', d.id, { start: clamp(d.start + dm, d.dur), day: days[idx] })
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved && d.mode === 'move') setEditing(blocks.find((b) => b.id === d.id) ?? null)
  }
  const create = (day: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const start = clamp(h0 * 60 + Math.floor((e.nativeEvent.offsetY / PX) * 60 / SNAP) * SNAP, 60)
    const id = add('blocks', { day, start, dur: 60, title: 'New block', kind: 'deep' })
    setEditing({ id, day, start, dur: 60, title: 'New block', kind: 'deep' })
  }
  const load = (day: string) => blocks.filter((b) => b.day === day && b.kind !== 'break').reduce((s, b) => s + b.dur, 0) / 60
  const copyPrev = () => {
    const span = days.length
    blocks.filter((b) => days.includes(addDays(b.day, span))).forEach(({ id: _id, ...b }) => add('blocks', { ...b, day: addDays(b.day, span) }))
  }
  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i)
  const today = dayKey(now)

  return (
    <>
      <Header no="05" tag="TIDES · time-blocking" title="Chart the tides." sub="Give every hour a job before the day gives it one for you. The water line rises with load — past capacity, it floods.">
        <button className="btn ghost" onClick={() => setAnchor(addDays(anchor, view === 'week' ? -7 : -1))}>‹</button>
        <button className="btn ghost" onClick={() => setAnchor(dayKey())}>Today</button>
        <button className="btn ghost" onClick={() => setAnchor(addDays(anchor, view === 'week' ? 7 : 1))}>›</button>
        <button className="btn ghost" onClick={() => setView(view === 'week' ? 'day' : 'week')}>{view === 'week' ? 'Day' : 'Week'} view</button>
        <button className="btn ghost" onClick={copyPrev} title="Copy blocks from the previous period">Copy previous {view}</button>
      </Header>
      <div className="tides card" onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <div className="tide-head" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          <span />
          {days.map((d) => {
            const l = load(d), pct = Math.min(100, (l / settings.capacityH) * 100)
            return (
              <div key={d} className={`th ${d === today ? 'today' : ''}`}>
                {fmtDay(d)}
                <div className={`water ${l > settings.capacityH ? 'flood' : ''}`}><i style={{ width: `${pct}%` }} /></div>
                <small className="mono muted">{l.toFixed(1)}h / {settings.capacityH}h</small>
              </div>
            )
          })}
        </div>
        <div className="tide-body" style={{ gridTemplateColumns: `50px 1fr` }}>
          <div>{hours.map((h) => <div key={h} className="hour mono" style={{ height: PX }}>{fmtTime(h * 60)}</div>)}</div>
          <div ref={cols} className="cols" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
            {days.map((d) => (
              <div key={d} className="col" style={{ height: hours.length * PX }} onClick={(e) => create(d, e)}>
                {d === today && <div className="nowline" style={{ top: ((now.getHours() * 60 + now.getMinutes() - h0 * 60) / 60) * PX }} />}
                {blocks.filter((b) => b.day === d).map((b) => {
                  const arm = arms.find((a) => a.id === b.armId)
                  return (
                    <div key={b.id} className={`block ${b.kind}`} style={{ top: ((b.start - h0 * 60) / 60) * PX, height: (b.dur / 60) * PX - 2, ['--c' as string]: arm?.color }}
                      onPointerDown={(e) => { e.stopPropagation(); drag.current = { id: b.id, mode: 'move', y0: e.clientY, x0: e.clientX, start: b.start, dur: b.dur, day: b.day, moved: false } }}
                      onClick={(e) => e.stopPropagation()}>
                      <b>{b.title}</b><small className="mono">{fmtTime(b.start)}–{fmtTime(b.start + b.dur)}</small>
                      <span className="grip" onPointerDown={(e) => { e.stopPropagation(); drag.current = { id: b.id, mode: 'size', y0: e.clientY, x0: e.clientX, start: b.start, dur: b.dur, day: b.day, moved: true } }} />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Block">
        {editing && (() => {
          const b = blocks.find((x) => x.id === editing.id) ?? editing
          const up = (p: Partial<Block>) => patch('blocks', b.id, p)
          return (
            <div className="form">
              <input autoFocus value={b.title} onChange={(e) => up({ title: e.target.value })} onFocus={(e) => e.target.select()} />
              <div className="row">{KINDS.map((k) => <button key={k} className={`chip kind ${k} ${b.kind === k ? 'on' : ''}`} onClick={() => up({ kind: k })}>{k}</button>)}</div>
              <select value={b.armId ?? ''} onChange={(e) => up({ armId: e.target.value || undefined })}>
                <option value="">No arm</option>
                {arms.filter((a) => a.status === 'active').map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <div className="row">
                <label className="field">Start<input type="time" step={900} value={fmtTime(b.start)} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); up({ start: h * 60 + m }) }} /></label>
                <label className="field">Minutes<input type="number" min={15} step={15} value={b.dur} onChange={(e) => up({ dur: Math.max(15, +e.target.value) })} /></label>
              </div>
              <div className="row between">
                <button className="btn ghost danger" onClick={() => { remove('blocks', b.id); setEditing(null) }}>Delete</button>
                <span className="row">
                  <button className="btn ghost" onClick={() => nav(`/dive?arm=${b.armId ?? ''}&intent=${encodeURIComponent(b.title)}&min=${b.dur}`)}>▼ Dive now</button>
                  <button className="btn" onClick={() => setEditing(null)}>Done</button>
                </span>
              </div>
            </div>
          )
        })()}
      </Modal>
    </>
  )
}
