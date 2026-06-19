# GymLog 🏋️

A local-first gym tracker that **automates progressive overload**. Log the sets
you actually did and GymLog prescribes next week's weights and reps for you.

**Live:** https://krmaeots.github.io/Gymlog/

- 📲 **Installable PWA** — add to your phone's home screen, works fully offline.
- 🤖 **Automatic progression** — double-progression engine adds weight when you
  clear the rep range, nudges reps when you're close, and deloads after a stall.
- 📈 **History & charts** — weight, estimated 1RM and volume trends per exercise.
- ✏️ **Editable program** — add/remove/reorder exercises and days in the app.
- ⏱️ **Rest timer** — with vibrate + beep when rest is over.
- 💾 **Your data stays yours** — stored on-device, with JSON export/import. No
  account, no server, no tracking.

> The interface is in **Estonian**.

## Develop

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

| | |
| --- | --- |
| `npm test` | run unit tests (the progression engine is covered) |
| `npm run typecheck` | strict TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | production build → `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run icons` | regenerate PWA icons |

## Deploy

Push to `main` — that's it. A GitHub Action builds the app and publishes it to
GitHub Pages. Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Multi-user & cloud sync (optional)

By default GymLog is single-user and stores everything on-device. You can
optionally turn on **multi-user cloud sync** so several people log in (pick name
→ PIN) on their own phones, with an **admin** who manages everyone's plans and
sees their progress. It uses a free Supabase project as a PIN-gated datastore —
the app still deploys as a static PWA, no server to run.

**One-time setup**

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. Create the first admin once (SQL editor):
   `select gym_bootstrap_admin('YourName', '1234');`
4. From **Settings → API**, copy the **Project URL** and **anon public key** into:
   - `.env.local` for local dev (see [`.env.example`](.env.example)), and
   - GitHub → **Settings → Secrets and variables → Actions → Variables**:
     `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, then re-deploy.

Now opening the app shows a profile picker. Admins get an **Admin** tab to add
users, set/reset PINs, and edit anyone's plan or view their charts. Everyone
else sees only their own data.

> The anon key is **public by design** — security is enforced by row-level
> security + the PIN-checked functions in the SQL, not by hiding the key. A PIN
> is a keep-honest lock, not strong security; workout data isn't sensitive.
> Conflicts resolve last-write-wins per person.

## Architecture

React + TypeScript, built with Vite. State lives in small Zustand stores and is
persisted to `localStorage`; all the meaningful logic is pure and unit-tested in
`src/domain/`. See [CLAUDE.md](CLAUDE.md) for the full developer guide.

The original single-file prototype is preserved at
[`legacy/gymlog.html`](legacy/gymlog.html); the new app migrates its saved data
automatically on first load.
