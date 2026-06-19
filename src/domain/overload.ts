import type { ChangeType, Exercise, LogEntry, Settings, SetEntry, Target } from './types'

/**
 * Progressive-overload engine.
 *
 * This is the core of GymLog: given how a set of an exercise was actually
 * performed, it decides what to prescribe next week. The base "double
 * progression" logic is ported verbatim from the original app; a deload layer
 * is added on top to break plateaus.
 */

/** Round a weight to 2 decimals to avoid float drift (e.g. 0.1 + 0.2). */
export function roundWeight(kg: number): number {
  return Math.round(kg * 100) / 100
}

/** Snap a weight down to a multiple of `step`, never below one step. */
export function floorToStep(kg: number, step: number): number {
  if (step <= 0) return roundWeight(kg)
  return roundWeight(Math.max(step, Math.floor(kg / step) * step))
}

/** Epley estimated one-rep max. Useful for comparing sets at different reps. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  return roundWeight(weight * (1 + reps / 30))
}

/** Heaviest weight across the performed sets (0 for bodyweight). */
export function topSetWeight(exercise: Exercise, sets: SetEntry[]): number {
  if (!exercise.hasWeight || sets.length === 0) return 0
  return Math.max(...sets.map((s) => s.weight))
}

/** Total tonnage (Σ weight × reps) of a session. */
export function sessionVolume(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
}

/**
 * Whether `sets` beat the most recent log entry, marking a personal record.
 * Weighted lifts: heavier top set. Bodyweight: more total reps (or first ever).
 */
export function isPersonalRecord(
  exercise: Exercise,
  sets: SetEntry[],
  history: LogEntry[],
): boolean {
  const prev = history.at(-1)
  if (!prev) return true
  if (exercise.hasWeight) {
    return topSetWeight(exercise, sets) > topSetWeight(exercise, prev.sets)
  }
  const totalReps = sets.reduce((n, s) => n + s.reps, 0)
  const prevReps = prev.sets.reduce((n, s) => n + s.reps, 0)
  return totalReps > prevReps
}

/** Count the run of trailing sessions that made no progress (`change === 'same'`). */
function trailingStalls(history: LogEntry[]): number {
  let n = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.change === 'same') n++
    else break
  }
  return n
}

/**
 * Base double-progression decision (ported from the original `calcNext`).
 * Returns the prescription *and* the resulting change type, ignoring deloads.
 */
function baseProgression(exercise: Exercise, sets: SetEntry[], target: Target): Target & { change: ChangeType } {
  // Heaviest weight handled this session (used for the non-progression branches).
  const baseWeight = topSetWeight(exercise, sets)

  // Sets that reached the top of the rep range, and the heaviest weight among them.
  const topSets = sets.filter((s) => s.reps >= target.repsHigh)
  const hitTop = topSets.length
  const topReachedWeight = topSets.length ? Math.max(...topSets.map((s) => s.weight)) : 0

  // "Most" of the prescribed sets — 3/4 or 2/3 — but always require at least one
  // top-rep set. The `Math.max(1, …)` guards single-set / zero-set exercises,
  // where `sets - 1 <= 0` would otherwise make `majority` unconditionally true.
  const majority = hitTop >= Math.max(1, exercise.sets - 1)

  if (exercise.hasWeight && exercise.weightStep > 0 && majority) {
    // Most sets hit top reps → add weight on top of the heaviest set that
    // actually reached the rep target (NOT a heavier failed/top single), and
    // reset the rep target to the bottom of the range.
    return {
      weight: roundWeight(topReachedWeight + exercise.weightStep),
      reps: exercise.repsLow,
      repsHigh: exercise.repsHigh,
      change: 'weight_up',
    }
  }
  if (!exercise.hasWeight && majority) {
    // Bodyweight lift cleared the range → chase one more rep.
    return { weight: 0, reps: target.reps + 1, repsHigh: target.repsHigh + 1, change: 'reps_up' }
  }
  if (hitTop >= 1) {
    // Some sets hit top → keep the weight, nudge the rep target up.
    return {
      weight: baseWeight,
      reps: Math.min(target.reps + 1, target.repsHigh),
      repsHigh: target.repsHigh,
      change: 'reps_nudge',
    }
  }
  // Nothing hit top → repeat the same prescription.
  return { weight: baseWeight, reps: target.reps, repsHigh: target.repsHigh, change: 'same' }
}

/**
 * Whether `week` is a scheduled deload (planned light) week for these settings.
 * Lets the UI flag the deload *before* logging, so the reduced weight isn't
 * mistaken for an error.
 */
export function isScheduledDeloadWeek(
  week: number,
  settings?: Pick<Settings, 'deloadEveryWeeks'>,
): boolean {
  const every = settings?.deloadEveryWeeks ?? 0
  return every > 0 && week > 0 && week % every === 0
}

/**
 * Per-set prescribed weights for a fixed-rep exercise given the current working
 * (top-set) weight. A `weightScheme` (e.g. `[45,45,40,40]`) is applied as fixed
 * offsets from its own max, so a back-off/pyramid plan tracks the working weight
 * as it progresses. Without a `weightScheme` every set uses the working weight.
 */
export function perSetWeights(exercise: Exercise, workingWeight: number): number[] {
  const n = Math.max(1, exercise.sets)
  const scheme = exercise.weightScheme
  if (!exercise.hasWeight || !scheme || scheme.length === 0) {
    return Array.from({ length: n }, () => workingWeight)
  }
  const top = Math.max(...scheme)
  return Array.from({ length: n }, (_, i) => {
    const offset = (scheme[Math.min(i, scheme.length - 1)] ?? top) - top
    return Math.max(0, roundWeight(workingWeight + offset))
  })
}

