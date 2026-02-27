interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ data, width = 80, height = 32, className = '' }: SparklineProps) {
  if (data.length === 0) return null

  // Y-axis labels take up the left portion
  const axisWidth = 22
  const pad = 2
  const chartW = width - axisWidth - pad
  const chartH = height - pad * 2

  // Fixed 0–100% scale so the axis is always meaningful
  const values = data.map((v) => Math.max(0, Math.min(1, v)))

  const points = values.map((v, i) => {
    const x = axisWidth + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW)
    const y = pad + chartH - v * chartH
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  // Gradient fill area
  const areaPath = `${linePath} L${points[points.length - 1].x},${height - pad} L${points[0].x},${height - pad} Z`

  // Color based on trend: compare last value to first
  const last = values[values.length - 1]
  const first = values[0]
  const trending = data.length === 1 ? 'neutral' : last > first ? 'up' : last < first ? 'down' : 'neutral'

  const strokeColor = trending === 'up' ? 'var(--color-success)' : trending === 'down' ? 'var(--color-danger)' : 'var(--color-accent)'
  const fillColor = trending === 'up' ? 'var(--color-success)' : trending === 'down' ? 'var(--color-danger)' : 'var(--color-accent)'
  const axisColor = 'var(--color-on-surface-secondary)'

  // Y-axis ticks: 0%, 50%, 100%
  const ticks = [
    { label: '100', y: pad },
    { label: '50', y: pad + chartH / 2 },
    { label: '0', y: pad + chartH },
  ]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label={`Success rate trend: ${Math.round(last * 100)}%`}
    >
      <defs>
        <linearGradient id={`sparkGrad-${trending}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y-axis tick labels and grid lines */}
      {ticks.map((t) => (
        <g key={t.label}>
          <text
            x={axisWidth - 3}
            y={t.y}
            textAnchor="end"
            dominantBaseline="central"
            fontSize="6"
            fill={axisColor}
            opacity="0.6"
          >
            {t.label}
          </text>
          <line
            x1={axisWidth}
            y1={t.y}
            x2={width - pad}
            y2={t.y}
            stroke={axisColor}
            strokeOpacity="0.1"
            strokeWidth="0.5"
          />
        </g>
      ))}

      <path d={areaPath} fill={`url(#sparkGrad-${trending})`} />
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={strokeColor} />
    </svg>
  )
}
