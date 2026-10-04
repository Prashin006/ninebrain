import { useState } from 'react'
import { Link } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { EMPTY_DAY, useStore } from '../store'
import { Header } from '../ui'
import { addDays, chroma, dayKey, fmtTime, improvements, isDue, sonar, weekDays, weekStart } from '../lib'
import type { Kept } from '../types'

const Scale = ({ label, low, high, value, locked, onPick }: { label: string; low: string; high: string; value?: number; locked: boolean; onPick: (n: number) => void }) => (
  <div className="field">{label}
    <div className="row">{[1, 2, 3, 4, 5].map((n) => <button key={n} disabled={locked} className={`chip ${value === n ? 'on' : ''}`} onClick={() => onPick(n)}>{n}</button>)}</div>
    <small className="muted">1 = {low} · 5 = {high}</small>
  </div>
)

const savedAt = (t: number) => { const d = new Date(t); return fmtTime(d.getHours() * 60 + d.getMinutes()) }
const SaveBar = ({ at, ready, label, onSave, onEdit }: { at?: number; ready: boolean; label: string; onSave: () => void; onEdit: () => void }) =>
  at ? <div className="row between saved"><span>✓ Saved at {savedAt(at)}</span><button className="btn ghost" onClick={onEdit}>Edit</button></div>
    : <button className="btn" disabled={!ready} onClick={onSave}>{label}</button>

const VERDICTS: [Kept, string][] = [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'Not yet']]

