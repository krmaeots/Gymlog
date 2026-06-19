import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAM, DEFAULT_SETTINGS } from '../domain/defaultProgram'
import type { GymState } from '../domain/types'
import {
  CURRENT_SCHEMA_VERSION,
  coerceState,
  loadCachedState,
  reconcileEntries,
  saveCachedState,
  seedState,
  userCacheKey,
} from './storage'

const firstExerciseId = DEFAULT_PROGRAM.days[0]!.exercises[0]!.id

describe('seedState', () => {
  it('seeds a target and empty log for every program exercise', () => {
    const s = seedState()
    const ids = DEFAULT_PROGRAM.days.flatMap((d) => d.exercises.map((e) => e.id))
    for (const id of ids) {
      expect(s.targets[id]).toBeDefined()
      expect(s.logs[id]).toEqual([])
    }
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})

describe('reconcileEntries', () => {
  it('prunes targets/logs for exercises not in the program', () => {
    const base = seedState()
    const polluted: GymState = {
      ...base,
      targets: { ...base.targets, ghost: { weight: 99, reps: 5, repsHigh: 8 } },
      logs: { ...base.logs, ghost: [{ week: 1, date: '', sets: [], pr: false, change: 'same' }] },
    }
    const reconciled = reconcileEntries(polluted)
    expect(reconciled.targets.ghost).toBeUndefined()
    expect(reconciled.logs.ghost).toBeUndefined()
    expect(reconciled.targets[firstExerciseId]).toBeDefined()
  })
})

describe('coerceState — legacy migration', () => {
  it('wraps legacy {week,logs,targets} around the default program', () => {
    const legacy = {
      week: 4,
      targets: { [firstExerciseId]: { weight: 50, reps: 6, repsHigh: 8 } },
      logs: { [firstExerciseId]: [{ week: 3, date: '', sets: [{ weight: 50, reps: 8 }], pr: true, change: 'weight_up' }] },
    }
    const s = coerceState(legacy)
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(s.week).toBe(4)
    expect(s.program).toBe(DEFAULT_PROGRAM)
    expect(s.targets[firstExerciseId]).toEqual({ weight: 50, reps: 6, repsHigh: 8 })
    expect(s.logs[firstExerciseId]).toHaveLength(1)
    expect(s.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('honours settings present in a legacy file (no silent reset)', () => {
    const s = coerceState({ week: 1, targets: {}, logs: {}, settings: { restSeconds: 90 } })
    expect(s.settings.restSeconds).toBe(90)
    expect(s.settings.deloadAfterStalls).toBe(DEFAULT_SETTINGS.deloadAfterStalls)
  })
})

describe('coerceState — sanitisation (crash/corruption resistance)', () => {
  it('replaces non-array log values with an empty array instead of crashing', () => {
    const s = coerceState({ schemaVersion: 2, program: DEFAULT_PROGRAM, logs: { [firstExerciseId]: 5 }, targets: {} })
    expect(s.logs[firstExerciseId]).toEqual([])
  })

  it('repairs log entries with invalid change/fields', () => {
    const s = coerceState({
      schemaVersion: 2,
      program: DEFAULT_PROGRAM,
      logs: { [firstExerciseId]: [{ week: 'x', sets: 'nope', change: 'bogus' }] },
      targets: {},
    })
    const entry = s.logs[firstExerciseId]![0]!
    expect(entry.week).toBe(1)
    expect(entry.sets).toEqual([])
    expect(entry.change).toBe('same')
  })

  it('drops malformed targets so they are reseeded from the program', () => {
    const s = coerceState({
      schemaVersion: 2,
      program: DEFAULT_PROGRAM,
      targets: { [firstExerciseId]: { weight: 'NaN', reps: 6 } },
      logs: {},
    })
    // reseeded to the program default rather than carrying corrupt values
    expect(Number.isFinite(s.targets[firstExerciseId]!.weight)).toBe(true)
  })

  it('falls back to the default program when the imported program is malformed', () => {
    const s = coerceState({ schemaVersion: 2, program: { days: 'not-an-array' }, targets: {}, logs: {} })
    expect(s.program).toBe(DEFAULT_PROGRAM)
  })

  it('returns a fresh seed for non-object input', () => {
    expect(coerceState(null).schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(coerceState('garbage').week).toBe(1)
  })
})

describe('export → import round-trip', () => {
  it('is faithful for a current-schema state', () => {
    const original = seedState()
    original.week = 7
    original.settings.restSeconds = 150
    const roundTripped = coerceState(JSON.parse(JSON.stringify(original)))
    expect(roundTripped).toEqual(original)
  })
})

describe('per-profile cache (cloud mode)', () => {
  it('keys the cache by profile id', () => {
    expect(userCacheKey('abc')).toBe('gymlog:user:abc')
  })

  it('round-trips a cached profile state', () => {
    const s = seedState()
    s.week = 5
    expect(saveCachedState('u1', s)).toBe(true)
    expect(loadCachedState('u1')?.week).toBe(5)
  })

  it('returns null when no cache exists', () => {
    expect(loadCachedState('missing-profile')).toBeNull()
  })

  it('sanitises corrupt cached data on load (reuses coerceState)', () => {
    localStorage.setItem(
      userCacheKey('u2'),
      JSON.stringify({ schemaVersion: 2, program: DEFAULT_PROGRAM, logs: { [firstExerciseId]: 5 }, targets: {} }),
    )
    expect(loadCachedState('u2')?.logs[firstExerciseId]).toEqual([])
  })
})
