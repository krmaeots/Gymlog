import { useState, type CSSProperties } from 'react'
import type { Day, Exercise } from '../domain/types'
import { makeId } from '../lib/id'
import { targetText } from '../lib/format'
import { useGymStore } from '../store/useGymStore'
import { colors } from '../theme'

function newExercise(): Exercise {
  return {
    id: makeId('ex'),
    name: 'Uus harjutus',
    note: '',
    sets: 3,
    repsLow: 8,
    repsHigh: 12,
    weightStart: 20,
    weightStep: 2.5,
    hasWeight: true,
  }
}

function newDay(): Day {
  return { key: makeId('day'), name: 'Uus päev', sub: '', exercises: [] }
}

export function ProgramEditor() {
  const program = useGymStore((s) => s.program)
  const addDay = useGymStore((s) => s.addDay)

  return (
    <div style={S.content}>
      <SettingsPanel />

      <div style={S.sectionTitle}>Treeningkava</div>
      {program.days.map((day) => (
        <DayEditor key={day.key} day={day} />
      ))}

      <button style={S.addDayBtn} onClick={() => addDay(newDay())}>
        + Lisa treeningpäev
      </button>
    </div>
  )
}

function SettingsPanel() {
  const settings = useGymStore((s) => s.settings)
  const updateSettings = useGymStore((s) => s.updateSettings)

  return (
    <div style={S.block}>
      <div style={S.blockHead}>Seaded</div>
      <div style={S.field}>
        <label style={S.label}>Puhkepaus (sek)</label>
        <input
          style={S.input}
          type="number"
          min={10}
          step={5}
          value={settings.restSeconds}
          onChange={(e) => updateSettings({ restSeconds: Math.max(10, parseInt(e.target.value, 10) || 0) })}
        />
      </div>
      <div style={S.field}>
        <label style={S.label}>Deload pärast (paigalseisu nädalat)</label>
        <input
          style={S.input}
          type="number"
          min={0}
          step={1}
          value={settings.deloadAfterStalls}
          onChange={(e) => updateSettings({ deloadAfterStalls: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        />
      </div>
      <div style={S.field}>
        <label style={S.label}>Deload vähendus (%)</label>
        <input
          style={S.input}
          type="number"
          min={0}
          max={50}
          step={1}
          value={Math.round(settings.deloadFactor * 100)}
          onChange={(e) =>
            updateSettings({ deloadFactor: Math.min(0.5, Math.max(0, (parseInt(e.target.value, 10) || 0) / 100)) })
          }
        />
      </div>
    </div>
  )
}

function DayEditor({ day }: { day: Day }) {
  const [open, setOpen] = useState(false)
  const updateDay = useGymStore((s) => s.updateDay)
  const removeDay = useGymStore((s) => s.removeDay)
  const addExercise = useGymStore((s) => s.addExercise)

  return (
    <div style={S.block}>
      <div style={S.dayHead}>
        <input
          style={S.dayNameInput}
          value={day.name}
          onChange={(e) => updateDay(day.key, { name: e.target.value })}
        />
        <button style={S.iconBtn} onClick={() => setOpen((o) => !o)} aria-label="Ava/sulge">
          {open ? '▾' : '▸'}
        </button>
        <button
          style={{ ...S.iconBtn, color: '#e87c47' }}
          onClick={() => {
            if (confirm(`Kustuta päev „${day.name}“?`)) removeDay(day.key)
          }}
          aria-label="Kustuta päev"
        >
          🗑
        </button>
      </div>

      {open && (
        <>
          <div style={S.field}>
            <label style={S.label}>Alapealkiri</label>
            <input
              style={S.input}
              value={day.sub}
              placeholder="nt 4 harjutust · ~45 min"
              onChange={(e) => updateDay(day.key, { sub: e.target.value })}
            />
          </div>

          {day.exercises.map((ex, i) => (
            <ExerciseEditor
              key={ex.id}
              dayKey={day.key}
              exercise={ex}
              isFirst={i === 0}
              isLast={i === day.exercises.length - 1}
            />
          ))}

          <button style={S.addExBtn} onClick={() => addExercise(day.key, newExercise())}>
            + Lisa harjutus
          </button>
        </>
      )}
    </div>
  )
}

function ExerciseEditor({
  dayKey,
  exercise: ex,
  isFirst,
  isLast,
}: {
  dayKey: string
  exercise: Exercise
  isFirst: boolean
  isLast: boolean
}) {
  const [open, setOpen] = useState(false)
  const update = useGymStore((s) => s.updateExercise)
  const remove = useGymStore((s) => s.removeExercise)
  const move = useGymStore((s) => s.moveExercise)

  const num = (field: keyof Exercise, opts?: { min?: number; step?: number }) => (
    <input
      style={S.numInput}
      type="number"
      min={opts?.min ?? 0}
      step={opts?.step ?? 1}
      value={ex[field] as number}
      onChange={(e) => update(dayKey, ex.id, { [field]: parseFloat(e.target.value) || 0 } as Partial<Exercise>)}
    />
  )

  return (
    <div style={S.exBlock}>
      <div style={S.exHead}>
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
          <div style={S.exName}>{ex.name || '(nimetu)'}</div>
          <div style={{ fontSize: 11, color: colors.faint }}>
            {ex.sets} × {ex.repsLow}–{ex.repsHigh}
            {ex.hasWeight ? ` · ${targetText(ex, { weight: ex.weightStart, reps: ex.repsLow, repsHigh: ex.repsHigh })}` : ' · keharaskus'}
          </div>
        </div>
        <button style={S.iconBtn} disabled={isFirst} onClick={() => move(dayKey, ex.id, -1)} aria-label="Üles">
          ↑
        </button>
        <button style={S.iconBtn} disabled={isLast} onClick={() => move(dayKey, ex.id, 1)} aria-label="Alla">
          ↓
        </button>
        <button
          style={{ ...S.iconBtn, color: '#e87c47' }}
          onClick={() => {
            if (confirm(`Kustuta harjutus „${ex.name}“?`)) remove(dayKey, ex.id)
          }}
          aria-label="Kustuta"
        >
          ✕
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={S.field}>
            <label style={S.label}>Nimi</label>
            <input style={S.input} value={ex.name} onChange={(e) => update(dayKey, ex.id, { name: e.target.value })} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Märkus / tehnika</label>
            <input style={S.input} value={ex.note} onChange={(e) => update(dayKey, ex.id, { note: e.target.value })} />
          </div>
          <div style={S.grid}>
            <Labeled label="Seeriad">{num('sets', { min: 1 })}</Labeled>
            <Labeled label="Kordusi (min)">{num('repsLow', { min: 1 })}</Labeled>
            <Labeled label="Kordusi (max)">{num('repsHigh', { min: 1 })}</Labeled>
            <Labeled label="Algkaal (kg)">{num('weightStart', { min: 0, step: 2.5 })}</Labeled>
            <Labeled label="Samm (kg)">{num('weightStep', { min: 0, step: 0.5 })}</Labeled>
            <Labeled label="Raskusega">
              <label style={S.checkRow}>
                <input
                  type="checkbox"
                  checked={ex.hasWeight}
                  onChange={(e) => update(dayKey, ex.id, { hasWeight: e.target.checked })}
                />
                <span style={{ fontSize: 12, color: colors.muted }}>{ex.hasWeight ? 'jah' : 'keharaskus'}</span>
              </label>
            </Labeled>
          </div>
        </div>
      )}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...S.label, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

const S = {
  content: { padding: '14px 14px 96px', maxWidth: 680, margin: '0 auto' } as CSSProperties,
  sectionTitle: { fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.faint, margin: '18px 0 8px' } as CSSProperties,
  block: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, marginBottom: 10 } as CSSProperties,
  blockHead: { fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.faint, marginBottom: 10 } as CSSProperties,
  dayHead: { display: 'flex', alignItems: 'center', gap: 8 } as CSSProperties,
  dayNameInput: { flex: 1, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 15, fontWeight: 700, padding: '8px 10px', outline: 'none' } as CSSProperties,
  field: { marginTop: 10 } as CSSProperties,
  label: { fontSize: 11, color: colors.muted, display: 'block', marginBottom: 4 } as CSSProperties,
  input: { width: '100%', background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 14, padding: '8px 10px', outline: 'none' } as CSSProperties,
  numInput: { width: '100%', background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 14, fontWeight: 700, padding: '8px 10px', outline: 'none', textAlign: 'center' } as CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 } as CSSProperties,
  checkRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' } as CSSProperties,
  exBlock: { background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10, marginTop: 10 } as CSSProperties,
  exHead: { display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  exName: { fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
  iconBtn: { background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.muted, fontSize: 13, padding: '5px 8px', cursor: 'pointer', flexShrink: 0 } as CSSProperties,
  addExBtn: { width: '100%', marginTop: 10, padding: 10, background: 'none', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer' } as CSSProperties,
  addDayBtn: { width: '100%', marginTop: 4, padding: 12, background: colors.surface, border: `1px dashed #3a3a3a`, borderRadius: 10, color: colors.accent, fontSize: 14, fontWeight: 700, cursor: 'pointer' } as CSSProperties,
}
