import type { Break, Data, DayKey, Habit } from './types'

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d = new Date()): DayKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromKey = (k: DayKey) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (k: DayKey, n: number) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d) }
/** Monday-based week start */
export const weekStart = (k: DayKey) => addDays(k, -((fromKey(k).getDay() + 6) % 7))
export const weekDays = (k: DayKey) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(k), i))
export const fmtTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
export const fmtDay = (k: DayKey, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  fromKey(k).toLocaleDateString(undefined, o)
export const daysSince = (t: number) => Math.floor((Date.now() - t) / 86_400_000)

export const PALETTE = ['#3df5d3', '#ff4fd8', '#ffb547', '#8b7bff', '#ff6b5a', '#5ad1ff', '#b6ff5a', '#ff9ec7']
export const MAX_ARMS = 8

/* ---------- Currents (habits) ---------- */
export const onBreak = (breaks: Break[], k: DayKey) => breaks.some((b) => b.from <= k && k <= b.to)
export const isScheduled = (h: Habit, k: DayKey) => h.days.includes(fromKey(k).getDay())
/** Break days are never due, so they can't break a streak or dent strength. */
export const isDue = (h: Habit, k: DayKey, breaks: Break[] = []) => isScheduled(h, k) && !onBreak(breaks, k)
export const dailyTarget = (h: Habit) => (h.kind === 'avoid' ? 1 : Math.max(1, h.target ?? 1))
export const countOn = (h: Habit, k: DayKey) => (h.log.includes(k) ? dailyTarget(h) : Math.min(h.counts?.[k] ?? 0, dailyTarget(h)))

/** Set a day's rep count; reaching the daily target logs the day as done. */
export function withCount(h: Habit, k: DayKey, n: number): Habit {
  const t = dailyTarget(h), c = Math.max(0, Math.min(t, n))
  const log = h.log.filter((x) => x !== k), counts = { ...h.counts }
  delete counts[k]
  if (c >= t) log.push(k)
  else if (c) counts[k] = c
  return { ...h, log, counts }
}

/** Paper-clip jar: clips moved toward the current goal, plus jars already filled. */
export function jar(h: Habit) {
  const goal = Math.max(1, h.goal ?? 66), n = h.log.length
  return { goal, moved: n % goal, filled: Math.floor(n / goal) }
}

/** Consecutive due days completed; today doesn't break the streak until it's over. */
export function streak(h: Habit, today = dayKey(), breaks: Break[] = []) {
  const done = new Set(h.log)
  let k = done.has(today) || !isDue(h, today, breaks) ? today : addDays(today, -1)
  let n = 0
  for (let i = 0; i < 400; i++, k = addDays(k, -1)) {
    if (!isDue(h, k, breaks)) continue
    if (!done.has(k)) break
    n++
  }
  return n
}

/** % of due days done in the last 30 days (only counting days since the habit was created). */
export function strength(h: Habit, today = dayKey(), breaks: Break[] = []) {
  const done = new Set(h.log), born = dayKey(new Date(h.createdAt))
  let due = 0, hit = 0
  for (let i = 0; i < 30; i++) {
    const k = addDays(today, -i)
    if (k < born || !isDue(h, k, breaks) || (i === 0 && !done.has(k))) continue // today only counts once done
    due++; if (done.has(k)) hit++
  }
  return due ? Math.round((hit / due) * 100) : 0
}

/* ---------- Dive (focus) ---------- */
export const M_PER_MIN = 120
export const ZONES = [
  { from: 0, name: 'Sunlight zone', latin: 'Epipelagic', bg: '#0b3b5c' },
  { from: 200, name: 'Twilight zone', latin: 'Mesopelagic', bg: '#082540' },
  { from: 1000, name: 'Midnight zone', latin: 'Bathypelagic', bg: '#04142a' },
  { from: 4000, name: 'The Abyss', latin: 'Abyssopelagic', bg: '#020a18' },
  { from: 6000, name: 'The Trenches', latin: 'Hadalpelagic', bg: '#01040b' },
]
export const CREATURES = [
  { at: 300, what: 'a school of lanternfish' },
  { at: 700, what: 'a barreleye fish with a see-through head' },
  { at: 1000, what: 'a vampire squid (it is neither)' },
  { at: 1800, what: 'an anglerfish dangling its lure' },
  { at: 2500, what: 'a dumbo octopus — Otto’s cousin' },
  { at: 4200, what: 'a herd of sea pigs' },
  { at: 5000, what: 'a tripod fish standing on its fins' },
  { at: 8000, what: 'a snailfish, the deepest fish ever filmed' },
  { at: 10900, what: 'Challenger Deep. Nothing is deeper. Neither are you.' },
]
export const zoneAt = (m: number) => [...ZONES].reverse().find((z) => m >= z.from)!
export function diveElapsedMs(d: { startedAt: number; pausedAt?: number; pausedMs: number }, now = Date.now()) {
  return (d.pausedAt ?? now) - d.startedAt - d.pausedMs
}

/* ---------- Chroma: mood + energy → octopus skin colour ---------- */
export function chroma(energy = 3, mood = 3) {
  const hues = [220, 195, 165, 38, 8] // blue → teal → green → gold → coral
  return `hsl(${hues[Math.max(1, Math.min(5, mood)) - 1]} ${35 + energy * 10}% ${28 + energy * 6}%)`
}

/* ---------- Coral map: tiny deterministic force-directed layout ---------- */
export function layoutGraph(n: number, edges: [number, number][], size = 1000, iters = 300) {
  const p = Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996, r = 40 + 30 * Math.sqrt(i) // golden-angle spiral seed
    return { x: size / 2 + Math.cos(a) * r, y: size / 2 + Math.sin(a) * r }
  })
  const k = Math.sqrt((size * size) / Math.max(1, n)) * 0.6
  for (let it = 0; it < iters; it++) {
    const cool = 1 - it / iters
    const d = p.map(() => ({ x: 0, y: 0 }))
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, dist = Math.max(1, Math.hypot(dx, dy))
      const f = (k * k) / dist / dist
      d[i].x += dx * f; d[i].y += dy * f; d[j].x -= dx * f; d[j].y -= dy * f
    }
    for (const [a, b] of edges) {
      const dx = p[a].x - p[b].x, dy = p[a].y - p[b].y, dist = Math.max(1, Math.hypot(dx, dy))
      const f = dist / k
      d[a].x -= dx * f * 0.5; d[a].y -= dy * f * 0.5; d[b].x += dx * f * 0.5; d[b].y += dy * f * 0.5
    }
    for (let i = 0; i < n; i++) {
      d[i].x += (size / 2 - p[i].x) * 0.02; d[i].y += (size / 2 - p[i].y) * 0.02 // gravity
      const len = Math.max(1, Math.hypot(d[i].x, d[i].y)), step = Math.min(len, 30 * cool + 1)
      p[i].x = Math.min(size - 40, Math.max(40, p[i].x + (d[i].x / len) * step))
      p[i].y = Math.min(size - 40, Math.max(40, p[i].y + (d[i].y / len) * step))
    }
  }
  return p
}

