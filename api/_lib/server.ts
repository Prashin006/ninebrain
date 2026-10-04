import { randomUUID } from 'node:crypto'
import { createClient, type Client } from '@libsql/client'
import { hashPassword, newToken, sha256 } from './crypto.js'

const SESSION_DAYS = 30
const COOKIE = 'nb_session'
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, pass TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)',
  'CREATE TABLE IF NOT EXISTS docs (user_id TEXT PRIMARY KEY, rev INTEGER NOT NULL, doc TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS attempts (email TEXT PRIMARY KEY, fails INTEGER NOT NULL, until INTEGER NOT NULL)',
]

export interface User { id: string; email: string; admin: boolean }

export const normEmail = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
export const validPassword = (p: unknown): p is string => typeof p === 'string' && p.length >= 10 && p.length <= 200

let db: Client | undefined
let ready: Promise<Client> | undefined

/** The admin comes from env (ADMIN_EMAIL + ADMIN_PASSWORD) and is created once; later password changes stick. */
async function init(c: Client) {
  await c.batch(SCHEMA, 'write')
  const email = normEmail(process.env.ADMIN_EMAIL ?? ''), pw = process.env.ADMIN_PASSWORD ?? ''
  if (validEmail(email) && pw.length >= 12) {
    const exists = await c.execute({ sql: 'SELECT 1 FROM users WHERE email = ?', args: [email] })
    if (!exists.rows.length)
      await c.execute({ sql: 'INSERT INTO users (id, email, pass, admin, created_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (email) DO NOTHING', args: [randomUUID(), email, await hashPassword(pw), Date.now()] })
  }
  return c
}

export function conn() {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) throw new Error('TURSO_DATABASE_URL not set')
  db ??= createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  ready ??= init(db).catch((e) => { db = ready = undefined; throw e })
  return ready
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })
export const unauthorized = () => json({ error: 'unauthorized' }, 401)
export const badRequest = (error = 'bad request') => json({ error }, 400)

export const sessionCookie = (token: string, maxAge: number) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
const readCookie = (req: Request) =>
  req.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)

/** CSRF guard for cookie-authenticated writes: JSON body from our own origin only. */
export function sameOriginJson(req: Request) {
  const origin = req.headers.get('origin'), host = req.headers.get('host')
  const sameOrigin = !origin || (URL.canParse(origin) && new URL(origin).host === host)
  return !!req.headers.get('content-type')?.startsWith('application/json') && sameOrigin
}

export async function readJson<T>(req: Request, maxBytes = 10_000): Promise<Partial<T> | null> {
  const text = await req.text()
  if (text.length > maxBytes) return null
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null } catch { return null }
}

export async function startSession(c: Client, userId: string) {
  const token = newToken(), now = Date.now()
  await c.batch([
    { sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [now] },
    { sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', args: [sha256(token), userId, now + SESSION_DAYS * 86_400_000] },
  ], 'write')
  return sessionCookie(token, SESSION_DAYS * 86_400)
}

/** Resolve the signed-in user from the session cookie (only the token's hash is stored). */
export async function currentUser(req: Request) {
  const token = readCookie(req)
  if (!token) return null
  const c = await conn(), sid = sha256(token)
  const r = await c.execute({ sql: 'SELECT u.id, u.email, u.admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?', args: [sid, Date.now()] })
  const row = r.rows[0]
  if (!row) return null
  const user: User = { id: String(row.id), email: String(row.email), admin: !!Number(row.admin) }
  return { c, sid, user }
}
