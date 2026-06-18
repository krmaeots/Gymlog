import { Component, type ErrorInfo, type ReactNode } from 'react'
import { STORAGE_KEY } from '../lib/storage'
import { colors } from '../theme'

interface State {
  error: Error | null
}

/**
 * Catches render-time crashes (e.g. from unexpectedly corrupt persisted data)
 * and shows a recovery screen instead of a blank page — including a button to
 * clear local data, so the user can never get permanently stuck.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GymLog crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={S.wrap}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontSize: 18, margin: 0 }}>Midagi läks valesti</h1>
        <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6, maxWidth: 360 }}>
          Rakendus jooksis kokku. Proovi uuesti laadida. Kui see kordub, võivad
          salvestatud andmed olla katki — saad need lähtestada (treeningajalugu
          läheb kaotsi).
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button style={S.primary} onClick={() => location.reload()}>
            Lae uuesti
          </button>
          <button
            style={S.danger}
            onClick={() => {
              if (confirm('Kustuta kõik salvestatud andmed? Seda ei saa tagasi võtta.')) {
                try {
                  localStorage.removeItem(STORAGE_KEY)
                } catch {
                  /* ignore */
                }
                location.reload()
              }
            }}
          >
            Lähtesta andmed
          </button>
        </div>
      </div>
    )
  }
}

const S = {
  wrap: {
    minHeight: '100vh',
    background: colors.bg,
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    textAlign: 'center',
  } as React.CSSProperties,
  primary: {
    background: colors.accent,
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  } as React.CSSProperties,
  danger: {
    background: 'none',
    color: '#e87c47',
    border: '1px solid #e87c47',
    borderRadius: 8,
    padding: '10px 18px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  } as React.CSSProperties,
}
