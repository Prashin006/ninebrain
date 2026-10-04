import { describe, expect, it } from 'vitest'
import { emptyData } from '../src/store'
import type { Data, Habit } from '../src/types'
import { breakFloor, isDoc, lockHistory, shift } from './rules'

const T = '2026-10-04'
const NOW = Date.parse(`${T}T12:00:00Z`)
const habit = (log: string[], extra: Partial<Habit> = {}): Habit =>
  ({ id: 'h', title: 'x', identity: '', cue: '', tiny: '', days: [0, 1, 2, 3, 4, 5, 6], color: '', log, createdAt: 0, ...extra })
const doc = (habits: Habit[], breaks: Data['breaks'] = []): Data => ({ ...emptyData(), habits, breaks })

describe('lockHistory', () => {
  it('lets today change but reverts edits to past and future days', () => {
    const prev = doc([habit([shift(T, -3)])])
    const next = doc([habit([shift(T, -2), T, shift(T, 1)])]) // un-logged -3, back-filled -2, pre-filled +1
    const { doc: out, changed } = lockHistory(prev, next, T, 0, NOW)
    expect(changed).toBe(true)
    expect(out.habits[0].log).toEqual([shift(T, -3), T])
  })
  it('passes untouched docs through unchanged', () => {
    const prev = doc([habit([shift(T, -1)])])
    const next = doc([habit([shift(T, -1), T])])
    const r = lockHistory(prev, next, T, 0, NOW)
    expect(r.changed).toBe(false)
    expect(r.doc.habits[0]).toBe(next.habits[0])
  })
  it('slack widens the editable window (server timezone tolerance)', () => {
    const r = lockHistory(doc([habit([])]), doc([habit([shift(T, -1)])]), T, 1, NOW)
    expect(r.doc.habits[0].log).toEqual([shift(T, -1)])
  })
  it('strips fabricated history from new habits and stops back-dating', () => {
    const r = lockHistory(doc([]), doc([habit([shift(T, -5), T], { createdAt: 0 })]), T, 0, NOW)
    expect(r.doc.habits[0].log).toEqual([T])
    expect(r.doc.habits[0].createdAt).toBe(NOW - 86_400_000)
  })
  it('locks partial counts on past days', () => {
    const prev = doc([habit([], { target: 3, counts: { [shift(T, -1)]: 1 } })])
    const next = doc([habit([], { target: 3, counts: { [shift(T, -1)]: 2, [T]: 1 } })])
    expect(lockHistory(prev, next, T, 0, NOW).doc.habits[0].counts).toEqual({ [shift(T, -1)]: 1, [T]: 1 })
  })
  it('allows deleting a habit', () => {
    expect(lockHistory(doc([habit([shift(T, -1)])]), doc([]), T, 0, NOW).doc.habits).toEqual([])
  })
})

describe('breaks', () => {
  const b = (id: string, from: string, to = from) => ({ id, from, to, label: 'Vacation' })
  it('are permanent once saved', () => {
    const prev = doc([], [b('a', '2026-11-02', '2026-11-19')])
    const r = lockHistory(prev, doc([], [b('a', '2026-11-05', '2026-11-19')]), T, 0, NOW)
    expect(r.changed).toBe(true)
    expect(r.doc.breaks).toEqual(prev.breaks)
    expect(lockHistory(prev, doc([]), T, 0, NOW).doc.breaks).toEqual(prev.breaks)
  })
  it(`must start at least a week ahead`, () => {
    expect(breakFloor(T)).toBe('2026-10-11')
    const r = lockHistory(doc([]), doc([], [b('late', '2026-10-10'), b('ok', '2026-10-11'), b('past', '2026-10-01'), b('bad', '2026-13-40')]), T, 0, NOW)
    expect(r.doc.breaks.map((x) => x.id)).toEqual(['ok'])
  })
})

describe('isDoc', () => {
  it('rejects malformed habits', () => {
    expect(isDoc(doc([habit([])]))).toBe(true)
    expect(isDoc({ habits: [{ id: 'h', log: 'x', createdAt: 0 }] })).toBe(false)
    expect(isDoc(null)).toBe(false)
  })
})
