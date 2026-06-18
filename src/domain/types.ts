/**
 * Core domain model for GymLog.
 *
 * Everything the app persists is described here. The shapes are deliberately
 * serialisable (plain JSON) so the whole state can be exported/imported and
 * stored in localStorage. See {@link GymState} for the persisted root.
 */

/** A single exercise within a workout day. */
export interface Exercise {
  /** Stable identifier, used as the key for targets and logs. */
  id: string
  name: string
  /** Short coaching cue shown under the exercise name. */
  note: string
  /** Number of working sets. */
  sets: number
  /** Bottom of the target rep range. */
  repsLow: number
  /** Top of the target rep range — hitting this drives progression. */
  repsHigh: number
  /** Weight increment (kg) applied when progressing. */
  weightStep: number
  /** Suggested starting weight (kg) for a fresh exercise. */
  weightStart: number
  /** True for weighted lifts, false for bodyweight (progress by reps). */
  hasWeight: boolean
}

/** A workout day (e.g. Push / Pull / Legs). */
export interface Day {
  key: string
  name: string
  /** Sub-heading, e.g. "4 exercises · ~45 min". */
  sub: string
  exercises: Exercise[]
}

/** A full training program: an ordered list of days. */
export interface Program {
  days: Day[]
}

/** One performed set. */
export interface SetEntry {
  /** Weight lifted in kg (0 for bodyweight exercises). */
  weight: number
  reps: number
}

/**
 * How the overload engine decided to progress after a logged session.
 * - `weight_up`   — most sets hit the top rep range → add weight
 * - `reps_up`     — bodyweight lift cleared the range → add a rep
 * - `reps_nudge`  — partial success → raise the rep target
 * - `same`        — no progress → repeat the same prescription
 * - `deload`      — stalled too long → drop weight and rebuild
 */
export type ChangeType = 'weight_up' | 'reps_up' | 'reps_nudge' | 'same' | 'deload'

/** One completed exercise session, appended to the per-exercise log. */
export interface LogEntry {
  week: number
  /** ISO timestamp (YYYY-MM-DDTHH:mm:ss...) of when it was logged. */
  date: string
  sets: SetEntry[]
  /** True if this session set a new personal record. */
  pr: boolean
  /** What the engine prescribed for next time, based on this session. */
  change: ChangeType
}

/** The prescription for the next time an exercise is performed. */
export interface Target {
  weight: number
  /** Lower bound of the rep target for the next session. */
  reps: number
  /** Upper bound of the rep target for the next session. */
  repsHigh: number
}

/** User-tunable behaviour. */
export interface Settings {
  /** Default rest-timer duration in seconds. */
  restSeconds: number
  /** Consecutive stalled weeks before the engine suggests a deload. */
  deloadAfterStalls: number
  /** Fraction of weight removed on a deload (e.g. 0.1 = −10%). */
  deloadFactor: number
}

/** The persisted application state — the single source of truth. */
export interface GymState {
  /** Schema version, used to run migrations on load. */
  schemaVersion: number
  /** Current training week (1-based). */
  week: number
  /** The (editable) program. */
  program: Program
  /** Next-session prescription per exercise id. */
  targets: Record<string, Target>
  /** Full history per exercise id, oldest first. */
  logs: Record<string, LogEntry[]>
  settings: Settings
}
