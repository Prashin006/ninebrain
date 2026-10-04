import { verifyPassword } from './_lib/crypto.js'
import { badRequest, conn, currentUser, json, normEmail, readJson, sameOriginJson, sessionCookie, startSession, unauthorized } from './_lib/server.js'

const MAX_FAILS = 5, LOCK_MS = 15 * 60_000
// Unknown emails still pay for one scrypt run, so timing doesn't reveal which accounts exist.
const DUMMY = `scrypt$16384$${'A'.repeat(22)}$${'A'.repeat(43)}`

/** Who am I? */
export async function GET(req: Request) {
  const s = await currentUser(req)
  return s ? json(s.user) : unauthorized()
}

/** Sign in; 5 wrong passwords lock the email for 15 minutes. */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return badRequest()
  const body = await readJson<{ email: string; password: string }>(req)
  if (typeof body?.email !== 'string' || typeof body.password !== 'string' || body.password.length > 200) return badRequest()
  const c = await conn(), email = normEmail(body.email), now = Date.now()
  const a = (await c.execute({ sql: 'SELECT fails, until FROM attempts WHERE email = ?', args: [email] })).rows[0]
  if (a && Number(a.until) > now) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
  const u = (await c.execute({ sql: 'SELECT id, email, pass, admin FROM users WHERE email = ?', args: [email] })).rows[0]
  const ok = await verifyPassword(body.password, u ? String(u.pass) : DUMMY)
  if (!u || !ok) {
    const fails = (a ? Number(a.fails) : 0) + 1, lock = fails >= MAX_FAILS
    await c.execute({
      sql: 'INSERT INTO attempts (email, fails, until) VALUES (?, ?, ?) ON CONFLICT (email) DO UPDATE SET fails = excluded.fails, until = excluded.until',
      args: [email, lock ? 0 : fails, lock ? now + LOCK_MS : 0],
    })
    return json({ error: 'Wrong email or password.' }, 401)
  }
  await c.execute({ sql: 'DELETE FROM attempts WHERE email = ?', args: [email] })
  const user = { id: String(u.id), email: String(u.email), admin: !!Number(u.admin) }
  return json(user, 200, { 'set-cookie': await startSession(c, user.id) })
}

/** Sign out this device. */
export async function DELETE(req: Request) {
  const s = await currentUser(req)
  if (s) await s.c.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [s.sid] })
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) })
}
