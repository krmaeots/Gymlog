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
        top: 'calc(12px + env(safe-area-inset-top))',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : -90}px)`,
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
