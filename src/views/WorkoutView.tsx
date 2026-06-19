import { useState, type CSSProperties } from 'react'
import { ExerciseCard } from '../components/ExerciseCard'
import { Pill } from '../components/Pill'
import type { Day, Exercise } from '../domain/types'
import { sessionVolume } from '../domain/overload'
import { allExercises, effectiveWeek } from '../lib/program'
import { fmtWeight, targetText } from '../lib/format'
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

/**
 * Group consecutive exercises that share a `supersetGroup` id into one block,
 * so a superset renders under a single bracket. Others stay singletons.
 */
function groupExercises(exercises: Exercise[]): Exercise[][] {
  const groups: Exercise[][] = []
  for (const ex of exercises) {
    const prev = groups.at(-1)
    if (ex.supersetGroup && prev && prev[0]!.supersetGroup === ex.supersetGroup) {
      prev.push(ex)
    } else {
      groups.push([ex])
    }
  }
  return groups
}

export function WorkoutView() {
  const program = useGymStore((s) => s.program)
  const week = useGymStore((s) => s.week)
  const logs = useGymStore((s) => s.logs)
  const [tab, setTab] = useState(0)
  const [openCard, setOpenCard] = useState<string | null>(null)

  const days = program.days
  const summaryTab = days.length // index of the "next week" tab

  return (
    <>
      <div style={S.tabs}>
        {days.map((day, i) => {
          const dayWk = effectiveWeek(day, week)
          const done =
            day.exercises.length > 0 &&
            day.exercises.every((ex) => logs[ex.id]?.at(-1)?.week === dayWk)
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
            setOpenCard={setOpenCard}
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
  setOpenCard,
}: {
  dayKey: string
  openCard: string | null
  onToggle: (id: string) => void
  setOpenCard: (id: string | null) => void
}) {
  const day = useGymStore((s) => s.program.days.find((d) => d.key === dayKey))
  const globalWeek = useGymStore((s) => s.week)
  const logs = useGymStore((s) => s.logs)
  if (!day) return null

  const dayWk = effectiveWeek(day, globalWeek)
  const isDone = (exId: string) => logs[exId]?.at(-1)?.week === dayWk
  const doneCnt = day.exercises.filter((ex) => isDone(ex.id)).length
  const pct = day.exercises.length ? (doneCnt / day.exercises.length) * 100 : 0
  const allDone = day.exercises.length > 0 && doneCnt === day.exercises.length

  // After a fresh save, jump to the next not-yet-done exercise (reading the
  // store directly so the just-saved one counts as done). When none remain,
  // collapse everything and scroll up to reveal the day summary.
  const advance = (savedId: string) => {
    const freshLogs = useGymStore.getState().logs
    const order = day.exercises
    const start = order.findIndex((e) => e.id === savedId)
    for (let k = 1; k <= order.length; k++) {
      const ex = order[(start + k) % order.length]!
      if (ex.id !== savedId && freshLogs[ex.id]?.at(-1)?.week !== dayWk) {
        setOpenCard(ex.id)
        return
      }
    }
    setOpenCard(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {allDone && <DaySummary day={day} dayWk={dayWk} />}
      <div style={S.dayIntro}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{day.name}</div>
          <div style={{ fontSize: 13, color: colors.faint, marginTop: 3 }}>
            {day.sub}
            {day.cycle !== undefined ? ` · nädal ${dayWk}` : ''}
          </div>
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
      {groupExercises(day.exercises).map((group) => {
        const cards = group.map((ex) => (
          <ExerciseCard
            key={`${ex.id}-${dayWk}`}
            exercise={ex}
            week={dayWk}
            open={openCard === ex.id}
            onToggle={() => onToggle(ex.id)}
            onSaved={() => advance(ex.id)}
          />
        ))
        if (group.length < 2) return cards
        return (
          <div key={`ss-${group[0]!.id}`} style={S.supersetWrap}>
            <div style={S.supersetLabel}>🔗 Superseeria — tee vaheldumisi</div>
            {cards}
          </div>
        )
      })}
      {day.exercises.length === 0 && (
        <div style={S.empty}>Selles päevas pole harjutusi. Lisa neid „Kava“ vahelehel.</div>
      )}
    </>
  )
}

/** Largest reference weight at or below the tonnage, for a fun comparison. */
const WEIGHT_REFS = [
  { kg: 5, label: 'kassi' },
  { kg: 70, label: 'inimese' },
  { kg: 200, label: 'mootorratta' },
  { kg: 500, label: 'hobuse' },
  { kg: 1000, label: 'väikese auto' },
  { kg: 5000, label: 'elevandi' },
  { kg: 12000, label: 'bussi' },
]
function funComparison(kg: number): string | null {
  let best: (typeof WEIGHT_REFS)[number] | null = null
  for (const r of WEIGHT_REFS) if (kg >= r.kg) best = r
  if (!best) return null
  return `≈ ${Math.floor(kg / best.kg)}× ${best.label} raskus 🐘`
}

function DaySummary({ day, dayWk }: { day: Day; dayWk: number }) {
  const logs = useGymStore((s) => s.logs)
  const startNextDayCycle = useGymStore((s) => s.startNextDayCycle)
  const showToast = useToast((s) => s.show)

  const entries = day.exercises
    .map((ex) => logs[ex.id]?.at(-1))
    .filter((log): log is NonNullable<typeof log> => !!log && log.week === dayWk)

  const tonnage = entries.reduce((sum, log) => sum + sessionVolume(log.sets), 0)
  const totalSets = entries.reduce((n, log) => n + log.sets.length, 0)
  const totalReps = entries.reduce((n, log) => n + log.sets.reduce((a, s) => a + s.reps, 0), 0)
  const prs = entries.filter((log) => log.pr).length
  const progressed = entries.filter((log) => log.change === 'weight_up' || log.change === 'reps_up').length
  const comparison = funComparison(tonnage)

  const startNext = () => {
    startNextDayCycle(day.key)
    showToast(`🚀 „${shortLabel(day.name)}“ — nädal ${dayWk + 1} algab`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div style={S.summary}>
      <div style={{ fontSize: 30 }}>🎉</div>
      <div style={{ fontWeight: 900, fontSize: 20 }}>Päev tehtud!</div>
      {tonnage > 0 && (
        <>
          <div style={{ fontWeight: 900, fontSize: 38, color: colors.accent, lineHeight: 1.1 }}>
            {fmtWeight(Math.round(tonnage))} kg
          </div>
          <div style={{ fontSize: 13, color: colors.muted }}>kokku tõstetud</div>
          {comparison && <div style={{ fontSize: 14, color: colors.green, fontWeight: 700 }}>{comparison}</div>}
        </>
      )}
      <div style={S.summaryStats}>
        <SummaryStat num={totalSets} label="seeriat" />
        <SummaryStat num={totalReps} label="kordust" />
        <SummaryStat num={prs} label="rekordit ★" />
        <SummaryStat num={progressed} label="läheb raskemaks" />
      </div>
      <button style={S.dayNextBtn} onClick={startNext}>
        ➜ Alusta selle päeva nädal {dayWk + 1}
      </button>
    </div>
  )
}

function SummaryStat({ num, label }: { num: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 24, color: colors.text }}>{num}</div>
      <div style={{ fontSize: 12, color: colors.faint, marginTop: 2 }}>{label}</div>
    </div>
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

  // A day's exercise is "done" when its last log is in that day's effective week.
  const dayOf = (exId: string) => program.days.find((d) => d.exercises.some((e) => e.id === exId))
  const loggedThisWeek = (exId: string) => {
    const d = dayOf(exId)
    return !!d && logs[exId]?.at(-1)?.week === effectiveWeek(d, week)
  }

  const all = allExercises(program)
  const totalDone = all.filter((ex) => loggedThisWeek(ex.id)).length
  const totalPR = all.filter((ex) => loggedThisWeek(ex.id) && logs[ex.id]!.at(-1)!.pr).length
  const totalUp = all.filter((ex) => {
    if (!loggedThisWeek(ex.id)) return false
    const c = logs[ex.id]!.at(-1)!.change
    return c === 'weight_up' || c === 'reps_up'
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
        <Stat num={totalPR} label="PR" />
        <Stat num={`${totalDone}/${all.length}`} label="Tehtud" />
        <Stat num={totalUp} label="Progress" />
      </div>

      {totalDone === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          Märgi treeningud tehtuks — siis arvutan järgmised sihtmärgid automaatselt.
        </div>
      ) : (
        program.days.map((day) => {
          const rows = day.exercises.filter((ex) => loggedThisWeek(ex.id))
          if (!rows.length) return null
          return (
            <div key={day.key} style={S.nwBlock}>
              <div style={S.nwHead}>
                {day.name}
                {day.cycle !== undefined ? ` · nädal ${effectiveWeek(day, week)}` : ''}
              </div>
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
        <>
          {/* Spacer so the last summary row isn't hidden behind the fixed bar. */}
          <div style={S.nextWeekSpacer} />
          <div style={S.nextWeekBar}>
            <button style={S.nextWeekBtn} onClick={handleNextWeek}>
              🚀 Nädal {week} läbi — Alusta nädal {week + 1}
            </button>
          </div>
        </>
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
  summary: {
    background: 'linear-gradient(160deg, #1f1d12, #1c1c1c)',
    border: `1px solid ${colors.accent}`,
    borderRadius: 14,
    padding: '20px 16px',
    marginBottom: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    textAlign: 'center',
  } as CSSProperties,
  summaryStats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: '100%', marginTop: 12 } as CSSProperties,
  dayNextBtn: { marginTop: 14, width: '100%', padding: 13, background: colors.green, color: '#000', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' } as CSSProperties,
  dayIntro: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as CSSProperties,
  progBar: { height: 3, background: colors.border, borderRadius: 2, marginBottom: 14 } as CSSProperties,
  supersetWrap: { border: `1px solid #3a3320`, borderLeft: `3px solid ${colors.accent}`, borderRadius: 10, padding: '8px 8px 2px', marginBottom: 8, background: 'rgba(232,197,71,0.03)' } as CSSProperties,
  supersetLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.accent, padding: '2px 4px 8px' } as CSSProperties,
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 } as CSSProperties,
  statBox: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12, textAlign: 'center' } as CSSProperties,
  nwBlock: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' } as CSSProperties,
  nwHead: { padding: '10px 14px', background: colors.surface2, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.faint, borderBottom: `1px solid ${colors.border}` } as CSSProperties,
  nwRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 15 } as CSSProperties,
  // Fixed action bar pinned just above the BottomNav so "next week" is always
  // reachable without scrolling to the end of the summary.
  nextWeekBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'calc(63px + env(safe-area-inset-bottom))',
    zIndex: 900,
    background: colors.bg,
    borderTop: `1px solid ${colors.border}`,
    padding: '12px 14px',
  } as CSSProperties,
  nextWeekSpacer: { height: 80 } as CSSProperties,
  nextWeekBtn: { display: 'block', width: '100%', maxWidth: 680, margin: '0 auto', padding: 15, background: colors.green, color: '#000', border: 'none', borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: 'pointer' } as CSSProperties,
  empty: { textAlign: 'center', padding: '40px 20px', color: colors.faint, fontSize: 15, lineHeight: 1.8 } as CSSProperties,
}
