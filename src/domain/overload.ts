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
 * Decide the next prescription for an exercise after a logged session.
 *
 * @param exercise  The exercise definition (rep range, step, weighted?).
 * @param sets      The sets the user actually performed this session.
 * @param target    The prescription that was in effect for this session.
 * @param history   Prior log entries for this exercise (oldest first), NOT
 *                   including the session being logged now.
 * @param settings  Deload tuning (after how many stalls, by how much).
 */
export function calcNext(
  exercise: Exercise,
  sets: SetEntry[],
  target: Target,
  history: LogEntry[] = [],
  settings?: Pick<Settings, 'deloadAfterStalls' | 'deloadFactor'>,
): Target & { change: ChangeType } {
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
