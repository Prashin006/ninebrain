import { mkdirSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Serves api/*.ts in `npm run dev` against a local SQLite file (no Vercel CLI needed).
function localApi(): Plugin {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      mkdirSync('.data', { recursive: true })
      process.env.TURSO_DATABASE_URL ??= env.TURSO_DATABASE_URL || 'file:.data/ninebrain.db'
      for (const k of ['TURSO_AUTH_TOKEN', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) process.env[k] ??= env[k]
      server.middlewares.use('/api', async (req, res) => {
        try {
          const name = req.url?.match(/^\/([a-z]+)(?:\?|$)/)?.[1]
          const mod = name ? await server.ssrLoadModule(`/api/${name}.ts`).catch(() => null) : null
          const handler = mod?.[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) { res.statusCode = mod ? 405 : 404; return res.end() }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const r = await handler(new Request(`http://localhost${req.originalUrl}`, {
            method: req.method, headers: req.headers as Record<string, string>,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          }))
          res.statusCode = r.status
          r.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await r.arrayBuffer()))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), localApi()],
})
