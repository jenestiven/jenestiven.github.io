import { useEffect, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import type { LabProject } from '../../types'
import { useI18n } from '../../lib/lab/i18n'
import { LENSES } from '../../lib/lab/lenses'
import ProjectMedia, { ProjectLinkButton } from './ProjectMedia'
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
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('attributes')
  const layerId = mainLayerId(project.id)
  const defaults = defaultStyle(project.layer.kind, project.lens)
  const initialText = formatStyle({ id: layerId, type: defaults.type, paint: defaults.paint })

  const [text, setText] = useState(initialText)
  const [status, setStatus] = useState<{ ok: boolean; message: string }>({ ok: true, message: t.inspector.valid })
  /** Propiedades que el editor ha aplicado, para poder restaurarlas. */
  const appliedRef = useRef<Set<string>>(new Set())
  /**
   * En móvil el inspector es una hoja inferior que abre plegada (solo la
   * cabecera) para no tapar la capa recién encuadrada. En escritorio siempre
   * se ve completo.
   */
  const [expanded, setExpanded] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  // Cambiar de proyecto reinicia el editor.
  useEffect(() => {
    setText(initialText)
    setStatus({ ok: true, message: t.inspector.valid })
    appliedRef.current = new Set()
    setExpanded(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const apply = (value: string) => {
    let parsed: { type?: string; paint?: Record<string, unknown> }
    try {
      parsed = JSON.parse(value)
    } catch (error) {
      setStatus({ ok: false, message: `${t.inspector.invalidJson}: ${(error as Error).message}` })
      return
    }
    if (parsed.type !== defaults.type) {
      setStatus({ ok: false, message: t.inspector.typeLocked(defaults.type) })
      return
    }
    if (!parsed.paint || typeof parsed.paint !== 'object') {
      setStatus({ ok: false, message: t.inspector.missingPaint })
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
        : { ok: true, message: t.inspector.applied }
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
    setStatus({ ok: true, message: t.inspector.restored })
  }

  const lens = LENSES[project.lens]
  const inProgress = project.status === 'in-progress'

  return (
    <section className="flex max-h-[74svh] min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border border-lab-line bg-lab-card/95 backdrop-blur-md md:max-h-full md:rounded-2xl">
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
            aria-label={t.inspector.close}
            className="-mt-1 -mr-1 rounded-lg px-2 py-1 text-lab-muted hover:bg-lab-bg2 hover:text-lab-fg"
          >
            ✕
          </button>
        </div>
        <h2 className="mt-2 font-display text-xl leading-tight font-bold tracking-tight md:text-2xl">{project.title}</h2>
        <p className="mt-1 text-[13.5px] text-lab-muted">{project.meta}</p>
        <p className="mt-2 flex items-center gap-2 font-code text-[11px]" style={{ color: lens.color }}>
          <i className="h-2 w-2 rounded-[2px]" style={{ background: lens.color }} />
          {t.inspector.lensLine(t.lenses[project.lens].label)} · {project.layer.kind}
          {inProgress && (
            <span className="ml-1 rounded-full border border-[#f2c14e66] px-1.5 text-[#f2c14e]">{t.inspector.inProgress}</span>
          )}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full rounded-lg border border-lab-line py-2 font-code text-[11.5px] text-lab-muted md:hidden"
        >
          {expanded ? t.inspector.collapse : t.inspector.expand}
        </button>
      </header>

      <div className={`${expanded ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col md:flex`}>
      <div role="tablist" className="flex border-b border-lab-line font-code text-[12px]">
        {(['attributes', 'style'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 border-b-2 py-2 transition ${
              tab === id ? 'border-lab-accent text-lab-fg' : 'border-transparent text-lab-muted hover:text-lab-fg'
            }`}
          >
            {id === 'attributes' ? t.inspector.tabAttributes : t.inspector.tabStyle}
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

          {project.media && (
            <div className="mb-4">
              <ProjectMedia media={project.media} title={project.title} />
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

          {project.link && (
            <div className="mt-4">
              <ProjectLinkButton link={project.link} />
            </div>
          )}

          <div className="mt-5 rounded-xl border border-lab-line p-3">
            <p className="font-code text-[10.5px] tracking-wider text-lab-muted uppercase">{t.inspector.aboutLayer}</p>
            <p className="mt-1 text-[13px] text-lab-muted">{project.layer.note}</p>
            {breaks && (
              <p className="mt-2 font-code text-[11.5px] text-lab-fg">
                {t.inspector.jenks}: {breaks.map((b) => Math.round(b)).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
          <p className="text-[12.5px] text-lab-muted">
            {t.inspector.styleHint}
          </p>
          <textarea
            id={`lab-style-${project.id}`}
            value={text}
            spellCheck={false}
            onChange={(e) => onEdit(e.target.value)}
            aria-label={t.inspector.styleLabel}
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
              {t.inspector.reset}
            </button>
          </div>
        </div>
      )}
      </div>
    </section>
  )
}
