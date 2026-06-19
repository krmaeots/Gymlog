import { create } from 'zustand'
import { buildLogUpdate } from '../domain/logging'
import type { Day, Exercise, GymState, SetEntry, Settings } from '../domain/types'
import { coerceState, loadState, reconcileEntries, saveState, seedState } from '../lib/storage'
import * as P from '../lib/program'
import { findExercise, effectiveWeek } from '../lib/program'
import { isCloudConfigured } from '../lib/supabase'
import { useToast } from './useToast'

interface GymActions {
  /** Record a performed exercise; updates its log and next-week target. */
  logExercise: (exerciseId: string, sets: SetEntry[]) => void
  /** Advance the program-wide training week. */
  startNextWeek: () => void
  /** Advance one day's own cycle counter (rolling split trained day-by-day). */
  startNextDayCycle: (dayKey: string) => void
  /** Wipe everything back to a fresh default program. */
  resetAll: () => void
  /** Clear logged progress (logs, targets, week) but keep the program + settings. */
  resetProgress: () => void
  /** Replace the entire state from imported JSON (validated/migrated). */
  importState: (raw: unknown) => void
  updateSettings: (patch: Partial<Settings>) => void

  /** Replace the whole state (e.g. after a cloud login) without echoing a save. */
  hydrate: (state: GymState) => void

  // ── Program editing ──────────────────────────────────────────────
  addDay: (day: Day) => void
  updateDay: (dayKey: string, patch: Partial<Omit<Day, 'exercises'>>) => void
  removeDay: (dayKey: string) => void
  addExercise: (dayKey: string, exercise: Exercise) => void
  updateExercise: (dayKey: string, exerciseId: string, patch: Partial<Exercise>) => void
  removeExercise: (dayKey: string, exerciseId: string) => void
  moveExercise: (dayKey: string, exerciseId: string, direction: -1 | 1) => void
}

export type GymStore = GymState & GymActions

const DATA_KEYS = ['schemaVersion', 'week', 'program', 'targets', 'logs', 'settings'] as const

/** Extract just the persistable data slice (drops action functions). */
function persistable(store: GymStore): GymState {
  return DATA_KEYS.reduce((acc, key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(acc as any)[key] = store[key]
    return acc
  }, {} as GymState)
}

// ── persistence machinery ────────────────────────────────────────────
// The store writes through a swappable sink. In local mode it goes straight to
// localStorage; in cloud mode the sync layer installs a scheduler via
// setPersistSink() after login. `suspendPersist` stops a hydrate (loading
// remote data) from immediately echoing a save back.
let storageHealthy = true
let suspendPersist = false
/** Whether the most recent local persist succeeded (false when storage is full). */
export const isStorageHealthy = () => storageHealthy

function localPersist(state: GymState) {
  const ok = saveState(state)
  // Warn once when persistence first fails (quota exceeded / private mode) so
  // the user learns their data isn't being saved now — not on the next reload.
  if (!ok && storageHealthy) {
    useToast.getState().show('⚠️ Salvestamine ebaõnnestus — mälu võib olla täis')
  }
  storageHealthy = ok
}

let persistSink: (state: GymState) => void = isCloudConfigured ? () => {} : localPersist

/** Swap the persistence sink (used by the cloud sync layer). */
export function setPersistSink(sink: (state: GymState) => void) {
  persistSink = sink
}

export const useGymStore = create<GymStore>((set, get) => ({
  // Cloud mode starts from a placeholder seed that login replaces via hydrate();
  // local mode loads (and migrates) the on-device state immediately.
  ...(isCloudConfigured ? seedState() : loadState()),

  hydrate: (state) => {
    suspendPersist = true
    set(reconcileEntries(state))
    suspendPersist = false
  },

  // Record a session. Re-running it in the same week edits (replaces) that
  // week's entry and recomputes progression — see buildLogUpdate.
  logExercise: (exerciseId, sets) => {
    const state = get()
    const found = findExercise(state.program, exerciseId)
    if (!found) return
    const { exercise, day } = found
    const currentTarget = state.targets[exerciseId] ?? {
      weight: exercise.weightStart,
      reps: exercise.repsLow,
      repsHigh: exercise.repsHigh,
    }

    const { logs, nextTarget } = buildLogUpdate({
      exercise,
      sets,
      currentTarget,
      history: state.logs[exerciseId] ?? [],
      // Stamp + progress against the day's own week (its cycle if set, else the
      // global week) so a rolling split's days advance — and deload — independently.
      week: effectiveWeek(day, state.week),
      settings: state.settings,
      date: new Date().toISOString(),
    })

    set({
      targets: { ...state.targets, [exerciseId]: nextTarget },
      logs: { ...state.logs, [exerciseId]: logs },
    })
  },

  startNextWeek: () => set((s) => ({ week: s.week + 1 })),

  // Advance only this day's cycle (initialising it from the global week the
  // first time). Other days are untouched; days without a cycle keep following
  // the global week.
  startNextDayCycle: (dayKey) =>
    set((s) => {
      const d = s.program.days.find((x) => x.key === dayKey)
      if (!d) return {}
      return { program: P.updateDay(s.program, dayKey, { cycle: (d.cycle ?? s.week) + 1 }) }
    }),

  resetAll: () => set(seedState()),

  // Keep the program + settings; drop all logged sets and reseed fresh starting
  // targets (reconcileEntries rebuilds them from the program), reset the week and
  // any per-day cycle counters back to the start.
  resetProgress: () =>
    set((s) =>
      reconcileEntries({
        ...s,
        week: 1,
        targets: {},
        logs: {},
        program: { days: s.program.days.map((d) => ({ ...d, cycle: undefined })) },
      }),
    ),

  importState: (raw) => set(coerceState(raw)),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  // Add/remove run reconcileEntries so new exercises get a target+log and
  // deleted ones have their orphaned target+log pruned (no unbounded growth).
  addDay: (day) => set((s) => reconcileEntries({ ...s, program: P.addDay(s.program, day) })),
  updateDay: (dayKey, patch) => set((s) => ({ program: P.updateDay(s.program, dayKey, patch) })),
  removeDay: (dayKey) => set((s) => reconcileEntries({ ...s, program: P.removeDay(s.program, dayKey) })),
  addExercise: (dayKey, exercise) =>
    set((s) => reconcileEntries({ ...s, program: P.addExercise(s.program, dayKey, exercise) })),
  updateExercise: (dayKey, exerciseId, patch) =>
    set((s) => ({ program: P.updateExercise(s.program, dayKey, exerciseId, patch) })),
  removeExercise: (dayKey, exerciseId) =>
    set((s) => reconcileEntries({ ...s, program: P.removeExercise(s.program, dayKey, exerciseId) })),
  moveExercise: (dayKey, exerciseId, direction) =>
    set((s) => ({ program: P.moveExercise(s.program, dayKey, exerciseId, direction) })),
}))

// Persist on every change through the active sink (local or cloud), unless a
// hydrate is in progress. JSON serialisation drops the action functions, but
// we select the data slice explicitly to be safe and forward-compatible.
useGymStore.subscribe((store) => {
  if (!suspendPersist) persistSink(persistable(store))
})
