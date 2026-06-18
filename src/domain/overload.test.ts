import { describe, expect, it } from 'vitest'
import {
  calcNext,
  estimate1RM,
  floorToStep,
  isPersonalRecord,
  roundWeight,
  sessionVolume,
  topSetWeight,
} from './overload'
import type { Exercise, LogEntry, SetEntry, Target } from './types'

const weighted: Exercise = {
  id: 'bench',
  name: 'Bench',
  note: '',
  sets: 4,
  repsLow: 6,
  repsHigh: 8,
  weightStart: 40,
  weightStep: 2.5,
  hasWeight: true,
}

const bodyweight: Exercise = {
  id: 'pullup',
  name: 'Pull-up',
  note: '',
  sets: 3,
  repsLow: 6,
  repsHigh: 10,
  weightStart: 0,
  weightStep: 2.5,
  hasWeight: false,
}

const target: Target = { weight: 40, reps: 6, repsHigh: 8 }

const sets = (...specs: [number, number][]): SetEntry[] =>
  specs.map(([weight, reps]) => ({ weight, reps }))

const log = (change: LogEntry['change'], performed: SetEntry[] = []): LogEntry => ({
  week: 1,
  date: '2026-01-01T00:00:00.000Z',
  sets: performed,
  pr: false,
  change,
})

describe('helpers', () => {
  it('rounds away float drift', () => {
    expect(roundWeight(0.1 + 0.2)).toBe(0.3)
  })

  it('floors to a weight step, never below one step', () => {
    expect(floorToStep(36, 2.5)).toBe(35)
    expect(floorToStep(36, 5)).toBe(35)
    expect(floorToStep(1, 5)).toBe(5) // clamped up to one step
  })

  it('estimates 1RM with Epley', () => {
    expect(estimate1RM(100, 0)).toBe(0)
    expect(estimate1RM(60, 10)).toBe(80) // 60 * (1 + 10/30)
  })

  it('computes top set and volume', () => {
    expect(topSetWeight(weighted, sets([40, 8], [42.5, 6]))).toBe(42.5)
    expect(topSetWeight(bodyweight, sets([0, 10]))).toBe(0)
    expect(sessionVolume(sets([40, 8], [40, 6]))).toBe(40 * 8 + 40 * 6)
  })
})

describe('isPersonalRecord', () => {
  it('is a PR on the very first session', () => {
    expect(isPersonalRecord(weighted, sets([40, 8]), [])).toBe(true)
  })

  it('weighted: heavier top set is a PR', () => {
    const history = [log('same', sets([40, 8]))]
    expect(isPersonalRecord(weighted, sets([42.5, 6]), history)).toBe(true)
    expect(isPersonalRecord(weighted, sets([40, 8]), history)).toBe(false)
  })

  it('bodyweight: more total reps is a PR', () => {
    const history = [log('same', sets([0, 8], [0, 8]))]
    expect(isPersonalRecord(bodyweight, sets([0, 9], [0, 8]), history)).toBe(true)
    expect(isPersonalRecord(bodyweight, sets([0, 8], [0, 8]), history)).toBe(false)
  })
})