export default function Surface() {
  const s = useStore(useShallow((s) => ({ days: s.days, reviews: s.reviews, blots: s.blots, arms: s.arms, habits: s.habits, breaks: s.breaks, dives: s.dives, tasks: s.tasks, setDay: s.setDay, add: s.add, patch: s.patch })))
  const [tab, setTab] = useState<'today' | 'week'>('today')
  const [r, setR] = useState({ well: '', drained: '', change: '' })
  const today = dayKey()
  const log = { ...EMPTY_DAY, ...s.days[today] }
  const up = (p: Partial<typeof log>) => s.setDay(today, p)
  const ws = weekStart(today)
  const week = weekDays(today)
  const habitRate = (() => {
    let due = 0, done = 0
    for (const h of s.habits) for (const k of week) if (k <= today && isDue(h, k, s.breaks)) { due++; if (h.log.includes(k)) done++ }
    return due ? Math.round((done / due) * 100) : 0
  })()
  const diveH = s.dives.filter((d) => dayKey(new Date(d.startedAt)) >= ws).reduce((a, d) => a + d.minutes, 0) / 60
  const doneTasks = s.tasks.filter((t) => t.doneAt && dayKey(new Date(t.doneAt)) >= ws).length
  const weekLogs = week.map((k) => s.days[k]).filter((d) => d?.energy && d?.mood)
  const avgEnergy = weekLogs.length ? weekLogs.reduce((n, d) => n + (d.energy ?? 0), 0) / weekLogs.length : 0
  const avgMood = weekLogs.length ? weekLogs.reduce((n, d) => n + (d.mood ?? 0), 0) / weekLogs.length : 0
  const area = (k: 'wins' | 'drains' | 'better', label: string, ph = '') => (
    <label className="field">{label}<textarea rows={2} disabled={!!log.sinkAt} placeholder={ph} value={log[k]} onChange={(e) => up({ [k]: e.target.value })} /></label>
  )
  const yKey = addDays(today, -1), yLog = s.days[yKey]
  const imp = improvements(s.days, week)

  return (
    <>
      <Header no="08" tag="SURFACE · reviews" title="Come up for air." sub="Your journal. Morning: rate energy & mood, pick today’s top 3. Evening: what went well, what drained you, one small fix for tomorrow. Weekly: a guided review of everything.">
        <button className={`btn ${tab === 'today' ? '' : 'ghost'}`} onClick={() => setTab('today')}>Today</button>
        <button className={`btn ${tab === 'week' ? '' : 'ghost'}`} onClick={() => setTab('week')}>Low tide (weekly)</button>
      </Header>

      {tab === 'today' ? (
        <div className="grid2">
          <div className="card">
            <h3>☀ Morning check-in</h3>
            {yLog?.better?.trim() && (
              <div className="promise">
                <small className="specimen">Yesterday’s 1% promise</small>
                <p>“{yLog.better}”</p>
                <div className="row">Did you do it?
                  {VERDICTS.map(([v, l]) => <button key={v} className={`chip ${yLog.betterKept === v ? 'on' : ''}`} onClick={() => s.setDay(yKey, { betterKept: v })}>{l}</button>)}
                </div>
              </div>
            )}
            <Scale label="Energy" low="drained" high="energised" value={log.energy} locked={!!log.riseAt} onPick={(n) => up({ energy: n })} />
            <Scale label="Mood" low="very low" high="very good" value={log.mood} locked={!!log.riseAt} onPick={(n) => up({ mood: n })} />
            {log.mood && <div className="row"><span className="swatch big" style={{ background: chroma(log.energy, log.mood) }} /><small className="muted">Mood chooses the colour; energy controls how bright it is. Otto wears it on the Den today.</small></div>}
            <div className="mood-legend">
              {['very low', 'low', 'steady', 'good', 'very good'].map((label, i) => <span key={label}><i style={{ background: chroma(3, i + 1) }} />{label}</span>)}
            </div>
            <div className="field">Today’s top 3
              {log.beats.map((b, i) => <input key={i} disabled={!!log.riseAt} value={b} placeholder={`${i + 1}.`} onChange={(e) => up({ beats: log.beats.map((x, j) => (j === i ? e.target.value : x)) })} />)}
            </div>
            <SaveBar at={log.riseAt} ready={!!log.energy && !!log.mood} label="Save morning check-in" onSave={() => up({ riseAt: Date.now() })} onEdit={() => up({ riseAt: undefined })} />
          </div>
          <div className="card">
            <h3>☾ Evening review</h3>
            {area('wins', 'What went well?')}
            {area('drains', 'What drained you?')}
            {area('better', '1% better tomorrow: one small, checkable action', 'e.g. Phone in another room until 10:00')}
            <small className="muted">Tomorrow morning you’ll be asked whether you did it. That answer is what gets counted.</small>
            <SaveBar at={log.sinkAt} ready={!!(log.wins || log.drains || log.better)} label="Save evening review" onSave={() => up({ sinkAt: Date.now() })} onEdit={() => up({ sinkAt: undefined })} />
            <div className="chroma-strip" title="Last 30 days of mood colour">
              {Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((k) => {
                const d = s.days[k]
                return <i key={k} title={`${k}${d?.mood ? ` · mood ${d.mood}/5 · energy ${d.energy}/5` : ' · not logged'}`} style={{ background: d?.mood ? chroma(d.energy, d.mood) : undefined }} />
              })}
            </div>
            <small className="muted">Each bar is one day. Hover it for that day’s mood and energy.</small>
          </div>
        </div>
      ) : (
        <div className="grid2">
          <div className="card">
            <h3>Weekly review <span className="muted">· “Low tide”</span></h3>
            <p className="muted small">Low tide is simply the end-of-week review: zoom out, clear loose ends, inspect projects and habits, then prepare next week.</p>
            <p><b>This week:</b> {weekLogs.length ? `mood ${avgMood.toFixed(1)}/5 · energy ${avgEnergy.toFixed(1)}/5 across ${weekLogs.length} logged day${weekLogs.length === 1 ? '' : 's'}.` : 'No mood or energy entries yet.'}</p>
            <ol className="steps">
              <li>Empty the ink — <Link to="/ink">{s.blots.length} blots left</Link></li>
              <li>Walk each arm: keep, pause, or finish?
                {s.arms.filter((a) => a.status === 'active').map((a) => (
                  <div key={a.id} className="row between small"><Link to={`/arms/${a.id}`}>{a.title}</Link>
                    <span className="row"><button className="chip" onClick={() => s.patch('arms', a.id, { status: 'clutch' })}>pause</button><button className="chip" onClick={() => s.patch('arms', a.id, { status: 'midden' })}>done</button></span>
                  </div>
                ))}
              </li>
              <li>Currents this week: <b>{habitRate}%</b> — make the weakest one easier.</li>
              <li>1% improvements: <b>{imp.kept} of {imp.made}</b> kept{imp.judged < imp.made ? ` (${imp.made - imp.judged} not answered yet)` : ''}.</li>
              <li>Dived <b>{diveH.toFixed(1)}h</b>, finished <b>{doneTasks}</b> tasks.</li>
              <li><Link to="/tides">Chart next week’s tides →</Link></li>
            </ol>
          </div>
          <div className="card">
            <h3>Reflect</h3>
            <label className="field">What went well?<textarea rows={2} value={r.well} onChange={(e) => setR({ ...r, well: e.target.value })} /></label>
            <label className="field">What drained you?<textarea rows={2} value={r.drained} onChange={(e) => setR({ ...r, drained: e.target.value })} /></label>
            <label className="field">One system change for next week<textarea rows={2} value={r.change} onChange={(e) => setR({ ...r, change: e.target.value })} /></label>
            <button className="btn" onClick={() => { s.add('reviews', { weekStart: ws, at: Date.now(), ...r }); setR({ well: '', drained: '', change: '' }) }}>Log low tide</button>
            {[...s.reviews].reverse().slice(0, 4).map((x) => <p key={x.id} className="small muted">Week of {x.weekStart}: {x.change || x.well}</p>)}
          </div>
          <Sonar week={ws} />
        </div>
      )}
    </>
  )
}

function Sonar({ week }: { week: string }) {
  const d = useStore(useShallow((s) => ({ arms: s.arms, blocks: s.blocks, dives: s.dives, tasks: s.tasks })))
  const { rows, unaimed } = sonar(d, week)
  const max = Math.max(60, ...rows.flatMap((r) => [r.planned, r.dived]))
  const h = (m: number) => `${(m / 60).toFixed(1)}h`
  return (
    <div className="card sonar">
      <h3>Sonar <span className="muted">· planned vs actually dived, per arm</span></h3>
      {rows.map(({ arm, planned, dived, landed }) => (
        <div key={arm.id} className="sonar-row" style={{ ['--c' as string]: arm.color }}>
          <Link to={`/arms/${arm.id}`}>{arm.title}</Link>
          <div className="bars">
            <i className="plan" style={{ width: `${(planned / max) * 100}%` }} title={`planned ${h(planned)}`} />
            <i className="real" style={{ width: `${(dived / max) * 100}%` }} title={`dived ${h(dived)}`} />
          </div>
          <small className="mono">{h(dived)} / {h(planned)} · {landed} landed</small>
        </div>
      ))}
      <p className="small muted">Outline = planned in Tides · solid = dived. {unaimed > 0 && `${h(unaimed)} of blocks served no arm.`}</p>
    </div>
  )
}
