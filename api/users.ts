import { randomUUID } from 'node:crypto'
import { hashPassword } from './_lib/crypto.js'
import { badRequest, currentUser, json, normEmail, readJson, sameOriginJson, unauthorized, validEmail, validPassword } from './_lib/server.js'

async function admin(req: Request) {
  const s = await currentUser(req)
  return { s: s?.user.admin ? s : null, deny: s ? json({ error: 'forbidden' }, 403) : unauthorized() }
}

/** Admin: list accounts. */
export async function GET(req: Request) {
  const { s, deny } = await admin(req)
  if (!s) return deny
  const r = await s.c.execute('SELECT email, admin, created_at FROM users ORDER BY created_at')
  return json(r.rows.map((x) => ({ email: String(x.email), admin: !!Number(x.admin), createdAt: Number(x.created_at) })))
}

/** Admin: create an account with a starting password (the user changes it later). */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return badRequest()
  const { s, deny } = await admin(req)
  if (!s) return deny
  const body = await readJson<{ email: string; password: string }>(req)
  const email = normEmail(typeof body?.email === 'string' ? body.email : ''), pw = body?.password
  if (!validEmail(email)) return badRequest('Enter a valid email.')
  if (!validPassword(pw)) return badRequest('Password needs 10–200 characters.')
  const r = await s.c.execute({
    sql: 'INSERT INTO users (id, email, pass, admin, created_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT (email) DO NOTHING',
    args: [randomUUID(), email, await hashPassword(pw), Date.now()],
  })
  return r.rowsAffected ? json({ ok: true }, 201) : json({ error: 'That email already has an account.' }, 409)
}
