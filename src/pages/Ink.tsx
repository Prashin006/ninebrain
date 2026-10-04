import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Header, burst } from '../ui'
import { MAX_ARMS, PALETTE, dayKey } from '../lib'

/** Brain dump → one-blot-at-a-time triage with single-key shortcuts. */
export default function Ink() {
  const { blots, arms, tasks, processed } = useStore(useShallow((s) => ({ blots: s.blots, arms: s.arms, tasks: s.tasks, processed: s.processed })))
  const { add, patch, triage, remove } = useStore(useShallow((s) => ({ add: s.add, patch: s.patch, triage: s.triage, remove: s.remove })))
  const [dump, setDump] = useState('')
  const [armId, setArmId] = useState('')
  const [result, setResult] = useState('')
  const blot = blots[0]
  const active = arms.filter((a) => a.status === 'active')
  const loose = tasks.filter((t) => !t.armId)
  const now = Date.now()

  const actions: Record<string, { label: string; run: () => void }> = {
    t: { label: 'Task', run: () => add('tasks', { title: blot.text, armId: armId || undefined, done: false, createdAt: now }) },
    i: { label: 'Idea → Reef', run: () => add('notes', { title: blot.text.slice(0, 60), body: blot.text, tags: ['inbox'], updatedAt: now }) },
    p: { label: 'Project egg', run: () => add('arms', { title: blot.text, purpose: '', color: PALETTE[arms.length % 8], status: active.length < MAX_ARMS ? 'active' : 'clutch', createdAt: now, touchedAt: now }) },
    h: { label: 'Habit', run: () => add('habits', { title: blot.text, identity: 'I am someone who does this', cue: '', tiny: '', days: [0, 1, 2, 3, 4, 5, 6], color: PALETTE[2], log: [], createdAt: now }) },
    s: { label: 'Schedule today', run: () => add('blocks', { day: dayKey(), start: Math.min(22 * 60, Math.ceil((new Date().getHours() * 60 + new Date().getMinutes() + 15) / 15) * 15), dur: 30, title: blot.text, kind: 'shallow' }) },
    x: { label: 'Dissolve', run: () => undefined },
  }
  const act = (k: string) => {
    if (!blot || !actions[k]) return
    const text = blot.text
    actions[k].run(); triage(blot.id)
    if (k === 't') setResult(`Saved “${text}” as ${armId ? `a task in ${active.find((a) => a.id === armId)?.title}` : 'a loose task below'}.`)
    else setResult(k === 'x' ? 'Dissolved.' : `Saved “${text}”.`)
    burst(document.querySelector('.blot'), k === 'x' ? '#6b819c' : '#ff4fd8')
  }

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select') || e.ctrlKey || e.metaKey) return
      act(e.key.toLowerCase())
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  })

  const pour = () => {
    dump.split('\n').map((l) => l.trim()).filter(Boolean).forEach((text) => add('blots', { text, createdAt: Date.now() }))
    setDump('')
  }

  return (
    <>
      <Header no="03" tag="INK · brain dump" title="Squirt the ink." sub="Your inbox. Dump every thought here, one per line, without thinking. Then sort each one with a single key: is it a task, an idea, a project, a habit… or nothing?" />
      <div className="grid2">
        <div className="card">
          <h3>Dump</h3>
          <textarea rows={12} value={dump} onChange={(e) => setDump(e.target.value)} placeholder={'buy coffee\nthat idea about the podcast\nwhy am I anxious about Q3?\n…'}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) pour() }} />
          <div className="row between"><small className="muted">Ctrl+Enter to pour · {processed[dayKey()] ?? 0} sorted today</small><button className="btn" onClick={pour}>Pour into the water</button></div>
        </div>
        <div className="card triage">
          <h3>Triage {blots.length > 0 && <span className="muted">· {blots.length} left</span>}</h3>
          {blot ? (
            <>
              <div key={blot.id} className="blot">{blot.text}</div>
              <label className="field">Task goes to arm
                <select value={armId} onChange={(e) => setArmId(e.target.value)}>
                  <option value="">— loose (no arm) —</option>
                  {active.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </label>
              <div className="keys">
                {Object.entries(actions).map(([k, a]) => <button key={k} className={`btn ghost ${k === 'x' ? 'danger' : ''}`} onClick={() => act(k)}><kbd>{k.toUpperCase()}</kbd> {a.label}</button>)}
              </div>
            </>
          ) : <p className="muted big">Clear water. Inbox zero. Otto approves.</p>}
          {blots.slice(1, 8).map((b) => <div key={b.id} className="row between queued"><span>{b.text}</span><button className="icon" onClick={() => remove('blots', b.id)}>×</button></div>)}
          {result && <p className="whisper">{result}</p>}
        </div>
      </div>
      <div className="card loose-tasks">
        <h3>Loose tasks <span className="muted">· {loose.length} not assigned to a project</span></h3>
        <p className="muted small">A task saved with “loose (no arm)” waits here. Assign it to a project, complete it, or delete it.</p>
        {loose.map((task) => (
          <div key={task.id} className={`row between task ${task.done ? 'done' : ''}`}>
            <label className="row check">
              <input type="checkbox" checked={task.done} onChange={() => patch('tasks', task.id, { done: !task.done, doneAt: task.done ? undefined : Date.now() })} />
              {task.title}
            </label>
            <span className="row">
              <select aria-label={`Assign ${task.title} to a project`} value="" onChange={(e) => patch('tasks', task.id, { armId: e.target.value || undefined })}>
                <option value="">Assign to project…</option>
                {active.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <button className="icon" title="Delete task" onClick={() => remove('tasks', task.id)}>×</button>
            </span>
          </div>
        ))}
        {!loose.length && <p className="muted">No loose tasks.</p>}
      </div>
    </>
  )
}
