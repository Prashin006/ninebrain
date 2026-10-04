import { create } from 'zustand'
import { emptyData, snapshot, useStore } from './store'
import { useAuth } from './auth'
import type { Data } from './types'

type Status = 'off' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict'
/** user = whose data this device holds; a different sign-in starts from a clean slate */
interface Meta { user: string; rev: number; dirty: boolean }
interface SyncState { status: Status; message: string; lastSync: number; theirs?: { rev: number; doc: Data; updatedAt: number } }

const META = 'ninebrain.sync' // per-device; never included in exports or synced
const load = (): Meta => ({ user: '', rev: 0, dirty: false, ...JSON.parse(localStorage.getItem(META) ?? '{}') })
let meta = load()
const save = (p: Partial<Meta>) => { meta = { ...meta, ...p }; localStorage.setItem(META, JSON.stringify(meta)) }

export const useSync = create<SyncState>(() => ({ status: 'off', message: '', lastSync: 0 }))
const set = (p: Partial<SyncState>) => useSync.setState(p)

let applying = false
const apply = (doc: Data) => { applying = true; useStore.getState().replaceAll(doc); applying = false }

async function call(method: 'GET' | 'PUT', body?: unknown) {
  const r = await fetch('api/sync', {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  if (r.status === 401) { useAuth.getState().expire(); throw new Error('Signed out') }
  if (!r.ok && r.status !== 409) throw new Error(`Server said ${r.status}`)
  return { status: r.status, data: await r.json() }
}

const guard = async (fn: () => Promise<void>) => {
  if (!useAuth.getState().user || useSync.getState().status === 'conflict') return
  set({ status: 'syncing' })
  try { await fn() } catch (e) {
    const msg = (e as Error).message
    set({ status: navigator.onLine && msg !== 'Failed to fetch' ? 'error' : 'offline', message: msg })
  }
}
const done = (message = '') => set({ status: 'synced', message, lastSync: Date.now() })

export const pull = () => guard(async () => {
  const { data } = await call('GET')
  if (data.rev === meta.rev) return meta.dirty ? push() : done()
  if (data.rev === 0) { save({ rev: 0 }); return useStore.getState().settings.hatched ? push() : done() }
  if (!meta.dirty) { apply(data.doc); save({ rev: data.rev }); return done() }
  set({ status: 'conflict', theirs: data })
})

async function push() {
  const { status, data } = await call('PUT', { baseRev: meta.rev, doc: snapshot() })
  if (status === 409) return set({ status: 'conflict', theirs: data })
  // the server sends the doc back only when it had to undo edits to locked days/breaks
  if (data.doc) apply(data.doc)
  save({ rev: data.rev, dirty: false }); done(data.doc ? 'Locked days and breaks can’t change — kept as they were.' : '')
}
export const pushNow = () => guard(push)

/** Resolve a conflict: keep this device's copy (overwrite server) or take the server's. */
export async function resolve(keep: 'mine' | 'theirs') {
  const theirs = useSync.getState().theirs
  if (!theirs) return
  set({ status: 'syncing', theirs: undefined })
  if (keep === 'theirs') { apply(theirs.doc); save({ rev: theirs.rev, dirty: false }); return done() }
  save({ rev: theirs.rev, dirty: true })
  await pushNow()
}

let timer = 0
export function startSync() {
  useStore.subscribe(() => {
    if (applying || !useAuth.getState().user) return
    save({ dirty: true })
    clearTimeout(timer)
    timer = window.setTimeout(pushNow, 2000)
  })
  useAuth.subscribe(({ user }, prev) => {
    if (!user || user.id === prev.user?.id) return
    if (user.id !== meta.user) { apply(emptyData()); save({ user: user.id, rev: 0, dirty: false }) }
    pull()
  })
  const refresh = () => document.visibilityState === 'visible' && pull()
  document.addEventListener('visibilitychange', refresh)
  addEventListener('online', refresh)
  setInterval(refresh, 60_000)
}
