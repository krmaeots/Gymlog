import { useState, type CSSProperties } from 'react'
import { ExerciseCard } from '../components/ExerciseCard'
import { Pill } from '../components/Pill'
import { allExercises } from '../lib/program'
import { targetText } from '../lib/format'
import { useGymStore } from '../store/useGymStore'
import { useToast } from '../store/useToast'
import { changeMeta, colors } from '../theme'

const CHANGE_PILL: Record<string, string> = {
  weight_up: '+raskus',
  reps_up: '+1 kordus',
  reps_nudge: '+1 kordus sihtmärk',
  same: 'sama',
  deload: 'deload',
}

export function WorkoutView() {
  const program = useGymStore((s) => s.program)
  const week = useGymStore((s) => s.week)
  const logs = useGymStore((s) => s.logs)
  const [tab, setTab] = useState(0)
  const [openCard, setOpenCard] = useState<string | null>(null)

  const days = program.days
  const summaryTab = days.length // index of the "next week" tab
  const isLoggedThisWeek = (exId: string) => logs[exId]?.at(-1)?.week === week

  return (
    <>
      <div style={S.tabs}>
        {days.map((day, i) => {
          const done = day.exercises.length > 0 && day.exercises.every((ex) => isLoggedThisWeek(ex.id))
          return (
            <div key={day.key} style={S.tab(tab === i)} onClick={() => setTab(i)}>
              {shortLabel(day.name)}
              {done ? ' ✓' : ''}
            </div>
          )
        })}
        <div style={S.tab(tab === summaryTab)} onClick={() => setTab(summaryTab)}>
          Järgmine →
        </div>
      </div>

      <div style={S.content}>
        {tab < summaryTab && days[tab] ? (
          <DayView
            dayKey={days[tab]!.key}
            openCard={openCard}
            onToggle={(id) => setOpenCard((cur) => (cur === id ? null : id))}
          />
        ) : (
          <NextWeekSummary onJumpToFirst={() => setTab(0)} onCollapse={() => setOpenCard(null)} />
        )}
      </div>
    </>
  )
}

function DayView({
  dayKey,
  openCard,
  onToggle,
}: {
  dayKey: string
  openCard: string | null
  onToggle: (id: string) => void
}) {
  const day = useGymStore((s) => s.program.days.find((d) => d.key === dayKey))
  const week = useGymStore((s) => s.week)
  const logs = useGymStore((s) => s.logs)
  if (!day) return null

  const doneCnt = day.exercises.filter((ex) => logs[ex.id]?.at(-1)?.week === week).length
  const pct = day.exercises.length ? (doneCnt / day.exercises.length) * 100 : 0

  return (
    <>
      <div style={S.dayIntro}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{day.name}</div>
          <div style={{ fontSize: 13, color: colors.faint, marginTop: 3 }}>{day.sub}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: 30, color: colors.accent, lineHeight: 1 }}>
            {doneCnt}/{day.exercises.length}
          </div>
          <div style={{ fontSize: 12, color: colors.faint }}>tehtud</div>
        </div>
      </div>
      <div style={S.progBar}>
        <div style={{ height: '100%', background: `linear-gradient(90deg,${colors.accent},${colors.green})`, borderRadius: 2, width: `${pct}%` }} />
      </div>
      {day.exercises.map((ex) => (
        <ExerciseCard
          key={`${ex.id}-${week}`}
          exercise={ex}
          open={openCard === ex.id}
          onToggle={() => onToggle(ex.id)}
        />
      ))}
      {day.exercises.length === 0 && (
        <div style={S.empty}>Selles päevas pole harjutusi. Lisa neid „Kava“ vahelehel.</div>
      )}
    </>
  )
}

