import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Header, Markdown } from '../ui'
import { PALETTE, layoutGraph } from '../lib'
import type { Note } from '../types'

const links = (body: string) => [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].toLowerCase())

/** Notes + tags as a living graph; wikilinks and shared tags become edges. */
function CoralMap({ notes, onPick }: { notes: Note[]; onPick: (id: string) => void }) {
  const g = useMemo(() => {
    const tags = [...new Set(notes.flatMap((n) => n.tags))]
    const idx = new Map(notes.map((n, i) => [n.title.toLowerCase(), i]))
    const edges: [number, number][] = []
    notes.forEach((n, i) => {
      links(n.body).forEach((t) => { const j = idx.get(t); if (j !== undefined && j !== i) edges.push([i, j]) })
      n.tags.forEach((t) => edges.push([i, notes.length + tags.indexOf(t)]))
    })
    return { tags, edges, pos: layoutGraph(notes.length + tags.length, edges) }
  }, [notes])
  const deg = (i: number) => g.edges.filter(([a, b]) => a === i || b === i).length
  if (!notes.length) return <p className="muted big">No coral yet.</p>
  return (
    <div className="card coral">
      <svg viewBox="0 0 1000 1000" role="img" aria-label="Coral map of notes">
        {g.edges.map(([a, b], k) => (
          <path key={k} className={b >= notes.length ? 'edge tag' : 'edge'} pathLength={b >= notes.length ? undefined : 1}
            d={`M${g.pos[a].x},${g.pos[a].y} Q${(g.pos[a].x + g.pos[b].x) / 2 + 30},${(g.pos[a].y + g.pos[b].y) / 2 - 30} ${g.pos[b].x},${g.pos[b].y}`} />
        ))}
        {g.tags.map((t, k) => {
          const p = g.pos[notes.length + k]
          return <g key={t} className="node tag" style={{ animationDelay: `${k * 40}ms` }}><circle cx={p.x} cy={p.y} r={8} fill={PALETTE[k % 8]} /><text x={p.x} y={p.y - 14}>#{t}</text></g>
        })}
        {notes.map((n, i) => {
          const p = g.pos[i], r = 12 + Math.min(18, deg(i) * 4)
          return (
            <g key={n.id} className="node" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onPick(n.id)}>
              <circle cx={p.x} cy={p.y} r={r} />
              <text x={p.x} y={p.y + r + 22}>{n.title.length > 24 ? n.title.slice(0, 23) + '…' : n.title}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Idea vault with [[wikilinks]], backlinks and tag filtering. */
export default function Reef() {
  const { notes, add, patch, remove } = useStore(useShallow((s) => ({ notes: s.notes, add: s.add, patch: s.patch, remove: s.remove })))
  const [sel, setSel] = useState(notes[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [preview, setPreview] = useState(true)
  const [map, setMap] = useState(false)
  const note = notes.find((n) => n.id === sel)
  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes])
  const list = notes
    .filter((n) => (!tag || n.tags.includes(tag)) && (n.title + n.body).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const backlinks = note ? notes.filter((n) => n.id !== note.id && n.body.toLowerCase().includes(`[[${note.title.toLowerCase()}]]`)) : []

  const spawn = (title = 'Untitled coral') => { const id = add('notes', { title, body: '', tags: [], updatedAt: Date.now() }); setSel(id); setPreview(false) }
  const follow = (title: string) => {
    const hit = notes.find((n) => n.title.toLowerCase() === title.toLowerCase())
    if (hit) setSel(hit.id)
    else spawn(title)
  }
  const up = (p: Parameters<typeof patch<'notes'>>[2]) => note && patch('notes', note.id, { ...p, updatedAt: Date.now() })

  return (
    <>
      <Header no="07" tag="REEF · notes" title="Grow the reef." sub="Your notes and ideas. Write anything worth keeping. Type [[Another note title]] inside a note to link the two; Coral map shows how your ideas connect.">
        <button className="btn ghost" onClick={() => setMap(!map)}>{map ? 'List view' : 'Coral map'}</button>
        <button className="btn" onClick={() => { spawn(); setMap(false) }}>+ New coral</button>
      </Header>
      {map ? <CoralMap notes={notes} onPick={(id) => { setSel(id); setPreview(true); setMap(false) }} /> : (
      <div className="reef">
        <div className="card list">
          <input placeholder="Search the reef…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row wrap">{tags.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? '' : t)}>#{t}</button>)}</div>
          {list.map((n) => (
            <button key={n.id} className={`note-item ${n.id === sel ? 'on' : ''}`} onClick={() => setSel(n.id)}>
              <b>{n.title}</b><small className="muted">{n.body.slice(0, 70)}</small>
            </button>
          ))}
        </div>
        {note ? (
          <div className="card editor">
            <div className="row between">
              <input className="title-input" value={note.title} onChange={(e) => up({ title: e.target.value })} />
              <span className="row">
                <button className="btn ghost" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
                <button className="icon" title="Delete" onClick={() => { remove('notes', note.id); setSel('') }}>×</button>
              </span>
            </div>
            <input placeholder="tags, comma separated" value={note.tags.join(', ')} onChange={(e) => up({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            {preview ? <Markdown text={note.body || '*Empty coral. Click Edit.*'} onLink={follow} />
              : <textarea autoFocus rows={16} value={note.body} onChange={(e) => up({ body: e.target.value })} placeholder={'# Heading\n- bullets, **bold**, *italic*, `code`\n[[Another note]]'} />}
            {backlinks.length > 0 && (
              <div><div className="specimen">Linked from</div>{backlinks.map((b) => <button key={b.id} className="chip" onClick={() => setSel(b.id)}>{b.title}</button>)}</div>
            )}
          </div>
        ) : <p className="muted big">Pick a coral, or grow a new one.</p>}
      </div>
      )}
    </>
  )
}
