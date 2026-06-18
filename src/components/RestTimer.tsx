import { useRestTimer } from '../store/useRestTimer'
import { colors } from '../theme'

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Floating rest-timer bar shown above the bottom nav while a rest is active. */
export function RestTimer() {
  const { active, running, remaining, duration, toggle, addTime, dismiss } = useRestTimer()
  if (!active) return null

  const done = remaining <= 0
  const pct = duration > 0 ? (remaining / duration) * 100 : 0

  const btn = {
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as const

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(64px + env(safe-area-inset-bottom))',
        zIndex: 900,
        padding: '0 12px',
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: '0 auto',
          background: colors.surface,
          border: `1px solid ${done ? colors.green : colors.border}`,
          borderRadius: 12,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 900,
                fontSize: 22,
                color: done ? colors.green : colors.accent,
              }}
            >
              {done ? 'Puhkus läbi!' : mmss(remaining)}
            </span>
            <span style={{ fontSize: 11, color: colors.faint }}>puhkus</span>
          </div>
          <div style={{ height: 3, background: colors.border, borderRadius: 2, marginTop: 6 }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: done ? colors.green : colors.accent,
                borderRadius: 2,
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>
        <button style={btn} onClick={() => addTime(-15)} aria-label="−15 sekundit">
          −15
        </button>
        <button style={btn} onClick={() => addTime(15)} aria-label="+15 sekundit">
          +15
        </button>
        {!done && (
          <button style={btn} onClick={toggle} aria-label={running ? 'Paus' : 'Jätka'}>
            {running ? '⏸' : '▶'}
          </button>
        )}
        <button
          style={{ ...btn, color: colors.faint }}
          onClick={dismiss}
          aria-label="Sulge taimer"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
