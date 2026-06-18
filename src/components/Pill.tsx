import type { CSSProperties } from 'react'

type PillKind = 'up' | 'nudge' | 'same' | 'down'

const styles: Record<PillKind, CSSProperties> = {
  up: { background: '#1a3a25', color: '#4caf6e' },
  nudge: { background: '#2a2a1a', color: '#e8c547' },
  same: { background: '#222', color: '#555' },
  down: { background: '#3a261a', color: '#e87c47' },
}

export function Pill({ kind, children }: { kind: PillKind; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 20,
        marginLeft: 8,
        whiteSpace: 'nowrap',
        ...styles[kind],
      }}
    >
      {children}
    </span>
  )
}
