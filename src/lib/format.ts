import type { Exercise, LogEntry, Target } from '../domain/types'

/** Format a weight without trailing ".0" (e.g. 42.5 → "42.5", 40 → "40"). */
export function fmtWeight(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * "40kg · 6–8k" for weighted, "6–10 kordi" for bodyweight. Fixed-rep plans show
 * the exact per-set scheme instead of a range: "40kg · 10·10·9·8k".
 */
export function targetText(exercise: Exercise, target: Target): string {
  const reps =
    exercise.repScheme && exercise.repScheme.length > 0
      ? exercise.repScheme.join('·')
      : `${target.reps}–${target.repsHigh}`
  return exercise.hasWeight ? `${fmtWeight(target.weight)}kg · ${reps}k` : `${reps} kordi`
}

/** "40kg × 8 · 40kg × 7" for weighted, "8k · 7k" for bodyweight. */
export function setsSummary(exercise: Exercise, log: LogEntry): string {
  return exercise.hasWeight
    ? log.sets.map((s) => `${fmtWeight(s.weight)}kg×${s.reps}`).join(' · ')
    : log.sets.map((s) => `${s.reps}k`).join(' · ')
}

/** Short, localized date label for history rows (Estonian). */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('et-EE', { day: 'numeric', month: 'short' })
}
