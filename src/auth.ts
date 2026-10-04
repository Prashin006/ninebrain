import { create } from 'zustand'

export interface User { id: string; email: string; admin: boolean }
/** user: undefined = still checking, null = signed out */
interface AuthState { user: User | null | undefined; expire: () => void }

const CACHE = 'ninebrain.user' // lets the app open offline with the last signed-in user
const cached = (): User | null => { try { return JSON.parse(localStorage.getItem(CACHE) ?? 'null') } catch { return null } }
function setUser(user: User | null) {
  if (user) localStorage.setItem(CACHE, JSON.stringify(user)); else localStorage.removeItem(CACHE)
  useAuth.setState({ user })
}
export const useAuth = create<AuthState>(() => ({ user: undefined, expire: () => setUser(null) }))

/** JSON call to our API; throws with the server's error text and status. */
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`api/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(data.error ?? `Server said ${r.status}`), { status: r.status })
  return data as T
}

export async function checkSession() {
  try { setUser(await api<User>('session')) }
  catch (e) { setUser((e as { status?: number }).status === 401 ? null : cached()) }
}

export const login = async (email: string, password: string) => setUser(await api<User>('session', 'POST', { email, password }))

/** Sign out and wipe this device's copy (shared computers). */
export async function logout() {
  await api('session', 'DELETE').catch(() => {})
  for (const k of ['ninebrain', 'ninebrain.sync', CACHE]) localStorage.removeItem(k)
  location.reload()
}

export const changePassword = (current: string, next: string) => api('password', 'POST', { current, next })
