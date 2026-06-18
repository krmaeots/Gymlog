import type { Day, Exercise, Program } from '../domain/types'

/** Find an exercise (and its day) by exercise id. */
export function findExercise(
  program: Program,
  exerciseId: string,
): { day: Day; exercise: Exercise } | undefined {
  for (const day of program.days) {
    const exercise = day.exercises.find((e) => e.id === exerciseId)
    if (exercise) return { day, exercise }
  }
  return undefined
}

/** Every exercise in the program, flattened, in display order. */
export function allExercises(program: Program): Exercise[] {
  return program.days.flatMap((d) => d.exercises)
}

/** Immutably map a single day, matched by key. */
function mapDay(program: Program, dayKey: string, fn: (day: Day) => Day): Program {
  return { days: program.days.map((d) => (d.key === dayKey ? fn(d) : d)) }
}

export function addExercise(program: Program, dayKey: string, exercise: Exercise): Program {
  return mapDay(program, dayKey, (d) => ({ ...d, exercises: [...d.exercises, exercise] }))
}

export function updateExercise(
  program: Program,
  dayKey: string,
  exerciseId: string,
  patch: Partial<Exercise>,
): Program {
  return mapDay(program, dayKey, (d) => ({
    ...d,
    exercises: d.exercises.map((e) => (e.id === exerciseId ? { ...e, ...patch } : e)),
  }))
}

export function removeExercise(program: Program, dayKey: string, exerciseId: string): Program {
  return mapDay(program, dayKey, (d) => ({
    ...d,
    exercises: d.exercises.filter((e) => e.id !== exerciseId),
  }))
}

/** Move an exercise up (-1) or down (+1) within its day. */
export function moveExercise(
  program: Program,
  dayKey: string,
  exerciseId: string,
  direction: -1 | 1,
): Program {
  return mapDay(program, dayKey, (d) => {
    const idx = d.exercises.findIndex((e) => e.id === exerciseId)
    const next = idx + direction
    if (idx === -1 || next < 0 || next >= d.exercises.length) return d
    const exercises = [...d.exercises]
    const [moved] = exercises.splice(idx, 1)
    exercises.splice(next, 0, moved!)
    return { ...d, exercises }
  })
}

export function addDay(program: Program, day: Day): Program {
  return { days: [...program.days, day] }
}

export function updateDay(program: Program, dayKey: string, patch: Partial<Omit<Day, 'exercises'>>): Program {
  return mapDay(program, dayKey, (d) => ({ ...d, ...patch }))
}

export function removeDay(program: Program, dayKey: string): Program {
  return { days: program.days.filter((d) => d.key !== dayKey) }
}
