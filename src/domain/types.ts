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
  /**
   * Fixed per-set rep prescription (one entry per working set). When present
   * the exercise is in **fixed-rep mode**: the reps are pinned by a coach's
   * plan every week, so the engine never changes them and only adjusts the
   * weight (see `calcNext`). Undefined → normal double-progression.
   */
  repScheme?: number[]
  /**
   * Fixed-rep mode only: per-set prescribed weights, e.g. a descending pyramid
   * `[45,45,40,40]`. Treated as **offsets from the single advancing working
   * weight** — the engine still progresses one weight (the top set), and each
   * set is shown as `working + (weightScheme[i] − max(weightScheme))`. This lets
   * a back-off/pyramid plan display correct per-set weights without per-set
   * progression. Undefined → every set uses the one target weight.
   */
  weightScheme?: number[]
  /**
   * Optional superset link: exercises in the same {@link Day} sharing this id
   * are performed back-to-back and rendered under one bracket. Purely
   * presentational — each exercise is still logged and progressed on its own.
   */
  supersetGroup?: string
  /**
   * Fixed-rep mode only: a coach's explicit forward weight plan, consulted at
   * prescription time — if an entry matches the day's current week, that weight
   * is shown instead of the engine's computed progression. Lets a coach pin
   * specific weeks (e.g. a planned overreach). Undefined → engine computes.
   */
  weekPlan?: { week: number; weight: number }[]
  /**
   * Optional gym machine/station number(s), shown to the user so they know which
   * machine to use — e.g. "76" or "49 / 50". Free text, not required; omit for
   * free-weight or bodyweight exercises that have no fixed station.
   */
  machine?: string
}

/** A workout day (e.g. Push / Pull / Legs). */
export interface Day {
  key: string
  name: string
  /** Sub-heading, e.g. "4 exercises · ~45 min". */
  sub: string
  exercises: Exercise[]
  /**
   * Optional per-day training-week counter, for split routines trained on a
   * rolling schedule where days advance independently. When set it overrides
   * the program-wide {@link GymState.week} for this day (see `effectiveWeek`);
   * when absent the day follows the global week — so single-track programs are
   * unaffected.
   */
  cycle?: number
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
  /**
   * The prescription this session was performed against. Stored so an
   * already-logged session can be re-computed correctly when edited (the
   * live `targets[id]` has by then advanced to next time's prescription).
   * Optional for backwards-compatibility with pre-existing/legacy logs.
   */
  target?: Target
}

/** The prescription for the next time an exercise is performed. */
export interface Target {
  weight: number
  /** Lower bound of the rep target for the next session. */
  reps: number
  /** Upper bound of the rep target for the next session. */
  repsHigh: number
  /**
   * Fixed-rep mode only: the un-deloaded working weight. A scheduled deload
   * sets `weight` to a fraction of `base` while keeping `base` intact, so the
   * week after a deload resumes the working weight instead of building up from
   * the light one. Absent for normal double-progression exercises.
   */
  base?: number
}

/** User-tunable behaviour. */
export interface Settings {
  /** Consecutive stalled weeks before the engine suggests a deload. */
  deloadAfterStalls: number
  /** Fraction of weight removed on a deload (e.g. 0.1 = −10%). */
  deloadFactor: number
  /**
   * If > 0, a **scheduled** deload every Nth training week (week % N === 0),
   * used by fixed-rep plans that build in a planned light week. 0 = off
   * (the default; normal users rely on the stall-based deload above).
   */
  deloadEveryWeeks?: number
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
