import type { Client } from '@libsql/client'
import { isDoc, lockHistory } from '../shared/rules.js'
import { badRequest, currentUser, json, readJson, sameOriginJson, unauthorized } from './_lib/server.js'

// One document per user (their whole Ninebrain state), guarded by a revision number for optimistic concurrency.
const MAX_BYTES = 2_000_000
const utcToday = () => new Date().toISOString().slice(0, 10)

async function current(c: Client, userId: string) {
  const r = await c.execute({ sql: 'SELECT rev, doc, updated_at FROM docs WHERE user_id = ?', args: [userId] })
  const row = r.rows[0]
  return row ? { rev: Number(row.rev), doc: JSON.parse(String(row.doc)), updatedAt: Number(row.updated_at) } : { rev: 0, doc: null, updatedAt: 0 }
}

export async function GET(req: Request) {
  const s = await currentUser(req)
  return s ? json(await current(s.c, s.user.id)) : unauthorized()
}

export async function PUT(req: Request) {
  if (!sameOriginJson(req)) return badRequest()
  const s = await currentUser(req)
  if (!s) return unauthorized()
  const body = await readJson<{ baseRev: number; doc: unknown }>(req, MAX_BYTES)
  if (!body || !Number.isInteger(body.baseRev) || !isDoc(body.doc)) return badRequest()
  const { c, user } = s, base = body.baseRev as number, prev = await current(c, user.id)
  if (prev.rev !== base) return json({ error: 'conflict', ...prev }, 409)
  // The client's clock can't be trusted: ±1 day around UTC covers every timezone.
  const { doc, changed } = lockHistory(prev.doc, body.doc, utcToday(), 1)
  const text = JSON.stringify(doc), now = Date.now()
  const r = base === 0
    ? await c.execute({ sql: 'INSERT INTO docs (user_id, rev, doc, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT (user_id) DO NOTHING', args: [user.id, text, now] })
    : await c.execute({ sql: 'UPDATE docs SET rev = rev + 1, doc = ?, updated_at = ? WHERE user_id = ? AND rev = ?', args: [text, now, user.id, base] })
  if (r.rowsAffected === 0) return json({ error: 'conflict', ...(await current(c, user.id)) }, 409)
  return json({ rev: base + 1, updatedAt: now, ...(changed && { doc }) })
}
