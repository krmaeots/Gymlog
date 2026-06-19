import { useState, type CSSProperties } from 'react'
import { LineChart, type ChartPoint } from '../components/LineChart'
import type { Exercise, LogEntry, Program } from '../domain/types'
import { estimate1RM, sessionVolume, topSetWeight } from '../domain/overload'
import { fmtDate, fmtWeight, setsSummary } from '../lib/format'
import { useGymStore } from '../store/useGymStore'
import { colors } from '../theme'

type Metric = 'weight' | 'oneRm' | 'volume'

const METRICS: { key: Metric; label: string }[] = [
  { key: 'weight', label: 'Tippraskus' },
  { key: 'oneRm', label: '1RM (hinnang)' },
  { key: 'volume', label: 'Maht' },
]

/** Value of a metric for a session; bodyweight exercises always use total reps. */
function metricValue(metric: Metric, exercise: Exercise, log: LogEntry): number {
  if (!exercise.hasWeight) return log.sets.reduce((n, s) => n + s.reps, 0)
  switch (metric) {
    case 'weight':
      return topSetWeight(exercise, log.sets)
    case 'oneRm':
      return Math.max(0, ...log.sets.map((s) => estimate1RM(s.weight, s.reps)))
    case 'volume':
      return sessionVolume(log.sets)
  }
}

function metricUnit(metric: Metric, exercise: Exercise): string {
  if (!exercise.hasWeight) return 'kordust'
  return metric === 'volume' ? 'kg maht' : 'kg'
}

/** Quote a CSV cell only when needed (comma, quote, or newline). */
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Flatten every logged set into a CSV — one row per set — for the coach/sheet. */
function buildSetsCsv(program: Program, logs: Record<string, LogEntry[]>): string {
  const rows: string[][] = [['päev', 'harjutus', 'nädal', 'kuupäev', 'seeria', 'raskus_kg', 'kordused', 'PR']]
  for (const day of program.days) {
    for (const ex of day.exercises) {
      for (const log of logs[ex.id] ?? []) {
        log.sets.forEach((s, i) => {
          rows.push([
            day.name,
            ex.name,
            String(log.week),
            log.date.slice(0, 10),
            String(i + 1),
            String(s.weight),
            String(s.reps),
            log.pr && i === 0 ? 'PR' : '',
          ])
        })
      }
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

function downloadCsv(program: Program, logs: Record<string, LogEntry[]>) {
  const blob = new Blob([buildSetsCsv(program, logs)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'gymlog-seeriad.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Store-backed history for the logged-in user. */
export function HistoryView() {
  const program = useGymStore((s) => s.program)
  const logs = useGymStore((s) => s.logs)
  return <HistoryViewBody program={program} logs={logs} />
}

/** Presentational history/charts over any program + logs (reused by the admin). */
export function HistoryViewBody({
  program,
  logs,
}: {
  program: Program
  logs: Record<string, LogEntry[]>
}) {
  const [metric, setMetric] = useState<Metric>('weight')
  const [openId, setOpenId] = useState<string | null>(null)

  const exercisesWithLogs = program.days
    .flatMap((d) => d.exercises)
    .filter((ex) => (logs[ex.id]?.length ?? 0) > 0)

  return (
    <div style={S.content}>
      <div style={S.metricRow}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            style={S.metricBtn(metric === m.key)}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {exercisesWithLogs.length > 0 && (
        <button style={S.exportBtn} onClick={() => downloadCsv(program, logs)} title="Ekspordi kõik seeriad CSV-na">
          ⬇ Ekspordi seeriad (CSV)
        </button>
      )}

      {exercisesWithLogs.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
          Veel pole logitud treeninguid. Märgi harjutus tehtuks ja ajalugu ilmub siia.
        </div>
      ) : (
        exercisesWithLogs.map((ex) => {
          const history = logs[ex.id]!
          // x is the session index (monotonic), so re-logs / rolling weeks never
          // collide on the axis; the week number stays as the tick label.
          const points: ChartPoint[] = history.map((log, i) => ({
            x: i,
            y: metricValue(metric, ex, log),
            label: `N${log.week}`,
          }))
          const latest = points.at(-1)!.y
          const first = points[0]!.y
          const delta = latest - first
          const open = openId === ex.id
          return (
            <div key={ex.id} style={S.card}>
              <div style={S.cardHead} onClick={() => setOpenId(open ? null : ex.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.exName}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: colors.faint }}>
                    {history.length} treeningut · viimati {fmtDate(history.at(-1)!.date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: colors.accent }}>
                    {fmtWeight(latest)} {metricUnit(metric, ex)}
                  </div>
                  {delta !== 0 && (
                    <div style={{ fontSize: 11, color: delta > 0 ? colors.green : '#e87c47' }}>
                      {delta > 0 ? '▲' : '▼'} {fmtWeight(Math.abs(delta))} algusest
                    </div>
                  )}
                </div>
              </div>

              <LineChart points={points} fmtY={(y) => fmtWeight(y)} />

              {open && (
                <div style={S.sessions}>
                  {[...history].reverse().map((log, i) => (
                    <div key={i} style={S.sessionRow}>
                      <span style={{ color: colors.faint, width: 56, flexShrink: 0 }}>
                        N{log.week} · {fmtDate(log.date)}
                      </span>
                      <span style={{ flex: 1, color: colors.muted }}>{setsSummary(ex, log)}</span>
                      {log.pr && <span style={{ color: colors.accent }}>★ PR</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const S = {
  content: { padding: '14px 14px 96px', maxWidth: 680, margin: '0 auto' } as CSSProperties,
  metricRow: { display: 'flex', gap: 6, marginBottom: 10 } as CSSProperties,
  exportBtn: { width: '100%', marginBottom: 14, padding: '9px 12px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.green, fontSize: 13, fontWeight: 700, cursor: 'pointer' } as CSSProperties,
  metricBtn: (active: boolean): CSSProperties => ({
    flex: 1,
    padding: '8px 6px',
    background: active ? colors.accent : colors.surface,
    color: active ? '#000' : colors.muted,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  }),
  card: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, marginBottom: 10 } as CSSProperties,
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 } as CSSProperties,
  exName: { fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
  sessions: { marginTop: 8, borderTop: `1px solid ${colors.border}`, paddingTop: 8 } as CSSProperties,
  sessionRow: { display: 'flex', gap: 8, fontSize: 14, padding: '5px 0', alignItems: 'baseline' } as CSSProperties,
  empty: { textAlign: 'center', padding: '40px 20px', color: colors.faint, fontSize: 15, lineHeight: 1.8 } as CSSProperties,
}