/** First free slot today (15-min grid) of `dur` minutes, starting from now. */
export function freeSlot(blocks: { day: DayKey; start: number; dur: number }[], day: DayKey, dur: number, from: number, until: number) {
  const busy = blocks.filter((b) => b.day === day).sort((a, b) => a.start - b.start)
  let t = Math.ceil(from / 15) * 15
  for (const b of busy) {
    if (b.start + b.dur <= t) continue
    if (b.start - t >= dur) break
    t = Math.max(t, Math.ceil((b.start + b.dur) / 15) * 15)
  }
  return t + dur <= until ? t : null
}

/** Sonar: per-arm planned (Tides) vs actual (Dive) minutes and tasks landed for a week. */
export function sonar(d: Pick<Data, 'arms' | 'blocks' | 'dives' | 'tasks'>, week: DayKey) {
  const days = new Set(weekDays(week))
  const inWeek = (t?: number) => !!t && days.has(dayKey(new Date(t)))
  const rows = d.arms.filter((a) => a.status === 'active').map((a) => ({
    arm: a,
    planned: d.blocks.filter((b) => b.armId === a.id && days.has(b.day)).reduce((s, b) => s + b.dur, 0),
    dived: d.dives.filter((x) => x.armId === a.id && inWeek(x.startedAt)).reduce((s, x) => s + x.minutes, 0),
    landed: d.tasks.filter((t) => t.armId === a.id && t.done && inWeek(t.doneAt)).length,
  }))
  const unaimed = d.blocks.filter((b) => !b.armId && days.has(b.day) && b.kind !== 'break').reduce((s, b) => s + b.dur, 0)
  return { rows, unaimed }
}

