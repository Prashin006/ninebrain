import { describe, expect, it } from 'vitest'
import { addDays, countOn, dayKey, freeSlot, fromKey, improvements, jar, layoutGraph, sonar, streak, strength, weekStart, whispers, withCount, zoneAt } from './lib'
import { emptyData } from './store'
import type { Habit } from './types'

const T = '2026-09-30' // a Wednesday
const habit = (log: string[], days = [0, 1, 2, 3, 4, 5, 6]): Habit =>
  ({ id: 'h', title: 'x', identity: 'i', cue: '', tiny: '', days, color: '', log, createdAt: 0 })

describe('dates', () => {
  it('round-trips day keys and crosses month edges', () => {
    expect(dayKey(fromKey(T))).toBe(T)
    expect(addDays(T, 1)).toBe('2026-10-01')
  })
  it('weeks start on Monday', () => {
    expect(weekStart(T)).toBe('2026-09-28')
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sunday
  })
})

describe('streak', () => {
  it('does not break before today is over', () => {
    expect(streak(habit([addDays(T, -1), addDays(T, -2)]), T)).toBe(2)
  })
  it('counts today when done', () => {
    expect(streak(habit([T, addDays(T, -1)]), T)).toBe(2)
  })
  it('breaks on a missed due day', () => {
    expect(streak(habit([T, addDays(T, -2)]), T)).toBe(1)
  })
  it('skips days the habit is not due', () => {
    const weekdays = [1, 2, 3, 4, 5]
    // Mon 28 + Fri 25; Sat/Sun skipped
    expect(streak(habit(['2026-09-28', '2026-09-25'], weekdays), '2026-09-29')).toBe(2)
  })
  it('freezes across breaks instead of breaking', () => {
    const breaks = [{ id: 'b', from: addDays(T, -5), to: addDays(T, -2), label: 'Vacation' }]
    const h = habit([addDays(T, -1), addDays(T, -6), addDays(T, -7)])
    expect(streak(h, T)).toBe(1)
    expect(streak(h, T, breaks)).toBe(3)
  })
})

describe('paper clips', () => {
  const h = { ...habit([]), target: 3, goal: 2 }
  it('logs the day only once the daily target is reached', () => {
    const a = withCount(h, T, 2)
    expect(countOn(a, T)).toBe(2)
    expect(a.log).toEqual([])
    const b = withCount(a, T, 3)
    expect(b.log).toEqual([T])
    expect(b.counts?.[T]).toBeUndefined()
    expect(withCount(b, T, 2).log).toEqual([])
  })
  it('avoid habits are a single daily tick', () => {
    expect(withCount({ ...h, kind: 'avoid' }, T, 1).log).toEqual([T])
  })
  it('fills jars toward the goal', () => {
    expect(jar({ ...h, log: ['a', 'b', 'c'] })).toEqual({ goal: 2, moved: 1, filled: 1 })
  })
})

describe('dive + whispers', () => {
  it('strength = done ÷ due days in the last 30 (today counts only once done)', () => {
    const h = { ...habit([addDays(T, -1), addDays(T, -2)]), createdAt: fromKey(addDays(T, -3)).getTime() }
    expect(strength(h, T)).toBe(67) // due: -3,-2,-1 → 2 of 3
    expect(strength({ ...h, log: [...h.log, T] }, T)).toBe(75) // 3 of 4
    expect(strength(h, T, [{ id: 'b', from: addDays(T, -3), to: addDays(T, -3), label: '' }])).toBe(100) // missed day was a break
  })
  it('maps depth to ocean zones', () => {
    expect(zoneAt(0).name).toBe('Sunlight zone')
    expect(zoneAt(3000).name).toBe('Midnight zone')
    expect(zoneAt(10_900).name).toBe('The Trenches')
  })
  it('nags about untriaged ink', () => {
    const d = { ...emptyData(), blots: [{ id: 'b', text: 'x', createdAt: 0 }] }
    expect(whispers(d).some((w) => w.to === '/ink')).toBe(true)
  })
  it('counts kept 1% improvements (partly = half, unanswered not counted)', () => {
    const day = (better: string, betterKept?: 'yes' | 'partly' | 'no') => ({ beats: [], wins: '', drains: '', better, betterKept })
    const days = { a: day('x', 'yes'), b: day('y', 'partly'), c: day('z'), d: day('') }
    expect(improvements(days, ['a', 'b', 'c', 'd'])).toEqual({ made: 3, judged: 2, kept: 1.5 })
  })
})

describe('freeSlot', () => {
  const blocks = [{ day: T, start: 540, dur: 60 }, { day: T, start: 630, dur: 30 }] // 9:00–10:00, 10:30–11:00
  it('fits before the first block when there is room', () => expect(freeSlot(blocks, T, 60, 420, 1380)).toBe(420))
  it('skips gaps that are too small', () => expect(freeSlot(blocks, T, 60, 540, 1380)).toBe(660))
  it('uses a gap that fits exactly', () => expect(freeSlot(blocks, T, 30, 540, 1380)).toBe(600))
  it('returns null when the day is full', () => expect(freeSlot(blocks, T, 60, 1350, 1380)).toBeNull())
})

describe('layoutGraph + sonar', () => {
  it('keeps nodes inside the canvas and pulls linked nodes closer', () => {
    const p = layoutGraph(4, [[0, 1]])
    p.forEach((q) => { expect(q.x).toBeGreaterThanOrEqual(40); expect(q.x).toBeLessThanOrEqual(960) })
    const dist = (a: number, b: number) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y)
    expect(dist(0, 1)).toBeLessThan(dist(2, 3))
  })
  it('sums planned vs dived minutes per active arm for the week', () => {
    const arm = { id: 'a', title: 'A', purpose: '', color: '', status: 'active' as const, createdAt: 0, touchedAt: 0 }
    const r = sonar({
      arms: [arm], tasks: [],
      blocks: [{ id: '1', day: T, start: 0, dur: 90, title: '', kind: 'deep', armId: 'a' }, { id: '2', day: T, start: 0, dur: 30, title: '', kind: 'shallow' }],
      dives: [{ id: 'd', startedAt: fromKey(T).getTime() + 3_600_000, minutes: 50, armId: 'a', intention: '', outcome: '' }],
    }, T)
    expect(r.rows[0]).toMatchObject({ planned: 90, dived: 50 })
    expect(r.unaimed).toBe(30)
  })
})
