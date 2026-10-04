export type ID = string
/** 'YYYY-MM-DD' in local time */
export type DayKey = string

export interface Heart { id: ID; title: string; color: string }

/** active = an arm (max 8), clutch = incubating egg (someday), midden = done pile */
export type ArmStatus = 'active' | 'clutch' | 'midden'
export interface Arm {
  id: ID; title: string; purpose: string; heartId?: ID; color: string
  status: ArmStatus; createdAt: number; touchedAt: number
}

export interface Task { id: ID; title: string; armId?: ID; done: boolean; createdAt: number; doneAt?: number }
export interface Blot { id: ID; text: string; createdAt: number }

export type BlockKind = 'deep' | 'shallow' | 'life' | 'break'
export interface Block { id: ID; day: DayKey; start: number; dur: number; title: string; kind: BlockKind; armId?: ID }

/** build = do it, avoid = resist it (log = days done / resisted) */
export type HabitKind = 'build' | 'avoid'
export interface Habit {
  id: ID; title: string; identity: string; cue: string; tiny: string
  days: number[]; color: string; log: DayKey[]; createdAt: number
  /** target = paper clips (reps) per day; goal = long-term jar size in done days; counts = partial reps on unfinished days */
  kind?: HabitKind; target?: number; goal?: number; counts?: Record<DayKey, number>
}
/** Inclusive date range when no habit is due, so streaks freeze instead of breaking. */
export interface Break { id: ID; from: DayKey; to: DayKey; label: string }

export interface Note { id: ID; title: string; body: string; tags: string[]; updatedAt: number }

export interface DiveLog { id: ID; startedAt: number; minutes: number; armId?: ID; intention: string; outcome: string }
export interface ActiveDive { startedAt: number; pausedAt?: number; pausedMs: number; armId?: ID; intention: string; targetMin: number }

export type Kept = 'yes' | 'partly' | 'no'
/** riseAt/sinkAt = when the morning/evening check-in was saved; betterKept = verdict given the next day */
export interface DayLog { energy?: number; mood?: number; beats: string[]; wins: string; drains: string; better: string; riseAt?: number; sinkAt?: number; betterKept?: Kept }
export interface Review { id: ID; weekStart: DayKey; at: number; well: string; drained: string; change: string }

export interface Settings { name: string; hatched: boolean; theme: 'abyss' | 'shallows'; capacityH: number; dayStart: number; dayEnd: number; snow: boolean }

export interface Data {
  settings: Settings; hearts: Heart[]; arms: Arm[]; tasks: Task[]; blots: Blot[]; blocks: Block[]
  habits: Habit[]; breaks: Break[]; notes: Note[]; dives: DiveLog[]; activeDive?: ActiveDive
  days: Record<DayKey, DayLog>; reviews: Review[]; processed: Record<DayKey, number>
}
