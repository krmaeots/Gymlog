import { calcNext, isPersonalRecord } from './overload'
import type { ChangeType, Exercise, LogEntry, SetEntry, Settings, Target } from './types'

/** Result of logging (or re-logging) a session for one exercise. */
export interface LogUpdate {
  /** The new full log history for this exercise. */
  logs: LogEntry[]
  /** The next-session prescription to store as the exercise's target. */
  nextTarget: Target
  change: ChangeType
  pr: boolean
}

/**
 * Compute the log + next target after a session is recorded.
 *
 * If the latest entry is for the current week AND the same calendar day this is
 * treated as an **edit**: that entry is replaced (not appended) and progression
 * is recomputed from the prescription that session was performed against — so
 * correcting a mistyped set yields the right next-week target instead of
 * compounding. A session on a different day always appends (no overwrite).
 */
export function buildLogUpdate(args: {
  exercise: Exercise
  sets: SetEntry[]
  /** The live target for the exercise (next-session prescription). */
  currentTarget: Target
  /** Existing log history (oldest first). */
  history: LogEntry[]
  week: number
  settings: Settings
  /** ISO timestamp for the entry (caller supplies, keeping this pure). */
  date: string
}): LogUpdate {
  const { exercise, sets, currentTarget, history, week, settings, date } = args

  const last = history.at(-1)
  // An edit is re-logging the SAME session: same week AND same calendar day.
  // On a rolling multi-day split the week counter may not have advanced between
  // a day's sessions, so the same-day check stops a later session from silently
  // overwriting an earlier one — it appends a new entry instead.
  const day = date.slice(0, 10)
  const sameDay = day !== '' && last?.date.slice(0, 10) === day
  const isEdit = last?.week === week && sameDay

  // The prescription this session was (or should be) judged against: for an
  // edit, the target recorded on the original entry; otherwise the live target.
  const sessionTarget: Target = isEdit ? (last?.target ?? currentTarget) : currentTarget
  const priorHistory = isEdit ? history.slice(0, -1) : history

  const next = calcNext(exercise, sets, sessionTarget, priorHistory, settings, week)
  const pr = isPersonalRecord(exercise, sets, priorHistory)

  const entry: LogEntry = { week, date, sets, pr, change: next.change, target: sessionTarget }

  const nextTarget: Target = { weight: next.weight, reps: next.reps, repsHigh: next.repsHigh }
  // Fixed-rep plans carry the un-deloaded working weight forward; omit otherwise.
  if (next.base !== undefined) nextTarget.base = next.base

  return {
    logs: [...priorHistory, entry],
    nextTarget,
    change: next.change,
    pr,
  }
}
