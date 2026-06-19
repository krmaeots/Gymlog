import type { CSSProperties } from 'react'
import { colors } from '../theme'

export type View = 'workout' | 'history' | 'program' | 'admin'

const ITEMS: { key: View; icon: string; label: string }[] = [
  { key: 'workout', icon: '🏋️', label: 'Treening' },
  { key: 'history', icon: '📈', label: 'Ajalugu' },
  { key: 'program', icon: '⚙️', label: 'Kava' },
]

const ADMIN_ITEM = { key: 'admin', icon: '🛡️', label: 'Admin' } as const

export function BottomNav({
  view,
  onChange,
  showAdmin = false,
}: {
  view: View
  onChange: (v: View) => void
  showAdmin?: boolean
}) {
  const items = showAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS
  return (
    <nav style={S.nav}>
      {items.map((item) => {
        const active = view === item.key
        return (
          <button key={item.key} style={S.item(active)} onClick={() => onChange(item.key)} aria-current={active}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

const S = {
  nav: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 950,
    display: 'flex',
    background: colors.surface2,
    borderTop: `1px solid ${colors.border}`,
    paddingBottom: 'env(safe-area-inset-bottom)',
  } as CSSProperties,
  item: (active: boolean): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '8px 0 10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    color: active ? colors.accent : colors.faint,
  }),
}