/** 1% loop: improvements promised on these days, and how many were kept (partly = half). */
export function improvements(days: Data['days'], keys: DayKey[]) {
  const made = keys.map((k) => days[k]).filter((d) => d?.better?.trim())
  const judged = made.filter((d) => d.betterKept)
  const kept = judged.reduce((s, d) => s + (d.betterKept === 'yes' ? 1 : d.betterKept === 'partly' ? 0.5 : 0), 0)
  return { made: made.length, judged: judged.length, kept }
}

/* ---------- Otto's whispers: rule-based nudges (future AI hook) ---------- */
export interface Whisper { tone: 'info' | 'warn' | 'yay'; text: string; to: string }
export function whispers(d: Data, now = new Date()): Whisper[] {
  const out: Whisper[] = []
  const today = dayKey(now)
  const active = d.arms.filter((a) => a.status === 'active')
  if (d.blots.length) out.push({ tone: 'warn', text: `${d.blots.length} blot${d.blots.length > 1 ? 's' : ''} of ink clouding the water. Triage them.`, to: '/ink' })
  if (!d.days[today]?.riseAt) out.push({ tone: 'info', text: 'Morning check-in not saved yet. How are your energy and mood?', to: '/surface' })
  const prev = d.days[addDays(today, -1)]
  if (prev?.better?.trim() && !prev.betterKept) out.push({ tone: 'info', text: `Did you keep yesterday’s 1%: “${prev.better}”?`, to: '/surface' })
  for (const a of active) {
    if (!d.tasks.some((t) => t.armId === a.id && !t.done)) out.push({ tone: 'warn', text: `Arm “${a.title}” has nothing to grab. Give it a next action.`, to: `/arms/${a.id}` })
    else if (daysSince(a.touchedAt) >= 10) out.push({ tone: 'warn', text: `Arm “${a.title}” has gone limp (${daysSince(a.touchedAt)} days). Still alive, or back to the clutch?`, to: `/arms/${a.id}` })
  }
  if (active.length >= MAX_ARMS) out.push({ tone: 'info', text: 'All eight arms are busy. Finish something before growing another.', to: '/arms' })
  const eggs = d.arms.filter((a) => a.status === 'clutch').length
  if (active.length < MAX_ARMS && eggs) out.push({ tone: 'info', text: `${MAX_ARMS - active.length} free arm(s), ${eggs} egg(s) waiting to hatch.`, to: '/arms' })
  const planned = d.blocks.filter((b) => b.day === today && b.kind !== 'break').reduce((s, b) => s + b.dur, 0)
  if (planned > d.settings.capacityH * 60) out.push({ tone: 'warn', text: `Flood warning: ${(planned / 60).toFixed(1)}h planned vs ${d.settings.capacityH}h capacity.`, to: '/tides' })
  if (!planned && now.getHours() < 14) out.push({ tone: 'info', text: 'Today’s tide chart is empty. Block some time before the day blocks you.', to: '/tides' })
  const yesterday = addDays(today, -1)
  for (const h of d.habits) {
    const s = streak(h, today, d.breaks)
    if (isDue(h, yesterday, d.breaks) && !h.log.includes(yesterday) && isDue(h, today, d.breaks) && !h.log.includes(today))
      out.push({ tone: 'warn', text: `Never miss twice: “${h.title}” slipped yesterday. Do the tiny version: ${h.tiny || 'just start'}.`, to: '/' })
    else if ([7, 21, 30, 66, 100].includes(s)) out.push({ tone: 'yay', text: `“${h.title}” streak hit ${s}. That’s ${s} votes for “${h.identity}”.`, to: '/' })
  }
  const last = Math.max(0, ...d.reviews.map((r) => r.at))
  if (daysSince(last) >= 7) out.push({ tone: 'warn', text: 'Low tide is overdue. Do your weekly review.', to: '/surface' })
  return out
}
