// Shared by the browser (UX) and the server (enforcement): history is append-only.
import type { Break, Data, DayKey, Habit } from '../src/types.js'

const D = 86_400_000
export const BREAK_NOTICE_DAYS = 7

/** Shift a YYYY-MM-DD key by n calendar days (timezone-free). */
export const shift = (k: DayKey, n: number) => new Date(Date.parse(`${k}T00:00:00Z`) + n * D).toISOString().slice(0, 10)
const isDay = (k: unknown): k is DayKey => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(Date.parse(k)) && shift(k, 0) === k
export const breakFloor = (today: DayKey) => shift(today, BREAK_NOTICE_DAYS)

const isStrings = (x: unknown) => Array.isArray(x) && x.every((k) => typeof k === 'string')
/** Minimal shape check for the parts the lock relies on. */
export function isDoc(d: unknown): d is Data {
  if (!d || typeof d !== 'object') return false
  const { habits, breaks } = d as Partial<Data>
  return Array.isArray(habits) && habits.every((h) => h && typeof h.id === 'string' && isStrings(h.log) && typeof h.createdAt === 'number'
    && (h.counts === undefined || (typeof h.counts === 'object' && h.counts !== null)))
    && (breaks === undefined || (Array.isArray(breaks) && breaks.every((b) => b && typeof b.id === 'string')))
}

const canon = (h: Habit) => JSON.stringify([[...new Set(h.log)].sort(), Object.entries(h.counts ?? {}).sort(), h.createdAt])
const canonBreaks = (bs: Break[]) => JSON.stringify([...bs].sort((a, b) => a.id.localeCompare(b.id)))

/**
 * Revert illegal edits in `next` relative to `prev`:
 * - habit days outside [today - slack, today + slack] keep their previous state (no back-filling, no pre-filling);
 * - new habits can't be back-dated;
 * - existing breaks are permanent; new ones must start ≥ BREAK_NOTICE_DAYS ahead.
 */
export function lockHistory(prev: Data | null, next: Data, today: DayKey, slack = 0, now = Date.now()) {
  const lo = shift(today, -slack), hi = shift(today, slack)
  const open = (k: string) => lo <= k && k <= hi
  const old = new Map((prev?.habits ?? []).map((h) => [h.id, h]))
  const habits = next.habits.map((h) => {
    const p = old.get(h.id)
    const locked: Habit = {
      ...h,
      log: [...new Set([...(p?.log ?? []).filter((k) => !open(k)), ...h.log.filter(open)])].sort(),
      counts: Object.fromEntries([...Object.entries(p?.counts ?? {}).filter(([k]) => !open(k)), ...Object.entries(h.counts ?? {}).filter(([k]) => open(k))]),
      createdAt: p ? p.createdAt : Math.max(h.createdAt, now - (slack + 1) * D),
    }
    return canon(locked) === canon(h) ? h : locked
  })
  const kept = prev?.breaks ?? [], ids = new Set(kept.map((b) => b.id)), floor = shift(breakFloor(today), -slack)
  const added = (next.breaks ?? [])
    .filter((b) => !ids.has(b.id) && isDay(b.from) && isDay(b.to) && floor <= b.from && b.from <= b.to)
    .map((b) => ({ id: b.id, from: b.from, to: b.to, label: (typeof b.label === 'string' ? b.label.trim().slice(0, 60) : '') || 'Break' }))
  const breaks = [...kept, ...added]
  const changed = habits.some((h, i) => h !== next.habits[i]) || canonBreaks(breaks) !== canonBreaks(next.breaks ?? [])
  return { doc: { ...next, habits, breaks }, changed }
}
