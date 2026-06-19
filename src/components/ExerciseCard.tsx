import { useState, type CSSProperties } from 'react'
import type { ChangeType, Exercise, SetEntry, Target } from '../domain/types'
import { setsSummary, targetText } from '../lib/format'
import { isStorageHealthy, useGymStore } from '../store/useGymStore'
import { useRestTimer } from '../store/useRestTimer'
import { useToast } from '../store/useToast'
import { changeMeta, colors } from '../theme'
import { Pill } from './Pill'

const CHANGE_MESSAGES: Record<ChangeType, string> = {
  weight_up: '🔥 Enamik seeriat täis! Raskus tõuseb järgmisel nädalal',
  reps_up: '📈 Kordused täis! +1 kordus järgmisel nädalal',
  reps_nudge: '✓ Salvestatud — järgmisel nädalal +1 kordus sihtmärk',
  same: '✓ Salvestatud — hoia raskus, korri tehnikat',
  deload: '🔄 Mitu nädalat paigal — deload, alusta kergemalt',
}

const CHANGE_PILL: Record<ChangeType, string> = {
  weight_up: '+raskus',
  reps_up: '+1 kordus',
  reps_nudge: '+1 kordus sihtmärk',
  same: 'sama',
  deload: 'deload',
}

interface Props {
  exercise: Exercise
  open: boolean
  onToggle: () => void
}

