import { useState, type CSSProperties, type MouseEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Header, Modal, burst } from '../ui'
import { PALETTE, addDays, countOn, dailyTarget, dayKey, fmtDay, isDue, isScheduled, jar, streak, strength, weekStart } from '../lib'
import type { Break, DayKey, Habit } from '../types'
import { BREAK_NOTICE_DAYS, breakFloor } from '../../shared/rules'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const CAL_DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const CLIP = 'M1.5 4v8a1.5 1.5 0 0 0 3 0V3a2.5 2.5 0 0 0-5 0v10a3 3 0 0 0 6 0V5'
const shiftMonth = (m: string, d: number) => { const [y, mo] = m.split('-').map(Number); return dayKey(new Date(y, mo - 1 + d, 1)).slice(0, 7) }
const vars = (c: string, p = 0) => ({ '--c': c, '--p': `${p}%` }) as CSSProperties
const clamp = (n: number, max: number) => Math.min(max, Math.max(1, Math.round(n) || 1))

type Draft = Pick<Habit, 'title' | 'identity' | 'cue' | 'tiny' | 'days' | 'color'> & Required<Pick<Habit, 'kind' | 'target' | 'goal'>>
const draft = (h?: Habit): Draft => ({
  title: h?.title ?? '', identity: h?.identity ?? '', cue: h?.cue ?? '', tiny: h?.tiny ?? '', days: h?.days ?? [0, 1, 2, 3, 4, 5, 6],
  color: h?.color ?? PALETTE[0], kind: h?.kind ?? 'build', target: h?.target ?? 1, goal: h?.goal ?? 66,
})
// Atomic Habits' laws, inverted for habits you want to break
const COPY = {
  build: { title: ['The habit', 'Read 20 pages'], identity: ['Identity — every ✗ is a vote for…', 'I am a reader'], cue: ['Make it obvious — cue / habit stack', 'After I pour my coffee'], tiny: ['Make it easy — the 2-minute version', 'Read one page'] },
  avoid: { title: ['The habit to break', 'No phone in bed'], identity: ['Identity — every day resisted is a vote for…', 'I am someone who sleeps well'], cue: ['Make it invisible — remove the cue', 'Phone charges in the kitchen'], tiny: ['Make it difficult — friction or a swap', 'Read a page instead'] },
} as const

function HabitForm({ habit, onDone }: { habit?: Habit; onDone: () => void }) {
  const { add, patch, remove } = useStore(useShallow((s) => ({ add: s.add, patch: s.patch, remove: s.remove })))
  const [f, setF] = useState(() => draft(habit))
  const save = () => {
    if (!f.title.trim()) return
    const d = { ...f, target: clamp(f.target, 50), goal: clamp(f.goal, 200) }
    if (habit) patch('habits', habit.id, d)
    else add('habits', { ...d, log: [], createdAt: Date.now() })
    onDone()
  }
  const field = (k: 'title' | 'identity' | 'cue' | 'tiny') => (
    <label className="field">{COPY[f.kind][k][0]}<input value={f[k]} placeholder={COPY[f.kind][k][1]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  )
  const num = (k: 'target' | 'goal', label: string) => (
    <label className="field">{label}<input type="number" min={1} value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: +e.target.value })} /></label>
  )
  return (
    <div className="form">
      <div className="row">{(['build', 'avoid'] as const).map((k) => (
        <button key={k} className={`chip ${f.kind === k ? 'on' : ''}`} onClick={() => setF({ ...f, kind: k })}>{k === 'build' ? '+ Build a habit' : '− Break a habit'}</button>
      ))}</div>
      {field('title')}{field('identity')}{field('cue')}{field('tiny')}
      <div className="row">
        {f.kind === 'build' && num('target', 'Paper clips per day (reps)')}
        {num('goal', 'Jar size (done days)')}
      </div>
      <div className="row">{DOW.map((d, i) => (
        <button key={i} className={`chip ${f.days.includes(i) ? 'on' : ''}`} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })}>{d}</button>
      ))}</div>
      <div className="row">{PALETTE.map((c) => <button key={c} aria-label={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} />)}</div>
      <div className="row between">
        {habit ? <button className="btn ghost danger" onClick={() => { remove('habits', habit.id); onDone() }}>Delete</button> : <span />}
        <button className="btn" onClick={save}>Save current</button>
      </div>
    </div>
  )
}

