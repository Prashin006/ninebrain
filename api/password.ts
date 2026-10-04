import { hashPassword, verifyPassword } from './_lib/crypto.js'
import { badRequest, currentUser, json, readJson, sameOriginJson, unauthorized, validPassword } from './_lib/server.js'

/** Change your own password; signs out every other device. */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return badRequest()
  const s = await currentUser(req)
  if (!s) return unauthorized()
  const body = await readJson<{ current: string; next: string }>(req)
  if (typeof body?.current !== 'string' || !validPassword(body.next)) return badRequest('New password needs 10–200 characters.')
  const row = (await s.c.execute({ sql: 'SELECT pass FROM users WHERE id = ?', args: [s.user.id] })).rows[0]
  if (!row || !(await verifyPassword(body.current, String(row.pass)))) return json({ error: 'Current password is wrong.' }, 403)
  await s.c.batch([
    { sql: 'UPDATE users SET pass = ? WHERE id = ?', args: [await hashPassword(body.next), s.user.id] },
    { sql: 'DELETE FROM sessions WHERE user_id = ? AND token != ?', args: [s.user.id, s.sid] },
  ], 'write')
  return json({ ok: true })
}
