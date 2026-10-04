import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Data, DayKey, DayLog, Settings } from './types'
import { PALETTE, addDays, countOn, dailyTarget, dayKey, uid, withCount } from './lib'
import { breakFloor, lockHistory } from '../shared/rules'

// breaks are deliberately absent: they're append-only via addBreak
type Coll = 'hearts' | 'arms' | 'tasks' | 'blots' | 'blocks' | 'habits' | 'notes' | 'dives' | 'reviews'
type Item<C extends Coll> = Data[C][number]

interface Actions {
  add: <C extends Coll>(c: C, item: Omit<Item<C>, 'id'> & { id?: string }) => string
  patch: <C extends Coll>(c: C, id: string, p: Partial<Item<C>>) => void
  remove: (c: Coll, id: string) => void
  setSettings: (p: Partial<Settings>) => void
  setDay: (k: DayKey, p: Partial<DayLog>) => void
  set: (p: Partial<Data>) => void
  triage: (blotId: string) => void
  toggleHabit: (id: string, k: DayKey) => void
  countHabit: (id: string, k: DayKey, delta: number) => void
  addBreak: (from: DayKey, to: DayKey, label: string) => boolean
  /** Replace data from a backup/demo, keeping locked history; true if anything had to be kept. */
  restore: (d: Data) => boolean
  replaceAll: (d: Data) => void
}

export const emptyData = (): Data => ({
  settings: { name: '', hatched: false, theme: 'abyss', capacityH: 7, dayStart: 6, dayEnd: 23, snow: true },
  hearts: [], arms: [], tasks: [], blots: [], blocks: [], habits: [], breaks: [], notes: [], dives: [],
  days: {}, reviews: [], processed: {},
})

export const EMPTY_DAY: DayLog = { beats: ['', '', ''], wins: '', drains: '', better: '' }

export const useStore = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      add: (c, item) => {
        const id = item.id ?? uid()
        set({ [c]: [...get()[c], { ...item, id }] } as Partial<Data>)
        return id
      },
      patch: (c, id, p) => set({ [c]: (get()[c] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...p } : x)) } as Partial<Data>),
      remove: (c, id) => set({ [c]: (get()[c] as { id: string }[]).filter((x) => x.id !== id) } as Partial<Data>),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      setDay: (k, p) => set({ days: { ...get().days, [k]: { ...EMPTY_DAY, ...get().days[k], ...p } } }),
      set: (p) => set(p),
      triage: (blotId) => {
        const k = dayKey()
        set({ blots: get().blots.filter((b) => b.id !== blotId), processed: { ...get().processed, [k]: (get().processed[k] ?? 0) + 1 } })
      },
      toggleHabit: (id, k) => {
        if (k !== dayKey()) return
        set({ habits: get().habits.map((h) => (h.id !== id ? h : withCount(h, k, h.log.includes(k) ? 0 : dailyTarget(h)))) })
      },
      countHabit: (id, k, delta) => {
        if (k !== dayKey()) return
        set({ habits: get().habits.map((h) => (h.id !== id ? h : withCount(h, k, countOn(h, k) + delta))) })
      },
      addBreak: (from, to, label) => {
        if (from < breakFloor(dayKey()) || to < from) return false
        set({ breaks: [...get().breaks, { id: uid(), from, to, label: label.trim().slice(0, 60) || 'Break' }] })
        return true
      },
      restore: (d) => {
        const { doc, changed } = lockHistory(snapshot(), { ...emptyData(), ...d }, dayKey())
        set({ ...emptyData(), ...doc })
        return changed
      },
      replaceAll: (d) => set({ ...emptyData(), ...d }),
    }),
    { name: 'ninebrain', version: 1 },
  ),
)

export const snapshot = (): Data => {
  const { settings, hearts, arms, tasks, blots, blocks, habits, breaks, notes, dives, activeDive, days, reviews, processed } = useStore.getState()
  return { settings, hearts, arms, tasks, blots, blocks, habits, breaks, notes, dives, activeDive, days, reviews, processed }
}