function BreaksForm() {
  const { breaks, addBreak } = useStore(useShallow((s) => ({ breaks: s.breaks, addBreak: s.addBreak })))
  const blank = { from: '', to: '', label: '' }
  const [b, setB] = useState(blank)
  const floor = breakFloor(dayKey())
  const ok = b.from >= floor && b.to >= b.from
  const save = () => {
    const label = b.label.trim() || 'Break'
    if (!confirm(`Lock in “${label}”, ${fmtDay(b.from)} → ${fmtDay(b.to)}?\n\nBreaks can never be edited or deleted.`)) return
    if (addBreak(b.from, b.to, label)) setB(blank)
  }
  return (
    <div className="form">
      <p className="muted small">Plan time off at least {BREAK_NOTICE_DAYS} days ahead. Break days are skipped for every current: streaks freeze instead of breaking. Once saved, a break is permanent: no edits, no deletes, no back-dating.</p>
      {[...breaks].sort((x, y) => x.from.localeCompare(y.from)).map((x) => (
        <div key={x.id} className="row between">
          <span>🌴 {x.label}</span>
          <span className="muted mono small">{fmtDay(x.from)} → {fmtDay(x.to)} 🔒</span>
        </div>
      ))}
      <div className="row wrap">
        <label className="field">From<input type="date" value={b.from} min={floor} onChange={(e) => setB({ ...b, from: e.target.value })} /></label>
        <label className="field">To<input type="date" value={b.to} min={b.from || floor} onChange={(e) => setB({ ...b, to: e.target.value })} /></label>
      </div>
      <label className="field">Why<input value={b.label} maxLength={60} placeholder="Vacation" onChange={(e) => setB({ ...b, label: e.target.value })} /></label>
      <div className="row between">
        <span />
        <button className="btn" disabled={!ok} onClick={save}>Lock in break</button>
      </div>
    </div>
  )
}

function Ring({ done, total }: { done: number; total: number }) {
  const C = 2 * Math.PI * 40
  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`${done} of ${total} done today`}>
      <circle className="bg" cx="50" cy="50" r="40" />
      <circle className="fg" cx="50" cy="50" r="40" strokeDasharray={`${total ? (done / total) * C : 0} ${C}`} />
      <text x="50" y="50">{done}/{total}</text>
    </svg>
  )
}

/** One jar of paper clips, heaped from the bottom; grid adapts to capacity. */
function Jar({ n, cap, label }: { n: number; cap: number; label: string }) {
  const W = 60, H = 78
  const cols = Math.max(2, Math.round(Math.sqrt((cap * W) / H))), rows = Math.ceil(cap / cols)
  const cw = W / cols, ch = H / rows, s = Math.min(cw, ch) / 11
  return (
    <figure className="jar">
      <svg viewBox="0 0 80 112" role="img" aria-label={`${label}: ${n} clips`}>
        <rect className="lid" x="20" y="4" width="40" height="8" rx="3" />
        <path className="glass" d="M24 12h32v6c10 4 16 10 16 18v66a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8V36c0-8 6-14 16-18z" />
        {Array.from({ length: n }, (_, i) => {
          const x = 10 + ((i % cols) + 0.5) * cw + (((i * 7) % 5) - 2) * 0.4, y = 106 - (Math.floor(i / cols) + 0.5) * ch
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <g className="clip" style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }}>
                <path d={CLIP} transform={`rotate(${((i * 47) % 120) - 60}) scale(${s}) translate(-2.5 -8)`} />
              </g>
            </g>
          )
        })}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

/** Paper-clip strategy: every rep moves a clip from the full jar to the empty one. */
function Jars({ moved, cap, title }: { moved: number; cap: number; title: string }) {
  return (
    <div className="jarpair">
      <small>{title}</small>
      <div className="row">
        <Jar n={cap - moved} cap={cap} label="to go" />
        <span className="muted">→</span>
        <Jar n={moved} cap={cap} label={`${moved}/${cap}`} />
      </div>
    </div>
  )
}

