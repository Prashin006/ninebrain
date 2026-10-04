import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const N = 16384, KEYLEN = 32
const kdf = (pw: string, salt: Buffer, n: number) =>
  new Promise<Buffer>((ok, no) => scrypt(pw, salt, KEYLEN, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? no(e) : ok(k))))

/** Format: scrypt$N$salt$hash (base64url), so N can be raised later without breaking old hashes. */
export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  return `scrypt$${N}$${salt.toString('base64url')}$${(await kdf(pw, salt, N)).toString('base64url')}`
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const want = Buffer.from(hash, 'base64url'), got = await kdf(pw, Buffer.from(salt, 'base64url'), Number(n))
  return got.length === want.length && timingSafeEqual(got, want)
}

export const newToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
