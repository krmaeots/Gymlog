/** Design tokens shared across components (mirrors the CSS variables). */
export const colors = {
  bg: '#0d0d0d',
  surface: '#1c1c1c',
  surface2: '#161616',
  border: '#272727',
  text: '#f0f0f0',
  muted: '#777',
  faint: '#555',
  accent: '#e8c547',
  green: '#4caf6e',
} as const

/** Colour + label per progression change type. */
export const changeMeta: Record<
  import('./domain/types').ChangeType,
  { color: string; pill: 'up' | 'nudge' | 'same' | 'down' }
> = {
  weight_up: { color: colors.green, pill: 'up' },
  reps_up: { color: colors.green, pill: 'up' },
  reps_nudge: { color: colors.accent, pill: 'nudge' },
  same: { color: colors.faint, pill: 'same' },
  deload: { color: '#e87c47', pill: 'down' },
}