/** Calendar month: ✗ on done days, blank square = today's cue, stripes = break. */
function Month({ h, month, today, breaks }: { h: Habit; month: string; today: DayKey; breaks: Break[] }) {
  const toggleHabit = useStore((s) => s.toggleHabit)
  const first = `${month}-01`, last = addDays(`${shiftMonth(month, 1)}-01`, -1), born = dayKey(new Date(h.createdAt)), t = dailyTarget(h)
  const cells: DayKey[] = []
  for (let k = weekStart(first); k <= last || cells.length % 7; k = addDays(k, 1)) cells.push(k)
  return (
    <div className="cal">
      {CAL_DOW.map((d, i) => <span key={i}>{d}</span>)}
      {cells.map((k) => {
        if (k < first || k > last) return <i key={k} />
        const c = countOn(h, k), done = c >= t, brk = breaks.find((b) => b.from <= k && k <= b.to)
        const state = k > today ? 'future' : done ? 'done' : brk ? 'brk' : !isScheduled(h, k) || k < born ? 'off' : k === today ? 'now' : 'miss'
        return (
          <button key={k} disabled={k !== today} title={`${fmtDay(k)}${brk ? ` · ${brk.label}` : ''}${k < today ? ' · locked' : ''}`}
            className={`${state}${brk && done ? ' brk' : ''}${c && !done ? ' part' : ''}`} style={c && !done ? vars(h.color, (c / t) * 100) : undefined}
            onClick={(e) => { if (!done) burst(e.currentTarget, h.color); toggleHabit(h.id, k) }}>
            {+k.slice(8)}
            {done && <svg viewBox="0 0 10 10" aria-hidden><path pathLength={1} d="M2 2 8 8M8 2 2 8" /></svg>}
          </button>
        )
      })}
    </div>
  )
}

/** One-tap check-in for today. Count habits move one clip per tap. */
function Pill({ h, today, breaks, next }: { h: Habit; today: DayKey; breaks: Break[]; next: boolean }) {
  const { toggleHabit, countHabit } = useStore(useShallow((s) => ({ toggleHabit: s.toggleHabit, countHabit: s.countHabit })))
  const t = dailyTarget(h), c = countOn(h, today), done = c >= t, avoid = h.kind === 'avoid'
  const sched = isScheduled(h, today), y = addDays(today, -1)
  const slipped = sched && !done && isDue(h, y, breaks) && !h.log.includes(y)
  const sub = !sched ? 'rest day' : done ? (avoid ? '✓ resisted' : '✓ done') : t > 1 ? `${c}/${t} clips` : slipped ? 'never miss twice' : avoid ? 'resisted today?' : h.tiny ? `tiny: ${h.tiny}` : 'tap when done'
  const tap = (e: MouseEvent<HTMLButtonElement>) => {
    if (done) return toggleHabit(h.id, today)
    if (c + 1 >= t) burst(e.currentTarget, h.color)
    countHabit(h.id, today, 1)
  }
  return (
    <div className={`pill${done ? ' done' : ''}${next ? ' next' : ''}${slipped ? ' warn' : ''}${sched ? '' : ' rest'}`} style={vars(h.color, (c / t) * 100)}>
      <button disabled={!sched} onClick={tap} title={h.cue && `Cue: ${h.cue}`}><b>{h.title}</b><small>{sub}</small></button>
      <em>🔥 {streak(h, today, breaks)}</em>
      {t > 1 && c > 0 && <button className="undo" aria-label={`Undo one ${h.title}`} onClick={() => countHabit(h.id, today, -1)}>−</button>}
    </div>
  )
}