/**
 * Fixed-rep progression for coach-prescribed plans (`exercise.repScheme`).
 *
 * The per-set reps are pinned by the plan every week, so unlike double
 * progression this NEVER changes the reps — it only moves the **weight**:
 * once the prescribed reps are met on a majority of sets, weight rises by one
 * step (built on the heaviest set that actually hit its target). A *scheduled*
 * deload (`settings.deloadEveryWeeks`) drops the prescription to `deloadFactor`
 * of the working weight on every Nth week and resumes the working weight after,
 * carrying the un-deloaded weight in `target.base`. Bodyweight lifts simply
 * hold the prescribed reps.
 *
 * The engine advances a single working weight (the top set). A back-off/pyramid
 * plan is expressed via `exercise.weightScheme` and rendered per-set by
 * {@link perSetWeights} — progression stays uniform on the top set, so this is
 * not independent per-set progression.
 *
 * @param week  The training week this session belongs to (drives the deload
 *              cadence). 0/absent disables the scheduled deload.
 */
function fixedRepsNext(
  exercise: Exercise,
  sets: SetEntry[],
  target: Target,
  week: number,
  settings?: Pick<Settings, 'deloadFactor' | 'deloadEveryWeeks'>,
): Target & { change: ChangeType } {
  const scheme = exercise.repScheme as number[]
  const repsLow = Math.min(...scheme)
  const repsHigh = Math.max(...scheme)
  const base = target.base ?? target.weight
  const every = settings?.deloadEveryWeeks ?? 0
  const factor = settings?.deloadFactor ?? 0.1
  const canWeight = exercise.hasWeight && exercise.weightStep > 0

  // The week just logged is itself a scheduled deload (light maintenance week).
  const loggedDeloadWeek = every > 0 && week > 0 && week % every === 0

  let working: number
  let change: ChangeType
  if (loggedDeloadWeek || !canWeight) {
    // Resume (never progress from) the working weight after a deload; bodyweight
    // lifts just hold the prescribed reps.
    working = base
    change = 'same'
  } else {
    // Did she hit the prescribed reps on (almost) all sets? Compare each
    // performed set to its scheme entry (clamped if the set count drifted).
    const met = sets.filter(
      (s, i) => s.reps >= (scheme[Math.min(i, scheme.length - 1)] ?? repsHigh),
    )
    if (met.length >= Math.max(1, exercise.sets - 1)) {
      working = roundWeight(Math.max(...met.map((s) => s.weight)) + exercise.weightStep)
      change = 'weight_up'
    } else {
      working = topSetWeight(exercise, sets) || base
      change = 'same'
    }
  }

  // If the upcoming week is a scheduled deload, prescribe the reduced weight but
  // keep the working weight in `base` so the following week resumes it.
  if (canWeight && every > 0 && (week + 1) % every === 0) {
    return {
      weight: floorToStep(working * (1 - factor), exercise.weightStep),
      reps: repsLow,
      repsHigh,
      base: working,
      change: 'deload',
    }
  }
  return canWeight
    ? { weight: working, reps: repsLow, repsHigh, base: working, change }
    : { weight: 0, reps: repsLow, repsHigh, change }
}

/**
 * Decide the next prescription for an exercise after a logged session.
 *
 * @param exercise  The exercise definition (rep range, step, weighted?).
 * @param sets      The sets the user actually performed this session.
 * @param target    The prescription that was in effect for this session.
 * @param history   Prior log entries for this exercise (oldest first), NOT
 *                   including the session being logged now.
 * @param settings  Deload tuning (after how many stalls, by how much).
 * @param week      Training week of this session — only used by fixed-rep plans
 *                  for the scheduled-deload cadence; ignored otherwise.
 */
export function calcNext(
  exercise: Exercise,
  sets: SetEntry[],
  target: Target,
  history: LogEntry[] = [],
  settings?: Pick<Settings, 'deloadAfterStalls' | 'deloadFactor' | 'deloadEveryWeeks'>,
  week?: number,
): Target & { change: ChangeType } {
  // Coach-prescribed plans use fixed reps + weight-only progression.
  if (exercise.repScheme && exercise.repScheme.length > 0) {
    return fixedRepsNext(exercise, sets, target, week ?? 0, settings)
  }

  const result = baseProgression(exercise, sets, target)

  // Deload only makes sense for weighted lifts that just stalled again.
  const deloadAfter = settings?.deloadAfterStalls ?? 0
  if (
    result.change === 'same' &&
    exercise.hasWeight &&
    exercise.weightStep > 0 &&
    deloadAfter > 0 &&
    trailingStalls(history) + 1 >= deloadAfter
  ) {
    const factor = settings?.deloadFactor ?? 0.1
    // Deload from the prescription that stalled (target.weight), so the result
    // is deterministic and independent of any heavier failed attempts.
    const deloaded = floorToStep(target.weight * (1 - factor), exercise.weightStep)
    // Only deload if it actually drops the weight; otherwise keep repeating.
    if (deloaded < target.weight) {
      return {
        weight: deloaded,
        reps: exercise.repsLow,
        repsHigh: exercise.repsHigh,
        change: 'deload',
      }
    }
  }

  return result
}