describe('calcNext — base double progression', () => {
  it('adds weight when most sets hit the top of the range', () => {
    const next = calcNext(weighted, sets([40, 8], [40, 8], [40, 8], [40, 7]), target)
    expect(next.change).toBe('weight_up')
    expect(next.weight).toBe(42.5) // actual top set + step
    expect(next.reps).toBe(6) // reset to bottom of range
    expect(next.repsHigh).toBe(8)
  })

  it('adds weight on top of the ACTUAL heaviest set, not the target', () => {
    // User went heavier than prescribed and still hit top reps.
    const next = calcNext(weighted, sets([45, 8], [45, 8], [45, 8], [45, 8]), target)
    expect(next.change).toBe('weight_up')
    expect(next.weight).toBe(47.5)
  })

  it('nudges the rep target when only some sets hit top', () => {
    const next = calcNext(weighted, sets([40, 8], [40, 6], [40, 6], [40, 6]), target)
    expect(next.change).toBe('reps_nudge')
    expect(next.weight).toBe(40)
    expect(next.reps).toBe(7)
  })

  it('repeats the same prescription when nothing hits top', () => {
    const next = calcNext(weighted, sets([40, 6], [40, 6], [40, 6], [40, 6]), target)
    expect(next.change).toBe('same')
    expect(next.weight).toBe(40)
    expect(next.reps).toBe(6)
  })

  it('bodyweight: adds a rep when the range is cleared', () => {
    const bwTarget: Target = { weight: 0, reps: 6, repsHigh: 10 }
    const next = calcNext(bodyweight, sets([0, 10], [0, 10], [0, 10]), bwTarget)
    expect(next.change).toBe('reps_up')
    expect(next.reps).toBe(7)
    expect(next.repsHigh).toBe(11)
  })

  it('adds weight on the heaviest set that HIT TOP reps, not a heavier failed set', () => {
    // A heavy top single (50×5) failed the rep target; the working sets at 40
    // hit it. Progression must build on 40, not 50.
    const next = calcNext(weighted, sets([50, 5], [40, 8], [40, 8], [40, 8]), target)
    expect(next.change).toBe('weight_up')
    expect(next.weight).toBe(42.5)
  })

  it('single-set exercise does NOT progress on a failed set (no off-by-one)', () => {
    const single: Exercise = { ...weighted, sets: 1 }
    const fail = calcNext(single, sets([40, 5]), target)
    expect(fail.change).toBe('same')
    const win = calcNext(single, sets([40, 8]), target)
    expect(win.change).toBe('weight_up')
    expect(win.weight).toBe(42.5)
  })

  it('single-set bodyweight does NOT progress on a failed set', () => {
    const single: Exercise = { ...bodyweight, sets: 1 }
    const bwTarget: Target = { weight: 0, reps: 6, repsHigh: 10 }
    expect(calcNext(single, sets([0, 6]), bwTarget).change).toBe('same')
    expect(calcNext(single, sets([0, 10]), bwTarget).change).toBe('reps_up')
  })
})

describe('calcNext — deload layer', () => {
  const deloadSettings = { deloadAfterStalls: 3, deloadFactor: 0.1 }

  it('does not deload before the stall threshold is reached', () => {
    const history = [log('same'), log('same')] // 2 prior stalls + this = 3, threshold 3 -> deload
    const next = calcNext(weighted, sets([40, 6], [40, 6], [40, 6], [40, 6]), target, history, {
      deloadAfterStalls: 4,
      deloadFactor: 0.1,
    })
    expect(next.change).toBe('same')
  })

  it('deloads after the configured number of consecutive stalls', () => {
    const history = [log('same'), log('same')] // 2 prior + current stall = 3
    const next = calcNext(
      weighted,
      sets([40, 6], [40, 6], [40, 6], [40, 6]),
      target,
      history,
      deloadSettings,
    )
    expect(next.change).toBe('deload')
    expect(next.weight).toBe(35) // floor(40 * 0.9 = 36 -> step 2.5) = 35
    expect(next.reps).toBe(6)
  })

  it('never deloads a bodyweight exercise', () => {
    const bwTarget: Target = { weight: 0, reps: 6, repsHigh: 10 }
    const history = [log('same'), log('same'), log('same')]
    const next = calcNext(bodyweight, sets([0, 6], [0, 6], [0, 6]), bwTarget, history, deloadSettings)
    expect(next.change).toBe('same')
  })

  it('deloads from the prescribed target weight, not a heavier failed attempt', () => {
    const history = [log('same'), log('same')]
    // User tried 45 (and failed) during the stall, but target is still 40.
    const next = calcNext(
      weighted,
      sets([45, 5], [40, 6], [40, 6], [40, 6]),
      target,
      history,
      deloadSettings,
    )
    expect(next.change).toBe('deload')
    expect(next.weight).toBe(35) // 40 * 0.9 = 36 → floor to 2.5 = 35, independent of the 45 attempt
  })

  it('resets the stall streak after any progress', () => {
    const history = [log('same'), log('weight_up'), log('same')] // streak broken by weight_up
    const next = calcNext(
      weighted,
      sets([40, 6], [40, 6], [40, 6], [40, 6]),
      target,
      history,
      deloadSettings,
    )
    // Only 1 trailing stall + current = 2 < 3 -> no deload.
    expect(next.change).toBe('same')
  })
})