function HabitCard({ h, month, today, breaks, onEdit }: { h: Habit; month: string; today: DayKey; breaks: Break[]; onEdit: () => void }) {
  const t = dailyTarget(h), j = jar(h), avoid = h.kind === 'avoid'
  return (
    <div className="card habit" style={vars(h.color)}>
      <div className="row between">
        <div>
          <h3 className="link" onClick={onEdit}>{h.title}{avoid && <small className="kind-tag">resist</small>}</h3>
          <small className="muted">{h.cue && `${h.cue} → `}{h.tiny && `${avoid ? 'instead' : 'tiny'}: ${h.tiny}`}</small>
        </div>
        <span className="flame">🔥 {streak(h, today, breaks)}</span>
      </div>
      <Month h={h} month={month} today={today} breaks={breaks} />
      <div className="jars">
        {t > 1 && <Jars cap={t} moved={countOn(h, today)} title="Today’s clips" />}
        <Jars cap={j.goal} moved={j.moved} title={`${avoid ? 'Clean' : 'Done'} days${j.filled ? ` · ${j.filled} jar${j.filled > 1 ? 's' : ''} filled` : ''}`} />
      </div>
      <div className="row between mono small">
        <span title="Done on how many of the due days in the last 30 days">{strength(h, today, breaks)}% last 30 days</span>
        <span title="Atomic Habits: every action is a vote for the person you want to be">{h.log.length} votes · “{h.identity}”</span>
      </div>
    </div>
  )
}

export default function Currents() {
  const { habits, breaks } = useStore(useShallow((s) => ({ habits: s.habits, breaks: s.breaks })))
  const [edit, setEdit] = useState<Habit | 'new' | null>(null)
  const [showBreaks, setShowBreaks] = useState(false)
  const today = dayKey()
  const [month, setMonth] = useState(today.slice(0, 7))
  const groups = [habits.filter((h) => h.kind !== 'avoid'), habits.filter((h) => h.kind === 'avoid')]
  const ordered = groups.flat()
  const due = ordered.filter((h) => isDue(h, today, breaks)), doneN = due.filter((h) => h.log.includes(today)).length
  const next = ordered.find((h) => isScheduled(h, today) && !h.log.includes(today))?.id
  const now = breaks.find((b) => b.from <= today && today <= b.to)
  const soon = breaks.filter((b) => b.from > today && b.from <= addDays(today, 14)).sort((a, b) => a.from.localeCompare(b.from))[0]
  const title = now ? 'On break. Streaks frozen.' : !due.length ? 'Rest day.' : doneN === due.length ? 'Chain unbroken today.' : `${due.length - doneN} left today.`

  return (
    <>
      <Header no="01" tag={`CURRENTS · ${fmtDay(today, { weekday: 'long', day: 'numeric', month: 'long' })}`} title={title}
        sub="Tap a current once it’s done — only today can be ticked; past days are locked. The blank square is today’s cue; the chain of ✗s and the clip jars are the reward. Miss once, fine — never miss twice.">
        <button className="btn ghost" onClick={() => setShowBreaks(true)}>🌴 Breaks{breaks.length ? ` (${breaks.length})` : ''}</button>
        <button className="btn" onClick={() => setEdit('new')}>+ New current</button>
      </Header>
      <section className="card today">
        {habits.length > 0 && <Ring done={doneN} total={due.length} />}
        <div className="stack">
          {now && <p className="banner">🌴 {now.label} until {fmtDay(now.to)} — break days never count as misses. Anything you still do is a bonus.</p>}
          {!now && soon && <p className="banner">🌴 {soon.label} starts {fmtDay(soon.from)} — streaks will freeze automatically.</p>}
          {groups.map((g, i) => g.length > 0 && (
            <div key={i}>
              <div className="pills-label">{i ? 'Resist' : 'Build'}</div>
              <div className="pills">{g.map((h) => <Pill key={h.id} h={h} today={today} breaks={breaks} next={h.id === next} />)}</div>
            </div>
          ))}
          {!habits.length && <p className="muted big">No currents yet. Start with something embarrassingly small.</p>}
        </div>
      </section>
      {habits.length > 0 && (
        <div className="row between cal-nav">
          <h3>The chain</h3>
          <div className="row">
            <button className="icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <b className="mono">{fmtDay(`${month}-01`, { month: 'long', year: 'numeric' })}</b>
            <button className="icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
        </div>
      )}
      <div className="habits">
        {ordered.map((h) => <HabitCard key={h.id} h={h} month={month} today={today} breaks={breaks} onEdit={() => setEdit(h)} />)}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New current' : 'Edit current'}>
        {edit && <HabitForm habit={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} />}
      </Modal>
      <Modal open={showBreaks} onClose={() => setShowBreaks(false)} title="Breaks">
        <BreaksForm />
      </Modal>
    </>
  )
}