function NextWeekSummary({
  onJumpToFirst,
  onCollapse,
}: {
  onJumpToFirst: () => void
  onCollapse: () => void
}) {
  const program = useGymStore((s) => s.program)
  const week = useGymStore((s) => s.week)
  const logs = useGymStore((s) => s.logs)
  const targets = useGymStore((s) => s.targets)
  const startNextWeek = useGymStore((s) => s.startNextWeek)
  const showToast = useToast((s) => s.show)

  const all = allExercises(program)
  const loggedThisWeek = (exId: string) => logs[exId]?.at(-1)?.week === week
  const totalDone = all.filter((ex) => loggedThisWeek(ex.id)).length
  const totalPR = all.filter((ex) => {
    const l = logs[ex.id]?.at(-1)
    return l?.week === week && l.pr
  }).length
  const totalUp = all.filter((ex) => {
    const l = logs[ex.id]?.at(-1)
    return l?.week === week && (l.change === 'weight_up' || l.change === 'reps_up')
  }).length

  const handleNextWeek = () => {
    startNextWeek()
    onJumpToFirst()
    onCollapse()
    showToast(`🚀 Nädal ${week + 1} alanud!`)
  }

  return (
    <>
      <div style={S.statRow}>
        <Stat num={totalPR} label="PR sel nädalal" />
        <Stat num={`${totalDone}/${all.length}`} label="Tehtud" />
        <Stat num={totalUp} label="Progress" />
      </div>

      {totalDone === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          Märgi treeningud tehtuks — siis arvutan järgmise nädala sihtmärgid automaatselt.
        </div>
      ) : (
        program.days.map((day) => {
          const rows = day.exercises.filter((ex) => loggedThisWeek(ex.id))
          if (!rows.length) return null
          return (
            <div key={day.key} style={S.nwBlock}>
              <div style={S.nwHead}>{day.name}</div>
              {rows.map((ex) => {
                const log = logs[ex.id]!.at(-1)!
                const tgt = targets[ex.id]!
                const meta = changeMeta[log.change]
                const arrow = log.change === 'same' ? '→' : log.change === 'deload' ? '↓' : '↑'
                return (
                  <div key={ex.id} style={S.nwRow}>
                    <span style={{ color: colors.muted, fontSize: 14, flex: 1, paddingRight: 8 }}>{ex.name}</span>
                    <span style={{ fontWeight: 700, color: meta.color, whiteSpace: 'nowrap' }}>
                      {arrow} {targetText(ex, tgt)}
                      <Pill kind={meta.pill}>{CHANGE_PILL[log.change]}</Pill>
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      {all.length > 0 && totalDone === all.length && (
        <button style={S.nextWeekBtn} onClick={handleNextWeek}>
          🚀 Nädal {week} läbi — Alusta nädal {week + 1}
        </button>
      )}
    </>
  )
}

function Stat({ num, label }: { num: number | string; label: string }) {
  return (
    <div style={S.statBox}>
      <div style={{ fontWeight: 900, fontSize: 32, color: colors.accent, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{label}</div>
    </div>
  )
}

/** Keep tab labels short on a crowded strip ("Push — Rind…" → "Push"). */
function shortLabel(name: string): string {
  return name.split(/[—-]/)[0]!.trim()
}

const S = {
  tabs: { display: 'flex', background: colors.surface2, borderBottom: `1px solid ${colors.border}`, overflowX: 'auto', padding: '0 14px', scrollbarWidth: 'none' } as CSSProperties,
  tab: (active: boolean): CSSProperties => ({
    padding: '13px 15px',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: active ? colors.accent : colors.muted,
    cursor: 'pointer',
    borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }),
  content: { padding: '14px 14px 96px', maxWidth: 680, margin: '0 auto' } as CSSProperties,
  dayIntro: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as CSSProperties,
  progBar: { height: 3, background: colors.border, borderRadius: 2, marginBottom: 14 } as CSSProperties,
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 } as CSSProperties,
  statBox: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12, textAlign: 'center' } as CSSProperties,
  nwBlock: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' } as CSSProperties,
  nwHead: { padding: '10px 14px', background: colors.surface2, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.faint, borderBottom: `1px solid ${colors.border}` } as CSSProperties,
  nwRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 15 } as CSSProperties,
  nextWeekBtn: { width: '100%', padding: 15, background: colors.green, color: '#000', border: 'none', borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: 'pointer', marginTop: 14 } as CSSProperties,
  empty: { textAlign: 'center', padding: '40px 20px', color: colors.faint, fontSize: 15, lineHeight: 1.8 } as CSSProperties,
}
