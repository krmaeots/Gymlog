import { useToast } from '../store/useToast'
import { colors } from '../theme'

export function Toast() {
  const { message, visible } = useToast()
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 80}px)`,
        background: colors.surface,
        border: `1px solid #333`,
        color: colors.text,
        fontWeight: 600,
        fontSize: 13,
        padding: '10px 20px',
        borderRadius: 30,
        zIndex: 999,
        transition: 'transform 0.3s ease',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        maxWidth: '90vw',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {message}
    </div>
  )
}
