# GymLog — developer & agent guide

Local-first gym tracker that **automates progressive overload**. You log the
sets you actually did; the app prescribes next week's weight/reps automatically.
Mobile-first, installable PWA, **no backend** — all data lives on the device.

> UI copy is in **Estonian** by design. Keep new user-facing strings Estonian
> (code, comments, identifiers stay English).

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Type-check | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` (watch: `npm run test:watch`) |
| Production build | `npm run build` → `dist/` |
| Preview the build | `npm run preview` |
| Regenerate PWA icons | `npm run icons` |
| Format | `npm run format` |

Before committing, run `npm run typecheck && npm test && npm run lint`
(or the `/check` command). Deployment is automatic — see **Deploy**.

## Architecture

A single-page React app. There is **no server**; the store is the source of
truth and is persisted to `localStorage` (key `gymlog`).

```
src/
  domain/            Pure logic, framework-free, fully unit-tested
    types.ts         All persisted data shapes (start here)
    defaultProgram.ts  Seed 4-day program + default settings
    overload.ts      THE progression engine (calcNext, 1RM, PR, deload)
    overload.test.ts
  lib/               Pure helpers
    storage.ts       load/save + legacy-data migration + seeding
    program.ts       Immutable program edits (add/move/remove…)
    format.ts        Display formatting (Estonian)
    id.ts            id generation
  store/             Zustand stores (the only stateful layer)
    useGymStore.ts   Main app state + all mutations; persists on change
    useRestTimer.ts  Rest countdown (interval lives here)
    useToast.ts      Transient messages
  components/        Reusable UI (ExerciseCard, LineChart, RestTimer, …)
  views/             Top-level screens (Workout / History / ProgramEditor)
  theme.ts           Design tokens (colours, change-type styling)
  App.tsx            Shell: Header + view switch + BottomNav
```

**Data flow:** components read/write through `useGymStore`. The store calls
pure functions in `domain/` and `lib/`, then `useGymStore.subscribe` persists
the data slice via `saveState`. Nothing else touches `localStorage`.

### The progression engine (the heart of the app)

`domain/overload.ts` decides the next prescription from the sets just logged.
Base rule is **double progression**, ported verbatim from the original app:

- Most sets (`sets - 1`) hit the top of the rep range → **add weight**, reset
  reps to the bottom. Weight is added on top of the *actual heaviest set lifted*,
  not the target.
- Some sets hit top → keep weight, **nudge the rep target** up.
- None → **repeat**.
- Bodyweight lifts progress by **adding a rep** instead of weight.
- Added layer: after `settings.deloadAfterStalls` consecutive stalled weeks, a
  weighted lift **deloads** by `settings.deloadFactor`.

This logic is pure and covered by `overload.test.ts`. **If you change it, update
the tests in the same edit** — the algorithm is the product's main value.

## Conventions

- **TypeScript strict** (incl. `noUncheckedIndexedAccess`). Don't add `any`;
  prefer precise types. `npm run typecheck` must pass.
- **Domain/lib stay pure** — no React, no DOM, no `localStorage`. That keeps them
  testable and is why they hold the important logic.
- **All persisted shapes live in `domain/types.ts`.** If you add a field, bump
  `CURRENT_SCHEMA_VERSION` in `storage.ts` and handle it in `coerceState`.
- **Immutability**: never mutate program/state in place; use the helpers in
  `lib/program.ts` and zustand `set`.
- Styling is inline style objects using tokens from `theme.ts` / CSS vars in
  `index.css`. No CSS framework.
- New persisted data must survive **export → import** (it's plain JSON) and the
  legacy migration path.

## Adding things

- **New exercise/day for yourself:** do it in the running app (Kava tab) — it's
  saved to state. Don't edit `defaultProgram.ts` unless changing the *seed*.
- **New screen:** add to `views/`, register in `App.tsx` and `BottomNav.tsx`.
- **Change progression behaviour:** edit `domain/overload.ts` + its tests only;
  the UI reads the result generically.

## Deploy

Push to `main` → GitHub Actions builds and publishes to GitHub Pages
(`.github/workflows/deploy.yml`). Live at **https://krmaeots.github.io/Gymlog/**.

The Vite `base` is `/Gymlog/` in production (set in `vite.config.ts`); keep all
asset references relative so they resolve under that sub-path. There is no other
deploy step and no secrets to configure.

## Gotchas

- Data is per-browser. The only backup/transfer is JSON **export/import** in the
  header. There is intentionally no cloud sync.
- `legacy/gymlog.html` is the original single-file app, kept for reference. It
  shares the `gymlog` storage key, so its data is migrated automatically on first
  load of the new app.
- Workflow/automation scripts can't use `Date.now()`/`Math.random()`, but normal
  app code runs in the browser and uses `Date`/`crypto` freely.
