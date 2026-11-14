import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  formatAbscisa,
  formatGrade,
  formatLength,
  formatMeters,
  niceStep,
  type Profile,
} from '../../lib/lab/elevationProfile'
import { LENSES } from '../../lib/lab/lenses'
import type { ElevationProfileTool } from './useElevationProfile'

type Props = {
  tool: ElevationProfileTool
}

/**
 * Una sola serie, así que un solo color: el ámbar de la lente Topógrafo, el
 * mismo de la línea dibujada en el mapa (la curva y la línea son la misma
 * cosa). El texto nunca usa este color, solo las marcas.
 */
const SERIES = LENSES.topography.color

const smallButton =
  'rounded-lg border border-lab-line px-2.5 py-1 font-code text-[11px] text-lab-muted transition enabled:hover:border-lab-accent2 enabled:hover:text-lab-fg disabled:opacity-40'

/** Panel de la herramienta de perfil: estado del dibujo, cifras, gráfica y tabla. */
export default function ProfilePanel({ tool }: Props) {
  const { profile, status, vertices, active } = tool
  const [view, setView] = useState<'chart' | 'table'>('chart')

  return (
    <section
      aria-label="Elevation profile"
      className="pointer-events-auto flex w-full flex-col rounded-t-2xl border border-lab-line bg-lab-card/95 backdrop-blur-md md:rounded-2xl"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-lab-line px-4 py-2.5">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
          <i className="h-0.5 w-4 rounded-full" style={{ background: SERIES }} />
          Elevation profile
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {profile && (
            <div role="group" aria-label="View" className="flex rounded-lg border border-lab-line p-0.5 font-code text-[11px]">
              {(['chart', 'table'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-2 py-0.5 capitalize transition ${
                    view === v ? 'bg-lab-bg2 text-lab-fg' : 'text-lab-muted hover:text-lab-fg'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={tool.undo} disabled={vertices.length === 0} className={smallButton}>
            Undo point
          </button>
          <button
            type="button"
            onClick={active ? tool.finish : tool.resume}
            className={`${smallButton} ${active ? 'border-lab-accent2/70 text-lab-fg' : ''}`}
          >
            {active ? 'Stop drawing' : 'Add points'}
          </button>
          <button type="button" onClick={tool.close} aria-label="Close elevation profile" className={smallButton}>
            ✕
          </button>
        </div>
      </header>

      {status === 'error' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-[13.5px]">
          <p>Couldn't load the elevation data. Check your connection and try again.</p>
          <button type="button" onClick={tool.retry} className={smallButton}>
            Retry
          </button>
        </div>
      ) : !profile ? (
        <p className="px-4 py-5 text-[13.5px] text-lab-muted">
          {status === 'loading'
            ? 'Reading Mapbox Terrain-DEM…'
            : vertices.length === 1
              ? 'Start point set. Click a second point to cut the profile.'
              : 'Click two or more points on the map to cut a terrain profile along that line.'}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 px-4 pt-3 sm:grid-cols-6">
            {[
              ['Length', formatLength(profile.length)],
              ['Lowest', formatMeters(profile.min.ele)],
              ['Highest', formatMeters(profile.max.ele)],
              ['Ascent', `+${formatMeters(profile.ascent)}`],
              ['Descent', `−${formatMeters(profile.descent)}`],
              ['Avg. grade', `${(((profile.ascent + profile.descent) / profile.length) * 100).toFixed(1)}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-code text-[9.5px] tracking-wider text-lab-muted uppercase">{label}</dt>
                <dd className="text-[14px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Mientras llega una lectura nueva, la anterior se queda atenuada: sin saltos. */}
          <div className={`pt-1 transition-opacity ${status === 'loading' ? 'opacity-50' : ''}`}>
            {view === 'chart' ? (
              <ProfileChart profile={profile} hover={tool.hover} onHover={tool.setHover} />
            ) : (
              <ProfileTable profile={profile} />
            )}
          </div>

          <p className="px-4 pb-2.5 font-code text-[10px] text-lab-muted">
            Mapbox Terrain-DEM v1 · zoom {profile.demZoom} · {profile.samples.length} samples, one every{' '}
            {(profile.length / (profile.samples.length - 1)).toFixed(1)} m
          </p>
        </>
      )}
    </section>
  )
}

const CHART_HEIGHT = 190
const MARGIN = { top: 40, right: 16, bottom: 24, left: 50 }
const AXIS_TEXT = { fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--lab-muted)' } as const

type ChartProps = {
  profile: Profile
  hover: number | null
  onHover: (index: number | null) => void
}

function ProfileChart({ profile, hover, onHover }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { samples, length: total, min, max } = profile
  const last = samples.length - 1
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
  const baseline = MARGIN.top + plotHeight

  // Eje Y en números redondos que encierran el rango de cotas, sin bajar a
  // cero: en un perfil la base es una cota de referencia, no el nivel del mar.
  const yStep = niceStep(Math.max(max.ele - min.ele, 4) / 4)
  const yMin = Math.floor(min.ele / yStep) * yStep
  const yMax = Math.max(Math.ceil(max.ele / yStep) * yStep, yMin + yStep)
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-6; v += yStep) yTicks.push(v)

  const xStep = niceStep(total / Math.max(2, Math.floor(plotWidth / 120)))
  const xTicks: number[] = []
  for (let d = 0; d <= total; d += xStep) xTicks.push(d)

  const sx = (d: number) => MARGIN.left + (d / total) * plotWidth
  const sy = (ele: number) => MARGIN.top + (1 - (ele - yMin) / (yMax - yMin)) * plotHeight

  const line = samples.map((s, i) => `${i ? 'L' : 'M'}${sx(s.d).toFixed(1)} ${sy(s.ele).toFixed(1)}`).join('')
  const area = `${line}L${sx(total).toFixed(1)} ${baseline}L${MARGIN.left} ${baseline}Z`

  // Cuánto se estira la vertical respecto a la horizontal: dato de rigor en un perfil.
  const exaggeration = plotWidth > 0 ? plotHeight / (yMax - yMin) / (plotWidth / total) : 0

  // Rótulos directos solo en los extremos; el resto lo dan los ejes y el tooltip.
  const labelX = (d: number) => Math.min(Math.max(sx(d), MARGIN.left + 28), width - MARGIN.right - 28)
  const maxLabel = { x: labelX(max.d), y: sy(max.ele) - 10 }
  const minBelow = sy(min.ele) + 22 <= baseline
  const minLabel = { x: labelX(min.d), y: minBelow ? sy(min.ele) + 18 : sy(min.ele) - 10 }
  const showMinLabel = Math.abs(minLabel.x - maxLabel.x) > 70 || Math.abs(minLabel.y - maxLabel.y) > 14

  const sample = hover !== null ? samples[Math.min(hover, last)] : null

  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    onHover(Math.round(t * last))
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1
    let next: number
    if (e.key === 'ArrowRight') next = hover === null ? 0 : Math.min(last, hover + step)
    else if (e.key === 'ArrowLeft') next = hover === null ? last : Math.max(0, hover - step)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    onHover(next)
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label="Elevation profile chart. Use the arrow keys to read the elevation along the line."
      onKeyDown={onKey}
      onBlur={() => onHover(null)}
      className="relative mx-1 rounded-lg focus-visible:outline-2 focus-visible:outline-lab-accent2"
      style={{ height: CHART_HEIGHT }}
    >
      {width > 0 && (
        <svg width={width} height={CHART_HEIGHT} aria-hidden="true" className="block">
          <text x={4} y={12} {...AXIS_TEXT}>
            Elevation (m)
          </text>
          <text x={width - MARGIN.right} y={12} textAnchor="end" {...AXIS_TEXT}>
            Vertical exaggeration ×{exaggeration >= 10 ? exaggeration.toFixed(0) : exaggeration.toFixed(1)}
          </text>

          {yTicks.map((v) => (
            <g key={v}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={sy(v)} y2={sy(v)} stroke="var(--lab-line)" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={sy(v) + 3.5} textAnchor="end" {...AXIS_TEXT}>
                {v.toLocaleString('en-US', { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text
              key={d}
              x={sx(d)}
              y={baseline + 16}
              textAnchor={sx(d) > width - MARGIN.right - 30 ? 'end' : 'middle'}
              {...AXIS_TEXT}
            >
              {formatAbscisa(d)}
            </text>
          ))}

          <path d={area} fill={SERIES} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          <circle cx={sx(max.d)} cy={sy(max.ele)} r={4} fill={SERIES} stroke="var(--lab-card)" strokeWidth={2} />
          <text x={maxLabel.x} y={maxLabel.y} textAnchor="middle" {...AXIS_TEXT} fill="var(--lab-fg)">
            {formatMeters(max.ele)}
          </text>
          {showMinLabel && (
            <>
              <circle cx={sx(min.d)} cy={sy(min.ele)} r={4} fill={SERIES} stroke="var(--lab-card)" strokeWidth={2} />
              <text x={minLabel.x} y={minLabel.y} textAnchor="middle" {...AXIS_TEXT} fill="var(--lab-fg)">
                {formatMeters(min.ele)}
              </text>
            </>
          )}

          {sample && (
            <>
              <line x1={sx(sample.d)} x2={sx(sample.d)} y1={MARGIN.top} y2={baseline} stroke="var(--lab-muted)" strokeWidth={1} />
              <circle cx={sx(sample.d)} cy={sy(sample.ele)} r={5} fill={SERIES} stroke="var(--lab-card)" strokeWidth={2} />
            </>
          )}

          {/* El área de lectura es toda la gráfica: el cursor solo tiene que acertar la abscisa. */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            style={{ touchAction: 'none', cursor: 'crosshair' }}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => onHover(null)}
          />
        </svg>
      )}

      {sample && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-lab-line bg-lab-bg px-2.5 py-1 whitespace-nowrap shadow-lg"
          style={{ left: Math.min(Math.max(sx(sample.d), 84), width - 84) }}
        >
          <p className="flex items-center gap-1.5 text-[13px] leading-tight font-semibold text-lab-fg">
            <i className="h-0.5 w-3 rounded-full" style={{ background: SERIES }} />
            {formatMeters(sample.ele)}
          </p>
          <p className="font-code text-[10.5px] text-lab-muted">
            {formatAbscisa(sample.d)} · grade {formatGrade(sample.grade)}
          </p>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {sample ? `${formatAbscisa(sample.d)}: ${formatMeters(sample.ele)}, grade ${formatGrade(sample.grade)}` : ''}
      </p>
    </div>
  )
}

/** La misma lectura como cartera: estación, cota y pendiente a intervalos regulares. */
function ProfileTable({ profile }: { profile: Profile }) {
  const { samples, length: total } = profile
  const last = samples.length - 1
  const step = niceStep(total / 14)

  const at = (d: number) => {
    const f = (d / total) * last
    const i = Math.min(last - 1, Math.floor(f))
    const t = f - i
    return {
      d,
      ele: samples[i].ele + (samples[i + 1].ele - samples[i].ele) * t,
      grade: samples[i].grade + (samples[i + 1].grade - samples[i].grade) * t,
    }
  }
  const rows = []
  for (let d = 0; d < total - step * 0.25; d += step) rows.push(at(d))
  rows.push(at(total))

  return (
    <div className="mx-4 mb-2 overflow-y-auto rounded-lg border border-lab-line" style={{ maxHeight: CHART_HEIGHT - 8 }}>
      <table className="w-full border-collapse text-[12.5px] tabular-nums">
        <thead className="sticky top-0 bg-lab-bg2 font-code text-[10px] tracking-wider text-lab-muted uppercase">
          <tr>
            <th scope="col" className="px-3 py-1.5 text-left font-normal">
              Station
            </th>
            <th scope="col" className="px-3 py-1.5 text-right font-normal">
              Elevation
            </th>
            <th scope="col" className="px-3 py-1.5 text-right font-normal">
              Grade
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.d} className="border-t border-lab-line">
              <td className="px-3 py-1 font-code text-[11.5px]">{formatAbscisa(row.d)}</td>
              <td className="px-3 py-1 text-right">{formatMeters(row.ele)}</td>
              <td className="px-3 py-1 text-right text-lab-muted">{formatGrade(row.grade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
