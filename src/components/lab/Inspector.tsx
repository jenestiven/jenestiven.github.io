import { useEffect, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import type { LabProject } from '../../types'
import { LENSES } from '../../lib/lab/lenses'
import { defaultStyle, mainLayerId } from '../../lib/lab/labLayers'

export type PickedFeature = {
  layer: string
  geometryType: string
  properties: Record<string, unknown>
}

type Props = {
  map: Map
  project: LabProject
  feature: PickedFeature | null
  breaks?: number[]
  onClose: () => void
}

type Tab = 'attributes' | 'style'

/** JSON con los arrays en una sola línea: las expresiones de Mapbox se leen mejor así. */
function formatStyle(style: { id: string; type: string; paint: Record<string, unknown> }) {
  const paint = Object.entries(style.paint)
    .map(([k, v]) => `    "${k}": ${JSON.stringify(v).replace(/,/g, ', ')}`)
    .join(',\n')
  return `{\n  "id": "${style.id}",\n  "type": "${style.type}",\n  "paint": {\n${paint}\n  }\n}`
}

/**
 * Inspector del proyecto seleccionado. "Attributes" es la tabla de atributos
 * (lo que se cuenta del proyecto + la feature clicada); "Style" es el editor
 * en vivo de la capa: cada cambio pasa por `setPaintProperty` y Mapbox valida.
 */
export default function Inspector({ map, project, feature, breaks, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('attributes')
  const layerId = mainLayerId(project.id)
  const defaults = defaultStyle(project.layer.kind, project.lens)
  const initialText = formatStyle({ id: layerId, type: defaults.type, paint: defaults.paint })

  const [text, setText] = useState(initialText)
  const [status, setStatus] = useState<{ ok: boolean; message: string }>({ ok: true, message: 'Valid style' })
  /** Propiedades que el editor ha aplicado, para poder restaurarlas. */
  const appliedRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<number | undefined>(undefined)

  // Cambiar de proyecto reinicia el editor.
  useEffect(() => {
    setText(initialText)
    setStatus({ ok: true, message: 'Valid style' })
    appliedRef.current = new Set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const apply = (value: string) => {
    let parsed: { type?: string; paint?: Record<string, unknown> }
    try {
      parsed = JSON.parse(value)
    } catch (error) {
      setStatus({ ok: false, message: `Invalid JSON: ${(error as Error).message}` })
      return
    }
    if (parsed.type !== defaults.type) {
      setStatus({ ok: false, message: `This layer is a "${defaults.type}" layer; its type can't change here.` })
      return
    }
    if (!parsed.paint || typeof parsed.paint !== 'object') {
      setStatus({ ok: false, message: 'Missing "paint" object.' })
      return
    }

    const errors: string[] = []
    const onError = (event: { error?: { message?: string } }) => errors.push(event.error?.message ?? 'Invalid value')
    map.on('error', onError)
    for (const [key, val] of Object.entries(parsed.paint)) {
      try {
        map.setPaintProperty(layerId, key as never, val as never)
        appliedRef.current.add(key)
      } catch (error) {
        errors.push((error as Error).message)
      }
    }
    map.off('error', onError)

    setStatus(
      errors.length
        ? { ok: false, message: errors[0].replace(/^layers\.[^.]+\.paint\./, '') }
        : { ok: true, message: 'Applied with setPaintProperty()' }
    )
  }

  const onEdit = (value: string) => {
    setText(value)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => apply(value), 250)
  }

  const reset = () => {
    appliedRef.current.forEach((key) => {
      if (!(key in defaults.paint)) map.setPaintProperty(layerId, key as never, undefined as never)
    })
    Object.entries(defaults.paint).forEach(([key, val]) => map.setPaintProperty(layerId, key as never, val as never))
    appliedRef.current = new Set()
    setText(initialText)
    setStatus({ ok: true, message: 'Style restored' })
  }

  const lens = LENSES[project.lens]
  const inProgress = project.status === 'in-progress'

  return (
    <section className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-t-2xl border border-lab-line bg-lab-card/95 backdrop-blur-md md:rounded-2xl">
      <header className="border-b border-lab-line px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-semibold"
            style={{ color: '#f2c14e', borderColor: '#f2c14e66' }}
          >
            {project.tag}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="-mt-1 -mr-1 rounded-lg px-2 py-1 text-lab-muted hover:bg-lab-bg2 hover:text-lab-fg"
          >
            ✕
          </button>
        </div>
        <h2 className="mt-2 font-display text-2xl leading-tight font-bold tracking-tight">{project.title}</h2>
        <p className="mt-1 text-[13.5px] text-lab-muted">{project.meta}</p>
        <p className="mt-2 flex items-center gap-2 font-code text-[11px]" style={{ color: lens.color }}>
          <i className="h-2 w-2 rounded-[2px]" style={{ background: lens.color }} />
          {lens.label} lens · {project.layer.kind}
          {inProgress && <span className="ml-1 rounded-full border border-[#f2c14e66] px-1.5 text-[#f2c14e]">in progress</span>}
        </p>
      </header>

      <div role="tablist" className="flex border-b border-lab-line font-code text-[12px]">
        {(['attributes', 'style'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 border-b-2 py-2 transition ${
              tab === t ? 'border-lab-accent text-lab-fg' : 'border-transparent text-lab-muted hover:text-lab-fg'
            }`}
          >
            {t === 'attributes' ? 'Attribute table' : '</> Layer style'}
          </button>
        ))}
      </div>

      {tab === 'attributes' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[14px] leading-relaxed">
          {feature && (
            <div className="mb-4 rounded-xl border border-dashed border-lab-accent3/60 bg-lab-bg2 p-3">
              <p className="font-code text-[10.5px] tracking-wider text-lab-accent3 uppercase">
                queryRenderedFeatures · {feature.geometryType}
              </p>
              <pre className="mt-1.5 overflow-x-auto font-code text-[11.5px] leading-relaxed text-lab-fg">
                {JSON.stringify(feature.properties, null, 2)}
              </pre>
            </div>
          )}

          <p className="text-lab-fg">{project.summary}</p>

          {project.points && project.points.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {project.points.map((point) => (
                <li key={point} className="relative pl-5 text-[13.5px] text-lab-muted">
                  <span className="absolute top-[0.55em] left-0 h-2 w-2 rounded-full border-2 border-lab-accent" />
                  {point}
                </li>
              ))}
            </ul>
          )}

          {project.impact && <p className="mt-4 border-l-2 border-lab-accent pl-3 text-[14px]">{project.impact}</p>}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.stack.map((s) => (
              <span key={s} className="rounded-lg border border-lab-line bg-lab-bg2 px-2.5 py-1 font-code text-[11.5px]">
                {s}
              </span>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-lab-line p-3">
            <p className="font-code text-[10.5px] tracking-wider text-lab-muted uppercase">About this layer</p>
            <p className="mt-1 text-[13px] text-lab-muted">{project.layer.note}</p>
            {breaks && (
              <p className="mt-2 font-code text-[11.5px] text-lab-fg">
                Jenks breaks (TCH): {breaks.map((b) => Math.round(b)).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
          <p className="text-[12.5px] text-lab-muted">
            Mapbox style expression for this layer. Edit it and the map updates live.
          </p>
          <textarea
            id={`lab-style-${project.id}`}
            value={text}
            spellCheck={false}
            onChange={(e) => onEdit(e.target.value)}
            aria-label="Layer style JSON"
            className="min-h-[260px] flex-1 resize-y rounded-xl border border-lab-line bg-lab-bg p-3 font-code text-[12px] leading-relaxed text-lab-fg focus:border-lab-accent3 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className={`font-code text-[11px] ${status.ok ? 'text-lab-accent' : 'text-[#ff8a7a]'}`}>
              {status.message}
            </span>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-lg border border-lab-line px-2.5 py-1 font-code text-[11px] text-lab-muted hover:border-lab-accent3 hover:text-lab-fg"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