/** A lived-in ocean so every screen has something to show. */
export function demoData(name: string): Data {
  const now = Date.now(), t = dayKey(), D = 86_400_000
  const h = [
    { id: uid(), title: 'Build things that outlive me', color: PALETTE[0] },
    { id: uid(), title: 'A body that keeps up', color: PALETTE[2] },
    { id: uid(), title: 'People I love, loved well', color: PALETTE[1] },
  ]
  const arm = (title: string, purpose: string, hi: number, ci: number, age = 1, status: 'active' | 'clutch' | 'midden' = 'active') =>
    ({ id: uid(), title, purpose, heartId: h[hi].id, color: PALETTE[ci], status, createdAt: now - 30 * D, touchedAt: now - age * D })
  const arms = [
    arm('Personal brand site', 'A home on the internet that sounds like me', 0, 0),
    arm('Ninebrain v2 (AI Otto)', 'Let the octopus think with me', 0, 3, 2),
    arm('Half-marathon', 'Sub 2h by spring', 1, 2),
    arm('Learn Rust', 'Systems thinking, the hard way', 0, 5, 13),
    arm('Family photo book', 'Before the memories blur', 2, 1, 4),
    arm('Podcast about weird ideas', 'Someday, a mic', 0, 6, 0, 'clutch'),
    arm('Write a tiny novel', '', 0, 7, 0, 'clutch'),
    arm('Tax filing 2025', 'Done. Never again in April.', 1, 4, 20, 'midden'),
  ]
  const task = (armI: number, title: string, done = false) => ({ id: uid(), title, armId: arms[armI].id, done, createdAt: now - 5 * D, doneAt: done ? now - D : undefined })
  const log = (rate: number) => Array.from({ length: 70 }, (_, i) => addDays(t, -i - 1)).filter((_, i) => (i * 7919) % 100 < rate * 100)
  return {
    settings: { name, hatched: true, theme: 'abyss', capacityH: 7, dayStart: 6, dayEnd: 23, snow: true },
    hearts: h, arms,
    tasks: [
      task(0, 'Sketch the home page', true), task(0, 'Write the About page in my own voice'), task(0, 'Pick a domain'),
      task(1, 'List what Otto should automate'), task(1, 'Compare local vs hosted LLMs'),
      task(2, 'Long run 14km', true), task(2, 'Interval session'), task(2, 'Buy new shoes', true),
      task(4, 'Collect 2019–2023 photos'),
    ],
    blots: [
      { id: uid(), text: 'call dentist??', createdAt: now }, { id: uid(), text: 'idea: habit tracker where missed days become fossils', createdAt: now },
      { id: uid(), text: 'read that paper on spaced repetition', createdAt: now },
    ],
    blocks: [
      { id: uid(), day: t, start: 9 * 60, dur: 90, title: 'Deep: brand site', kind: 'deep', armId: arms[0].id },
      { id: uid(), day: t, start: 11 * 60, dur: 30, title: 'Email + Slack sweep', kind: 'shallow' },
      { id: uid(), day: t, start: 13 * 60, dur: 45, title: 'Lunch walk', kind: 'break' },
      { id: uid(), day: t, start: 14 * 60, dur: 60, title: 'Otto research', kind: 'deep', armId: arms[1].id },
      { id: uid(), day: t, start: 18 * 60, dur: 60, title: 'Run', kind: 'life', armId: arms[2].id },
    ],
    habits: [
      { id: uid(), title: 'Write 200 words', identity: 'I am a writer', cue: 'After my first coffee', tiny: 'Write one sentence', days: [0, 1, 2, 3, 4, 5, 6], color: PALETTE[0], log: log(0.8), createdAt: now - 80 * D },
      { id: uid(), title: 'Move 30 min', identity: 'I am an athlete', cue: 'When I close the laptop at 6', tiny: 'Put on shoes', days: [1, 2, 3, 4, 5], color: PALETTE[2], log: log(0.65), createdAt: now - 80 * D },
      { id: uid(), title: 'Call someone I love', identity: 'I show up for people', cue: 'Sunday after lunch', tiny: 'Send one text', days: [0], color: PALETTE[1], log: log(0.5), createdAt: now - 80 * D },
      { id: uid(), title: 'Sales calls', identity: 'I am a closer', cue: 'After standup', tiny: 'Dial one number', days: [1, 2, 3, 4, 5], color: PALETTE[5], log: log(0.6), createdAt: now - 80 * D, target: 5, goal: 30, counts: { [t]: 2 } },
      { id: uid(), title: 'No phone in bed', kind: 'avoid', identity: 'I am someone who sleeps well', cue: 'Phone charges in the kitchen', tiny: 'Read a page instead', days: [0, 1, 2, 3, 4, 5, 6], color: PALETTE[4], log: log(0.7), createdAt: now - 80 * D },
    ],
    breaks: [],
    notes: [
      { id: uid(), title: 'Why an octopus?', body: '# Nine brains\nOne central brain, and a mini-brain in each **arm**. Each arm acts on its own, the centre coordinates.\n\nThat is how I want to run my projects. See [[WIP limits]].', tags: ['meta'], updatedAt: now },
      { id: uid(), title: 'WIP limits', body: 'Work-in-progress limits: fewer things *in flight* means more things *landed*.\n- 8 arms max\n- extra projects wait in the clutch\n\nRelated: [[Why an octopus?]]', tags: ['productivity'], updatedAt: now - D },
    ],
    dives: [
      { id: uid(), startedAt: now - D, minutes: 52, armId: arms[0].id, intention: 'Hero section', outcome: 'Shipped a draft' },
      { id: uid(), startedAt: now - 2 * D, minutes: 35, armId: arms[1].id, intention: 'LLM notes', outcome: '' },
    ],
    days: { [addDays(t, -1)]: { energy: 4, mood: 4, beats: ['Brand hero', 'Run', 'Call mum'], wins: 'Hero draft done', drains: 'Meetings', better: 'Block mornings' } },
    reviews: [], processed: { [t]: 4 },
  }
}
