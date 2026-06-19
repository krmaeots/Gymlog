import { useCallback, useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import type { GymState } from '../domain/types'
import { fmtDate } from '../lib/format'
import * as P from '../lib/program'
import { coerceState, reconcileEntries } from '../lib/storage'
import { cloud, type AdminProfile } from '../lib/supabase'
import { useSession } from '../store/useSession'
import { useToast } from '../store/useToast'
import { colors } from '../theme'
import { HistoryViewBody } from './HistoryView'
import { ProgramEditorBody, type ProgramEditApi } from './ProgramEditor'

/** A ProgramEditApi over admin-held local state (only program+settings matter). */
function buildLocalApi(
  state: GymState,
  setState: Dispatch<SetStateAction<GymState | null>>,
  markDirty: () => void,
): ProgramEditApi {
  const mut = (fn: (s: GymState) => GymState) => {
    setState((s) => (s ? fn(s) : s))
    markDirty()
  }
  return {
    program: state.program,
    settings: state.settings,
    updateSettings: (patch) => mut((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    addDay: (day) => mut((s) => reconcileEntries({ ...s, program: P.addDay(s.program, day) })),
    updateDay: (k, p) => mut((s) => ({ ...s, program: P.updateDay(s.program, k, p) })),
    removeDay: (k) => mut((s) => reconcileEntries({ ...s, program: P.removeDay(s.program, k) })),
    addExercise: (dk, ex) => mut((s) => reconcileEntries({ ...s, program: P.addExercise(s.program, dk, ex) })),
    updateExercise: (dk, id, p) => mut((s) => ({ ...s, program: P.updateExercise(s.program, dk, id, p) })),
    removeExercise: (dk, id) =>
      mut((s) => reconcileEntries({ ...s, program: P.removeExercise(s.program, dk, id) })),
    moveExercise: (dk, id, dir) => mut((s) => ({ ...s, program: P.moveExercise(s.program, dk, id, dir) })),
  }
}

export function AdminView() {
  const adminPin = useSession((s) => s.pin)
  const showToast = useToast((s) => s.show)
  const [users, setUsers] = useState<AdminProfile[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [managing, setManaging] = useState<AdminProfile | null>(null)

  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [creating, setCreating] = useState(false)

  const reload = useCallback(async () => {
    if (!adminPin) return
    setStatus('loading')
    try {
      setUsers(await cloud.adminList(adminPin))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [adminPin])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!adminPin) return null

  if (managing) {
    return (
      <ManageUser
        user={managing}
        adminPin={adminPin}
        onClose={() => {
          setManaging(null)
          void reload()
        }}
      />
    )
  }

  const create = async () => {
    if (!name.trim() || pin.length < 4) {
      showToast('Nimi ja vähemalt 4-kohaline PIN')
      return
    }
    setCreating(true)
    try {
      await cloud.adminCreate(adminPin, name.trim(), pin, makeAdmin)
      setName('')
      setPin('')
      setMakeAdmin(false)
      showToast('✓ Kasutaja loodud')
      await reload()
    } catch {
      showToast('Loomine ebaõnnestus — nimi võib olla juba võetud')
    } finally {
      setCreating(false)
    }
  }

  const resetPin = async (u: AdminProfile) => {
    const np = prompt(`Uus PIN kasutajale „${u.name}“ (vähemalt 4 numbrit):`)
    if (!np || np.length < 4) return
    try {
      await cloud.adminResetPin(adminPin, u.id, np)
      showToast('✓ PIN uuendatud')
    } catch {
      showToast('PIN-i uuendamine ebaõnnestus')
    }
  }

  const remove = async (u: AdminProfile) => {
    if (!confirm(`Kustuta kasutaja „${u.name}“? Kõik tema andmed kaovad.`)) return
    try {
      await cloud.adminDelete(adminPin, u.id)
      showToast('Kasutaja kustutatud')
      await reload()
    } catch {
      showToast('Ei saa kustutada (viimast administraatorit ei saa eemaldada)')
    }
  }

  return (
    <div style={S.content}>
      <div style={S.h}>Kasutajad</div>
      {status === 'loading' && <p style={S.muted}>Laen…</p>}
      {status === 'error' && (
        <p style={S.muted}>
          Nimekirja ei õnnestunud laadida.{' '}
          <button style={S.link} onClick={() => void reload()}>
            Proovi uuesti
          </button>
        </p>
      )}
      {users.map((u) => (
        <div key={u.id} style={S.row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.name}>
              {u.name} {u.is_admin && <span style={S.badge}>admin</span>}
            </div>
            <div style={S.sub}>muudetud {fmtDate(u.updated_at)}</div>
          </div>
          <button style={S.btn} onClick={() => setManaging(u)}>
            Halda
          </button>
          <button style={S.btn} onClick={() => void resetPin(u)}>
            PIN
          </button>
          <button style={{ ...S.btn, color: '#e87c47' }} onClick={() => void remove(u)} aria-label="Kustuta">
            ✕
          </button>
        </div>
      ))}

      <div style={S.h}>Lisa kasutaja</div>
      <div style={S.block}>
        <div style={S.field}>
          <label style={S.label}>Nimi</label>
          <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={S.field}>
          <label style={S.label}>PIN</label>
          <input
            style={S.input}
            type="number"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        <label style={S.checkRow}>
          <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
          <span style={{ fontSize: 13, color: colors.muted }}>administraator</span>
        </label>
        <button style={S.primary} disabled={creating} onClick={() => void create()}>
          {creating ? 'Loon…' : '+ Loo kasutaja'}
        </button>
      </div>
    </div>
  )
}

function ManageUser({
  user,
  adminPin,
  onClose,
}: {
  user: AdminProfile
  adminPin: string
  onClose: () => void
}) {
  const showToast = useToast((s) => s.show)
  const [state, setState] = useState<GymState | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'plan' | 'progress'>('plan')

  useEffect(() => {
    let alive = true
    cloud
      .adminPull(adminPin, user.id)
      .then((r) => alive && setState(coerceState(r.state)))
      .catch(() => alive && setErr('Kasutaja andmete laadimine ebaõnnestus'))
    return () => {
      alive = false
    }
  }, [adminPin, user.id])

  const save = async () => {
    if (!state) return
    setSaving(true)
    try {
      await cloud.adminPushProgram(adminPin, user.id, state.program, state.settings)
      setDirty(false)
      showToast('✓ Plaan salvestatud')
    } catch {
      showToast('Salvestamine ebaõnnestus')
    } finally {
      setSaving(false)
    }
  }

  const api = state ? buildLocalApi(state, setState, () => setDirty(true)) : null

  return (
    <div>
      <div style={S.manageBar}>
        <button style={S.link} onClick={onClose}>
          ← Tagasi
        </button>
        <div style={{ fontWeight: 700 }}>{user.name}</div>
        <button style={{ ...S.primary, padding: '6px 12px', opacity: dirty && !saving ? 1 : 0.4 }} disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? '…' : 'Salvesta plaan'}
        </button>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'plan')} onClick={() => setTab('plan')}>
          Plaan
        </button>
        <button style={S.tab(tab === 'progress')} onClick={() => setTab('progress')}>
          Progress
        </button>
      </div>

      {err && <p style={{ ...S.muted, padding: 16 }}>{err}</p>}
      {!state && !err && <p style={{ ...S.muted, padding: 16 }}>Laen…</p>}
      {state && api && tab === 'plan' && <ProgramEditorBody api={api} />}
      {state && tab === 'progress' && <HistoryViewBody program={state.program} logs={state.logs} />}
    </div>
  )
}

const S = {
  content: { padding: '14px 14px 96px', maxWidth: 680, margin: '0 auto' } as CSSProperties,
  h: { fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.faint, margin: '18px 0 8px' } as CSSProperties,
  row: { display: 'flex', alignItems: 'center', gap: 8, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 } as CSSProperties,
  name: { fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 } as CSSProperties,
  sub: { fontSize: 11, color: colors.faint, marginTop: 2 } as CSSProperties,
  badge: { fontSize: 10, fontWeight: 700, color: colors.accent, border: `1px solid ${colors.accent}`, borderRadius: 20, padding: '1px 7px' } as CSSProperties,
  btn: { background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' } as CSSProperties,
  block: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12 } as CSSProperties,
  field: { marginBottom: 10 } as CSSProperties,
  label: { fontSize: 11, color: colors.muted, display: 'block', marginBottom: 4 } as CSSProperties,
  input: { width: '100%', background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 14, padding: '8px 10px', outline: 'none' } as CSSProperties,
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 12px' } as CSSProperties,
  primary: { width: '100%', background: colors.accent, color: '#000', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' } as CSSProperties,
  muted: { color: colors.muted, fontSize: 13 } as CSSProperties,
  link: { background: 'none', border: 'none', color: colors.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 } as CSSProperties,
  manageBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${colors.border}`, position: 'sticky', top: 0, background: colors.bg, zIndex: 10 } as CSSProperties,
  tabs: { display: 'flex', gap: 8, padding: '10px 14px 0', maxWidth: 680, margin: '0 auto' } as CSSProperties,
  tab: (active: boolean): CSSProperties => ({
    flex: 1,
    padding: '8px',
    background: active ? colors.accent : colors.surface,
    color: active ? '#000' : colors.muted,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  }),
}
