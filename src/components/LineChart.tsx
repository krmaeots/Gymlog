import { useMemo } from 'react'
import { colors } from '../theme'

export interface ChartPoint {
  /** Numeric x (e.g. week number or session index). */
  x: number
  y: number
  /** Optional label shown for the x axis ticks. */
  label?: string
}

interface Props {
  points: ChartPoint[]
  color?: string
  height?: number
  /** Format a y value for the axis labels and tooltips. */
  fmtY?: (y: number) => string
}

const W = 320
const PAD = { top: 12, right: 10, bottom: 22, left: 36 }

/**
 * Minimal, dependency-free responsive line chart. Renders an SVG with a
 * viewBox so it scales to its container width.
 */
export function LineChart({ points, color = colors.accent, height = 140, fmtY = String }: Props) {
  const H = height
  const geometry = useMemo(() => {
    if (points.length === 0) return null
    const ys = points.map((p) => p.y)
    const xs = points.map((p) => p.x)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    // Pad the y range so the line isn't glued to the edges.
    const range = maxY - minY || Math.max(1, maxY * 0.1)
    const lo = minY - range * 0.15
    const hi = maxY + range * 0.15

    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const sx = (x: number) => (maxX === minX ? PAD.left + plotW / 2 : PAD.left + ((x - minX) / (maxX - minX)) * plotW)
    const sy = (y: number) => PAD.top + (1 - (y - lo) / (hi - lo)) * plotH

    const coords = points.map((p) => ({ ...p, cx: sx(p.x), cy: sy(p.y) }))
    return { coords, minY, maxY, lo, hi, sy }
  }, [points, H])

  if (!geometry) {
    return <div style={{ color: colors.faint, fontSize: 12, padding: '8px 0' }}>Andmed puuduvad</div>
  }

  const { coords, minY, maxY } = geometry
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ')
  const first = coords[0]!
  const last = coords.at(-1)!

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Progressi graafik" style={{ display: 'block' }}>
      {/* y axis min/max guides */}
      {[maxY, minY].map((val, i) => {
        const y = geometry.sy(val)
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={colors.border} strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize={9} fill={colors.faint}>
              {fmtY(val)}
            </text>
          </g>
        )
      })}

      {/* line + area */}
      <path
        d={`${path} L${last.cx.toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${first.cx.toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`}
        fill={color}
        opacity={0.08}
      />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* points */}
      {coords.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={2.5} fill={color} />
      ))}

      {/* x labels: first & last */}
      <text x={first.cx} y={H - 6} textAnchor="middle" fontSize={9} fill={colors.faint}>
        {first.label ?? first.x}
      </text>
      {coords.length > 1 && (
        <text x={last.cx} y={H - 6} textAnchor="middle" fontSize={9} fill={colors.faint}>
          {last.label ?? last.x}
        </text>
      )}
    </svg>
  )
}
