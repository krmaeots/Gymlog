import { DEFAULT_PROGRAM, DEFAULT_SETTINGS } from '../domain/defaultProgram'
import type {
  ChangeType,
  Day,
  Exercise,
  GymState,
  LogEntry,
  Program,
  Settings,
  SetEntry,
  Target,
} from '../domain/types'

/**
 * Persistence for the GymLog state.
 *
 * State is stored synchronously in localStorage under a single key. We keep the
 * original `"gymlog"` key so data written by the legacy single-file app is read
 * and migrated transparently on first load. All data entering the app from
 * storage or an imported file is validated/sanitised here so malformed JSON can
 * never crash or silently corrupt the running app.
 */
export const STORAGE_KEY = 'gymlog'
export const CURRENT_SCHEMA_VERSION = 2

const VALID_CHANGES = new Set<ChangeType>(['weight_up', 'reps_up', 'reps_nudge', 'same', 'deload'])

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Build a fresh state seeded from a program (default targets, empty logs). */
export function seedState(program: Program = DEFAULT_PROGRAM): GymState {
  return reconcileEntries({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    week: 1,
    program,
    targets: {},
    logs: {},
    settings: { ...DEFAULT_SETTINGS },
  })
}

/**
 * Reconcile per-exercise data with the program: guarantee every program
 * exercise has a target and a log array, and **prune** targets/logs for
 * exercises that no longer exist (deleted in the editor or dropped on import).
 * Run after load and after any program edit.
 */
export function reconcileEntries(state: GymState): GymState {
  const targets: Record<string, Target> = {}
  const logs: Record<string, LogEntry[]> = {}
  for (const day of state.program.days) {
    for (const ex of day.exercises) {
      targets[ex.id] = state.targets[ex.id] ?? {
        weight: ex.weightStart,
        reps: ex.repsLow,
        repsHigh: ex.repsHigh,
      }
      logs[ex.id] = state.logs[ex.id] ?? []
    }
  }
  return { ...state, targets, logs }
}

// ── sanitisation of untrusted (stored / imported) data ───────────────

function sanitizeSet(raw: unknown): SetEntry {
  const s = isObj(raw) ? raw : {}
  return {
    weight: isFiniteNum(s.weight) ? s.weight : 0,
    reps: isFiniteNum(s.reps) ? s.reps : 0,
  }
}

function sanitizeLogEntry(raw: unknown): LogEntry {
  const e = isObj(raw) ? raw : {}
  return {
    week: isFiniteNum(e.week) ? e.week : 1,
    date: typeof e.date === 'string' ? e.date : '',
    sets: Array.isArray(e.sets) ? e.sets.map(sanitizeSet) : [],
    pr: e.pr === true,
    change: VALID_CHANGES.has(e.change as ChangeType) ? (e.change as ChangeType) : 'same',
  }
}

/** Keep only object-keyed arrays; repair each entry. Non-arrays are dropped. */
function sanitizeLogs(raw: unknown): Record<string, LogEntry[]> {
  if (!isObj(raw)) return {}
  const out: Record<string, LogEntry[]> = {}
  for (const [id, val] of Object.entries(raw)) {
    if (Array.isArray(val)) out[id] = val.map(sanitizeLogEntry)
  }
  return out
}

/** Keep only fully-numeric targets; drop the rest so reconcile reseeds them. */
function sanitizeTargets(raw: unknown): Record<string, Target> {
  if (!isObj(raw)) return {}
  const out: Record<string, Target> = {}
  for (const [id, t] of Object.entries(raw)) {
    if (isObj(t) && isFiniteNum(t.weight) && isFiniteNum(t.reps) && isFiniteNum(t.repsHigh)) {
      out[id] = { weight: t.weight, reps: t.reps, repsHigh: t.repsHigh }
    }
  }
  return out
}

function sanitizeSettings(raw: unknown): Settings {
  const s = isObj(raw) ? raw : {}
  return {
    restSeconds: isFiniteNum(s.restSeconds) ? s.restSeconds : DEFAULT_SETTINGS.restSeconds,
    deloadAfterStalls: isFiniteNum(s.deloadAfterStalls)
      ? s.deloadAfterStalls
      : DEFAULT_SETTINGS.deloadAfterStalls,
    deloadFactor: isFiniteNum(s.deloadFactor) ? s.deloadFactor : DEFAULT_SETTINGS.deloadFactor,
  }
}

function isValidExercise(e: unknown): e is Exercise {
  return (
    isObj(e) &&
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    isFiniteNum(e.sets) &&
    isFiniteNum(e.repsLow) &&
    isFiniteNum(e.repsHigh) &&
    isFiniteNum(e.weightStart) &&
    isFiniteNum(e.weightStep) &&
    typeof e.hasWeight === 'boolean'
  )
}

function isValidDay(d: unknown): d is Day {
  return (
    isObj(d) &&
    typeof d.key === 'string' &&
    typeof d.name === 'string' &&
    Array.isArray(d.exercises) &&
    d.exercises.every(isValidExercise)
  )
}

/** A program is trusted only if fully well-formed; otherwise fall back to default. */
function sanitizeProgram(raw: unknown): Program {
  if (isObj(raw) && Array.isArray(raw.days) && raw.days.every(isValidDay)) {
    return raw as unknown as Program
  }
  return DEFAULT_PROGRAM
}

/** Coerce arbitrary parsed JSON into a valid {@link GymState}, migrating + sanitising. */
export function coerceState(raw: unknown): GymState {
  if (!isObj(raw)) return seedState()

  // Legacy v1 (the original single-file app): { week, logs, targets } with no
  // schemaVersion. Wrap it around the default program. Settings are honoured if
  // present (a hand-edited legacy file may carry them), else defaulted.
  const isLegacy = raw.schemaVersion === undefined

  return reconcileEntries({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    week: isFiniteNum(raw.week) ? raw.week : 1,
    program: isLegacy ? DEFAULT_PROGRAM : sanitizeProgram(raw.program),
    targets: sanitizeTargets(raw.targets),
    logs: sanitizeLogs(raw.logs),
    settings: sanitizeSettings(raw.settings),
  })
}

/** Load and migrate persisted state, falling back to a fresh seed on any error. */
export function loadState(): GymState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    return coerceState(JSON.parse(raw))
  } catch {
    return seedState()
  }
}

/**
 * Persist state. Returns `false` (and logs) if storage is full/unavailable, so
 * callers can warn the user instead of silently losing data.
 */
export function saveState(state: GymState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch (err) {
    console.error('GymLog: failed to persist state', err)
    return false
  }
}
