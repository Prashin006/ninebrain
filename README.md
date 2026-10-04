# Ninebrain (web)

Personal command centre themed as an octopus: one head, eight project-arms. Invite-only, multi-user: React SPA + Vercel functions (`api/`) + Turso (SQLite). Local-first: data is cached in the browser and synced per user.

```sh
npm install
npm run dev      # http://localhost:5173 — serves api/*.ts against .data/ninebrain.db
npm run build    # type-check + static output in dist/
npm test         # vitest (src/lib.ts, shared/rules.ts)
npm run lint
```

**Local dev:** put `ADMIN_EMAIL=…` and `ADMIN_PASSWORD=…` (12+ chars) in `.env.local`; that account is created on first API call.

**Production (Vercel, Root Directory = `web`):** env vars `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. The admin adds members in **Coconut → Crew**; anyone can change their password in **Coconut → Account**.

**Strict history** (`shared/rules.ts`, enforced by the server, mirrored in the UI): only today's habit ticks can change; past/future days are locked; breaks must start ≥ 7 days ahead and can never be edited or deleted.

**CI/CD:** GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and build on every push/PR; Vercel's Git integration deploys `main` to production and every PR to a preview URL.

| Module | Meaning |
|---|---|
| Den | Dashboard, octopus map, Otto's rule-based nudges |
| Ink | Brain dump → single-key triage (T/I/P/H/S/X) |
| Arms | ≤8 active projects; tasks = suckers; Clutch = someday; Midden = done |
| Tides | Drag-and-drop day/week time-blocking with capacity "flood" meter |
| Currents | Habits (identity, cue, 2-min version, streak, strength, never-miss-twice) |
| Dive | Focus timer as ocean depth (1 min = 120 m) |
| Reef | Notes with `[[wikilinks]]` + backlinks |
| Surface | Daily rise/sink check-ins, weekly low-tide review |

Code map: `src/types.ts` data model · `src/store.ts` Zustand store (persisted, versioned) · `src/lib.ts` pure logic (dates, habits, nudges) · `src/ui.tsx` shared UI · `src/pages/*`.
