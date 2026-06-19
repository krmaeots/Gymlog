import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSession } from '../store/useSession'
import { colors } from '../theme'

const MIN_PIN = 4

export function LoginView() {
  const { profilesStatus, profiles, error, lastUserName, loadProfiles, login } = useSession()
  const [selected, setSelected] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profilesStatus === 'loading') void loadProfiles()
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Put the last-used profile first for quick re-entry.
  const ordered = useMemo(() => {
    if (!lastUserName) return profiles
    return [...profiles].sort((a, b) =>
      a.name === lastUserName ? -1 : b.name === lastUserName ? 1 : 0,
    )
  }, [profiles, lastUserName])

  const submit = async () => {
    if (!selected || pin.length < MIN_PIN || busy) return
    setBusy(true)
    const ok = await login(selected, pin)
    setBusy(false)
    if (!ok) setPin('')
  }

  return (
    <div style={S.wrap}>
      <div style={S.brand}>
        GYM<span style={{ color: colors.accent }}>LOG</span>
      </div>

      {profilesStatus === 'loading' && <Spinner label="Laen kasutajaid…" />}

      {profilesStatus === 'error' && (
        <div style={S.center}>
          <p style={S.muted}>{error ?? 'Serveriga ei saa ühendust'}</p>
          <button style={S.primary} onClick={() => void loadProfiles()}>
            Proovi uuesti
          </button>
        </div>
      )}

      {profilesStatus === 'ready' && profiles.length === 0 && (
        <div style={S.center}>
          <p style={S.muted}>
            Ühtegi kasutajat pole veel. Loo esimene administraator Supabase SQL-is:
            <br />
            <code style={S.code}>select gym_bootstrap_admin('Nimi', 'PIN');</code>
          </p>
        </div>
      )}

      {profilesStatus === 'ready' && profiles.length > 0 && !selected && (
        <div style={S.list}>
          <div style={S.label}>Vali kasutaja</div>
          {ordered.map((p) => (
            <button
              key={p.id}
              style={S.userBtn}
              onClick={() => {
                setSelected(p.name)
                setPin('')
              }}
            >
              <span>{p.name}</span>
              {p.is_admin && <span style={S.badge}>admin</span>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={S.center}>
          <button style={S.back} onClick={() => setSelected(null)}>
            ← {selected}
          </button>
          <div style={S.label}>Sisesta PIN</div>
          <div style={S.dots}>
            {Array.from({ length: Math.max(MIN_PIN, pin.length) }, (_, i) => (
              <span key={i} style={S.dot(i < pin.length)} />
            ))}
          </div>
          {error && <div style={S.error}>{error}</div>}
          <Keypad
            disabled={busy}
            onDigit={(d) => setPin((p) => (p.length < 12 ? p + d : p))}
            onBackspace={() => setPin((p) => p.slice(0, -1))}
            onSubmit={submit}
            canSubmit={pin.length >= MIN_PIN && !busy}
          />
        </div>
      )}
    </div>
  )
}

function Keypad({
  onDigit,
  onBackspace,
  onSubmit,
  canSubmit,
  disabled,
}: {
  onDigit: (d: string) => void
  onBackspace: () => void
  onSubmit: () => void
  canSubmit: boolean
  disabled: boolean
}) {
  return (
    <div style={S.keypad}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} style={S.key} disabled={disabled} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <button style={S.key} disabled={disabled} onClick={onBackspace} aria-label="Kustuta">
        ⌫
      </button>
      <button style={S.key} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </button>
      <button
        style={{ ...S.key, ...S.keyOk, opacity: canSubmit ? 1 : 0.4 }}
        disabled={!canSubmit}
        onClick={onSubmit}
        aria-label="Logi sisse"
      >
        ✓
      </button>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={S.center}>
      <div style={S.spinner} />
      <p style={S.muted}>{label}</p>
    </div>
  )
}

const S = {
  wrap: {
    minHeight: '100vh',
    background: colors.bg,
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    gap: 24,
  } as CSSProperties,
  brand: { fontWeight: 900, fontSize: 28, letterSpacing: '0.04em' } as CSSProperties,
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 320 } as CSSProperties,
  list: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 } as CSSProperties,
  label: { fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.faint, alignSelf: 'center' } as CSSProperties,
  userBtn: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    color: colors.text,
    fontSize: 16,
    fontWeight: 700,
    padding: '16px 18px',
    cursor: 'pointer',
  } as CSSProperties,
  badge: { fontSize: 10, fontWeight: 700, color: colors.accent, border: `1px solid ${colors.accent}`, borderRadius: 20, padding: '2px 8px' } as CSSProperties,
  back: { background: 'none', border: 'none', color: colors.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' } as CSSProperties,
  dots: { display: 'flex', gap: 12, height: 16, alignItems: 'center' } as CSSProperties,
  dot: (filled: boolean): CSSProperties => ({
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: filled ? colors.accent : 'transparent',
    border: `2px solid ${filled ? colors.accent : colors.border}`,
  }),
  error: { color: '#e87c47', fontSize: 13, fontWeight: 600 } as CSSProperties,
  keypad: { display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12, marginTop: 4 } as CSSProperties,
  key: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    fontSize: 24,
    fontWeight: 700,
    cursor: 'pointer',
  } as CSSProperties,
  keyOk: { background: colors.green, color: '#000', border: 'none' } as CSSProperties,
  primary: { background: colors.accent, color: '#000', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' } as CSSProperties,
  muted: { color: colors.muted, fontSize: 13, lineHeight: 1.6, textAlign: 'center' } as CSSProperties,
  code: { display: 'inline-block', marginTop: 8, background: colors.surface2, padding: '4px 8px', borderRadius: 6, fontSize: 12, color: colors.accent } as CSSProperties,
  spinner: { width: 32, height: 32, border: `3px solid ${colors.border}`, borderTopColor: colors.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' } as CSSProperties,
}
