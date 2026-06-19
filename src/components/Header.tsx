import { useRef, type CSSProperties } from 'react'
import { useGymStore } from '../store/useGymStore'
import { useSession } from '../store/useSession'
import { useToast } from '../store/useToast'
import { colors } from '../theme'
import type { SyncStatus } from '../lib/sync'

export function Header() {
  const week = useGymStore((s) => s.week)
  const importState = useGymStore((s) => s.importState)
  const resetAll = useGymStore((s) => s.resetAll)
  const showToast = useToast((s) => s.show)
  const cloudEnabled = useSession((s) => s.cloudEnabled)
  const session = useSession((s) => s.session)
  const logout = useSession((s) => s.logout)
  const syncStatus = useSession((s) => s.syncStatus)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const { schemaVersion, week, program, targets, logs, settings } = useGymStore.getState()
    const data = { schemaVersion, week, program, targets, logs, settings }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gymlog-nadal${week}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        importState(JSON.parse(String(ev.target?.result)))
        showToast('✓ Andmed laetud!')
      } catch {
        showToast('Viga faili laadimisel')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // allow re-importing the same file
  }

  const handleReset = () => {
    if (confirm('Kustuta kõik andmed ja alusta otsast?')) {
      resetAll()
      showToast('Lähtestatud')
    }
  }

  return (
    <header style={S.header}>
      <div style={S.title}>
        GYM<span style={{ color: colors.accent }}>LOG</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {cloudEnabled && session && <SyncDot status={syncStatus} />}
        <div style={S.weekBadge}>
          Nädal <strong style={{ color: colors.accent }}>{week}</strong>
        </div>
        <label style={{ ...S.btn, cursor: 'pointer' }} title="Lae andmed">
          📂
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
        </label>
        <button style={{ ...S.btn, color: colors.green, borderColor: '#2a4a35' }} onClick={handleExport} title="Salvesta andmed">
          💾
        </button>
        {cloudEnabled && session ? (
          <button style={S.userBtn} onClick={() => void logout()} title="Vaheta kasutajat">
            {session.name} ⎋
          </button>
        ) : (
          <button style={S.btn} onClick={handleReset} title="Lähtesta">
            ↺
          </button>
        )}
      </div>
    </header>
  )
}

function SyncDot({ status }: { status: SyncStatus }) {
  if (status === 'idle') return null
  const meta: Record<Exclude<SyncStatus, 'idle'>, { color: string; title: string }> = {
    saving: { color: colors.accent, title: 'Salvestan…' },
    offline: { color: colors.faint, title: 'Ühenduseta — salvestan hiljem' },
    error: { color: '#e87c47', title: 'Sünkroonimine ebaõnnestus' },
  }
  const m = meta[status]
  return <span title={m.title} style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
}

const S = {
  header: {
    background: colors.surface2,
    borderBottom: `1px solid ${colors.border}`,
    padding: '13px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  } as CSSProperties,
  title: { fontWeight: 900, fontSize: 22, letterSpacing: '0.04em', color: colors.text } as CSSProperties,
  weekBadge: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 14, fontWeight: 600, color: colors.muted } as CSSProperties,
  btn: { background: 'none', border: '1px solid #333', borderRadius: 6, color: '#888', fontSize: 16, padding: '6px 10px', cursor: 'pointer', lineHeight: 1 } as CSSProperties,
  userBtn: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, fontSize: 12, fontWeight: 700, padding: '5px 10px', cursor: 'pointer', lineHeight: 1, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
}
