import { describe, expect, it } from 'vitest'
import { buildLogUpdate } from './logging'
import { DEFAULT_SETTINGS } from './defaultProgram'
import type { Exercise, SetEntry, Target } from './types'

const bench: Exercise = {
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

const target: Target = { weight: 40, reps: 6, repsHigh: 8 }
const sets = (...specs: [number, number][]): SetEntry[] =>
  specs.map(([weight, reps]) => ({ weight, reps }))

const base = {
  exercise: bench,
  currentTarget: target,
  week: 1,
  settings: DEFAULT_SETTINGS,
  date: '2026-01-01T00:00:00.000Z',
}

describe('buildLogUpdate', () => {
  it('appends a new entry and stores the session target', () => {
    const r = buildLogUpdate({ ...base, sets: sets([40, 8], [40, 8], [40, 8], [40, 8]), history: [] })
    expect(r.logs).toHaveLength(1)
    expect(r.logs[0]!.target).toEqual(target)
    expect(r.change).toBe('weight_up')
    expect(r.nextTarget.weight).toBe(42.5)
  })

  it('replaces (not appends) when re-logging the same week', () => {
    const first = buildLogUpdate({
      ...base,
      sets: sets([40, 8], [40, 8], [40, 8], [40, 8]),
      history: [],
    })
    // Edit: the user actually only hit 6 reps; recompute from the SAME stored
    // session target (40), not the advanced 42.5 — and replace the entry.
    const edited = buildLogUpdate({
      ...base,
      sets: sets([40, 6], [40, 6], [40, 6], [40, 6]),
      currentTarget: first.nextTarget, // live target has advanced to 42.5
      history: first.logs,
    })
    expect(edited.logs).toHaveLength(1) // replaced, not appended
    expect(edited.change).toBe('same')
    expect(edited.nextTarget.weight).toBe(40) // recomputed from the 40 session, not 42.5
  })

  it('appends across different weeks', () => {
    const wk1 = buildLogUpdate({ ...base, sets: sets([40, 6], [40, 6], [40, 6], [40, 6]), history: [] })
    const wk2 = buildLogUpdate({
      ...base,
      week: 2,
      sets: sets([40, 8], [40, 8], [40, 8], [40, 8]),
      currentTarget: wk1.nextTarget,
      history: wk1.logs,
    })
    expect(wk2.logs).toHaveLength(2)
  })
})