export function ExerciseCard({ exercise: ex, open, onToggle }: Props) {
  const week = useGymStore((s) => s.week)
  const target = useGymStore((s) => s.targets[ex.id])
  const history = useGymStore((s) => s.logs[ex.id] ?? [])
  const restSeconds = useGymStore((s) => s.settings.restSeconds)
  const logExercise = useGymStore((s) => s.logExercise)
  const startRest = useRestTimer((s) => s.start)
  const showToast = useToast((s) => s.show)

  const lastLog = history.at(-1)
  const isDone = !!lastLog && lastLog.week === week
  const isPR = isDone && lastLog.pr

  const tgt = target ?? { weight: ex.weightStart, reps: ex.repsLow, repsHigh: ex.repsHigh }

  // Local, editable set inputs, seeded once on mount. The parent keys this card
  // by `${ex.id}-${week}`, so a NEW WEEK remounts it and re-seeds from the
  // (advanced) target; logging within the same week does not remount.
  const [inputs, setInputs] = useState<{ w: string; r: string }[]>(() =>
    Array.from({ length: ex.sets }, (_, i) => {
      if (!isDone) return { w: String(tgt.weight), r: String(tgt.reps) }
      // Already logged: show what was actually performed, blank for any set with
      // no record (e.g. set count raised after logging) — never leak next
      // week's prescription into the history display.
      const performed = lastLog!.sets[i]
      return {
        w: performed ? String(performed.weight) : '',
        r: performed ? String(performed.reps) : '',
      }
    }),
  )

  const setInput = (i: number, field: 'w' | 'r', value: string) =>
    setInputs((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))

  const handleLog = () => {
    const sets: SetEntry[] = inputs.map(({ w, r }) => ({
      weight: ex.hasWeight ? parseFloat(w) || 0 : 0,
      reps: parseInt(r, 10) || tgt.reps,
    }))
    logExercise(ex.id, sets)
    startRest(restSeconds)
    // If persistence just failed, the store already surfaced a warning toast —
    // don't overwrite it with a misleading success message.
    if (!isStorageHealthy()) return
    const change = useGymStore.getState().logs[ex.id]?.at(-1)?.change ?? 'same'
    showToast(CHANGE_MESSAGES[change] ?? '✓ Salvestatud')
  }

  const prevText = lastLog
    ? `Eelmine (nädal ${lastLog.week}): ${setsSummary(ex, lastLog)}`
    : 'Esimene kord — alusta sihtraskusega'

  return (
    <div style={S.card(isDone, open)}>
      <div style={S.cardHeader} onClick={onToggle}>
        <div style={S.dot(isDone, isPR)}>{isPR ? '★' : isDone ? '✓' : ''}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.exName}>{ex.name}</div>
          <div style={S.exNote}>
            {ex.sets} seeriat · {ex.note.replace('🍑 ', '')}
          </div>
        </div>
        <div style={S.targetBadge}>{targetText(ex, tgt)}</div>
      </div>

      {open && (
        <div style={S.cardBody}>
          <div style={S.prevRow(isPR)}>{prevText}</div>

          <div style={S.setsGrid}>
            {inputs.map((row, i) => (
              <div key={i} style={S.setBox}>
                <div style={S.setLbl}>Seeria {i + 1}</div>
                {ex.hasWeight && (
                  <div style={S.inputRow}>
                    <label style={S.inputLbl}>kg</label>
                    <input
                      style={S.input}
                      type="number"
                      inputMode="decimal"
                      value={row.w}
                      step={ex.weightStep}
                      min={0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setInput(i, 'w', e.target.value)}
                    />
                  </div>
                )}
                <div style={S.inputRow}>
                  <label style={S.inputLbl}>×</label>
                  <input
                    style={S.input}
                    type="number"
                    inputMode="numeric"
                    value={row.r}
                    step={1}
                    min={1}
                    max={50}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setInput(i, 'r', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {isDone && (
            <div style={S.editHint}>Muuda numbreid ja vajuta „Uuenda“ — sihtmärk arvutatakse ümber.</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.logBtn} onClick={handleLog}>
              {isDone ? '✏️ Uuenda' : '✓ Märgi tehtuks'}
            </button>
            <button style={S.restBtn} onClick={() => startRest(restSeconds)}>
              ⏱ Puhka
            </button>
          </div>

          {isDone && lastLog && (
            <NextWeekBox change={lastLog.change} exercise={ex} target={tgt} />
          )}
        </div>
      )}
    </div>
  )
}

function NextWeekBox({
  change,
  exercise: ex,
  target: tgt,
}: {
  change: ChangeType
  exercise: Exercise
  target: Target
}) {
  const meta = changeMeta[change]
  const valText = targetText(ex, tgt)
  const arrow = change === 'same' ? '→' : change === 'deload' ? '↓' : '↑'
  return (
    <div style={S.nextBox}>
      <div style={S.nextHeader}>
        <span style={S.nextDot} /> Järgmine nädal
      </div>
      <div style={{ ...S.nextRow, borderBottom: 'none' }}>
        <span style={S.nextLbl}>Sihtraskus & kordused</span>
        <span style={{ fontWeight: 700, color: meta.color }}>
          {arrow} {valText}
          <Pill kind={meta.pill}>{CHANGE_PILL[change]}</Pill>
        </span>
      </div>
    </div>
  )
}

const S = {
  card: (done: boolean, open: boolean): CSSProperties => ({
    background: colors.surface,
    border: `1px solid ${open ? colors.accent : done ? '#253525' : colors.border}`,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  }),
  cardHeader: { display: 'flex', alignItems: 'center', padding: '14px 14px', cursor: 'pointer', gap: 12 } as CSSProperties,
  dot: (done: boolean, pr: boolean): CSSProperties => ({
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: `2px solid ${pr ? colors.accent : done ? colors.green : '#333'}`,
    background: pr ? colors.accent : done ? colors.green : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: pr ? '#000' : '#fff',
    flexShrink: 0,
  }),
  exName: { fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
  exNote: { fontSize: 13, color: colors.faint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
  targetBadge: {
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: '6px 11px',
    fontSize: 15,
    fontWeight: 700,
    color: colors.accent,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } as CSSProperties,
  cardBody: { borderTop: `1px solid ${colors.border}`, padding: 14 } as CSSProperties,
  prevRow: (imp: boolean): CSSProperties => ({
    fontSize: 14,
    color: colors.muted,
    background: colors.surface2,
    borderRadius: 8,
    padding: '9px 12px',
    marginBottom: 12,
    borderLeft: `3px solid ${imp ? colors.green : '#333'}`,
  }),
  setsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 } as CSSProperties,
  setBox: { background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 9px' } as CSSProperties,
  setLbl: { fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.faint, marginBottom: 8, textAlign: 'center' } as CSSProperties,
  inputRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 } as CSSProperties,
  inputLbl: { fontSize: 14, color: colors.faint, width: 22 } as CSSProperties,
  input: {
    flex: 1,
    background: colors.surface,
    border: '1px solid #333',
    borderRadius: 8,
    color: colors.text,
    fontFamily: 'inherit',
    fontSize: 22,
    fontWeight: 700,
    padding: '8px 6px',
    textAlign: 'center',
    outline: 'none',
    width: '100%',
  } as CSSProperties,
  editHint: { fontSize: 13, color: colors.faint, marginBottom: 10, lineHeight: 1.5 } as CSSProperties,
  logBtn: { flex: 1, padding: 14, background: colors.accent, color: '#000', border: 'none', borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: 'pointer' } as CSSProperties,
  restBtn: { padding: '14px 16px', background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' } as CSSProperties,
  nextBox: { marginTop: 12, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden' } as CSSProperties,
  nextHeader: { padding: '8px 12px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.faint, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  nextDot: { width: 7, height: 7, borderRadius: '50%', background: colors.accent, display: 'inline-block' } as CSSProperties,
  nextRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, fontSize: 16 } as CSSProperties,
  nextLbl: { color: colors.muted, fontSize: 14 } as CSSProperties,
}
