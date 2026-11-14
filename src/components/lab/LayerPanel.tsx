import type { LabProject, Lens } from '../../types'
import { LENSES, LENS_ORDER } from '../../lib/lab/lenses'

type Props = {
  lenses: Record<Lens, boolean>
  onToggleLens: (lens: Lens) => void
  onAllLenses: () => void
  projects: LabProject[]
  hidden: Record<string, boolean>
  onToggleProject: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  tileBoundaries: boolean
  onToggleTileBoundaries: () => void
  profileOpen: boolean
  onToggleProfile: () => void
}

const STATUS_LABEL: Record<LabProject['status'], string> = {
  production: 'in production',
  delivered: 'delivered',
  'in-progress': 'in progress',
}

/**
 * Panel de convenciones: las tres lentes (perfiles) y, dentro de cada una,
 * sus capas base y los proyectos que viven en ella.
 */
export default function LayerPanel({
  lenses,
  onToggleLens,
  onAllLenses,
  projects,
  hidden,
  onToggleProject,
  selectedId,
  onSelect,
  tileBoundaries,
  onToggleTileBoundaries,
  profileOpen,
  onToggleProfile,
}: Props) {
  const allOn = LENS_ORDER.every((lens) => lenses[lens])

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-lab-line bg-lab-card/90 backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-lab-line px-4 py-3">
        <div>
          <p className="font-code text-[11px] tracking-[0.14em] text-lab-accent uppercase">// layers</p>
          <h2 className="font-display text-base font-bold">Three lenses, one map</h2>
        </div>
        <button
          type="button"
          onClick={onAllLenses}
          disabled={allOn}
          className="rounded-lg border border-lab-line px-2.5 py-1 font-code text-[11px] text-lab-muted transition enabled:hover:border-lab-accent enabled:hover:text-lab-fg disabled:opacity-40"
        >
          all at once
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {LENS_ORDER.map((lens) => {
          const def = LENSES[lens]
          const on = lenses[lens]
          const lensProjects = projects.filter((p) => p.lens === lens)
          return (
            <div key={lens} className="rounded-xl px-2 py-2.5" style={on ? { background: `${def.color}0d` } : undefined}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onToggleLens(lens)}
                className="flex w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lab-accent"
              >
                <span
                  className="mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition"
                  style={{ borderColor: def.color, background: on ? def.color : 'transparent' }}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full transition-transform"
                    style={{ background: on ? '#0b0f0e' : def.color, transform: on ? 'translateX(16px)' : 'none' }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[15px] font-semibold" style={{ color: on ? def.color : undefined }}>
                    {def.label}
                  </span>
                  <span className="block text-[12.5px] leading-snug text-lab-muted">{def.description}</span>
                </span>
              </button>

              <ul className={`mt-2 ml-12 flex flex-col gap-0.5 ${on ? '' : 'opacity-45'}`}>
                {def.baseLayers.map((name) => (
                  <li key={name} className="flex items-center gap-2 font-code text-[11px] text-lab-muted">
                    <i className="h-px w-3" style={{ background: def.color }} />
                    {name}
                  </li>
                ))}
                {lens === 'topography' && (
                  <li className="mt-1.5">
                    <button
                      type="button"
                      aria-pressed={profileOpen}
                      disabled={!on}
                      onClick={onToggleProfile}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[13px] font-medium transition enabled:hover:bg-lab-bg2 ${
                        profileOpen ? 'bg-lab-bg2' : ''
                      }`}
                      style={{ borderColor: profileOpen ? def.color : `${def.color}55` }}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none" stroke={def.color} strokeWidth={1.8}>
                        <path d="M3 18l5-7 4 4 4-8 5 11" strokeLinejoin="round" strokeLinecap="round" />
                        <path d="M3 21h18" strokeLinecap="round" />
                      </svg>
                      {profileOpen ? 'Close elevation profile' : 'Cut an elevation profile'}
                      <span className="ml-auto rounded-full border border-lab-line px-1.5 font-code text-[9.5px] text-lab-muted">
                        tool
                      </span>
                    </button>
                  </li>
                )}
                {lens === 'software' && (
                  <li className="flex items-center gap-2 font-code text-[11px] text-lab-muted">
                    <input
                      type="checkbox"
                      id="lab-tile-boundaries"
                      checked={tileBoundaries}
                      disabled={!on}
                      onChange={onToggleTileBoundaries}
                      className="h-3 w-3 cursor-pointer"
                      style={{ accentColor: def.color }}
                    />
                    <label htmlFor="lab-tile-boundaries" className="cursor-pointer">
                      map.showTileBoundaries
                    </label>
                  </li>
                )}
                {lensProjects.map((p) => {
                  const selected = selectedId === p.id
                  return (
                    <li
                      key={p.id}
                      className={`mt-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                        selected ? 'border-lab-accent/60 bg-lab-bg2' : 'border-transparent hover:bg-lab-bg2'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`lab-vis-${p.id}`}
                        checked={!hidden[p.id]}
                        onChange={() => onToggleProject(p.id)}
                        aria-label={`Show ${p.title}`}
                        className="h-3.5 w-3.5 shrink-0 cursor-pointer"
                        style={{ accentColor: def.color }}
                      />
                      <button
                        type="button"
                        onClick={() => onSelect(p.id)}
                        className="min-w-0 flex-1 text-left text-[13px] leading-tight font-medium hover:text-lab-accent"
                      >
                        {p.title}
                      </button>
                      <span
                        className="shrink-0 rounded-full border px-1.5 font-code text-[9.5px]"
                        style={
                          p.status === 'in-progress'
                            ? { color: '#f2c14e', borderColor: '#f2c14e66' }
                            : { color: 'var(--lab-muted)', borderColor: 'var(--lab-line)' }
                        }
                      >
                        {STATUS_LABEL[p.status]}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="border-t border-lab-line px-4 py-2.5 text-[11.5px] leading-snug text-lab-muted">
        <p>Project geometries are synthetic and illustrative. Client data stays private.</p>
        <a href="/v1" className="mt-1.5 inline-block font-code text-[11px] hover:text-lab-fg">
          v1 · the guided-tour version →
        </a>
      </div>
    </section>
  )
}
