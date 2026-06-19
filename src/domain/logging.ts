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
 * If the latest entry is already for the current week this is treated as an
 * **edit**: that entry is replaced (not appended) and progression is recomputed
 * from the prescription that session was performed against — so correcting a
 * mistyped set yields the right next-week target instead of compounding.
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
  const isEdit = last?.week === week

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
