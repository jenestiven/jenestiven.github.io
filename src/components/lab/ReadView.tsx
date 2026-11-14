import { useMemo, useRef, type ReactNode } from 'react'
import type { LabProfile, LabProject } from '../../types'
import { useI18n } from '../../lib/lab/i18n'
import { LENSES, LOT_CLASS_COLORS } from '../../lib/lab/lenses'
import ArchDiagram from './ArchDiagram'
import ProjectMedia, { ProjectLinkButton } from './ProjectMedia'

type Props = {
  profile: LabProfile
  projects: LabProject[]
  onExplore: () => void
  onViewOnMap: (projectId: string) => void
  onViewTraverse: () => void
}

const ICONS: Record<NonNullable<LabProject['icon']>, ReactNode> = {
  building: <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />,
  chart: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 15v-3M12 15V9M17 15v-5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  terrain: <path d="M3 20 9 8l4 7 3-5 5 10z" />,
  code: <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" />,
}

/** Curvas de nivel decorativas del hero (mismo ruido determinista que jenestiven.github.io). */
function useContours() {
  return useMemo(() => {
    const W = 1200
    const n = (x: number, y: number) =>
      Math.sin(x * 0.006 + 1.3) * Math.cos(y * 0.008) + 0.6 * Math.sin(x * 0.011 - y * 0.007 + 2) + 0.35 * Math.cos(x * 0.017 + y * 0.013)
    return Array.from({ length: 14 }, (_, k) => {
      const base = 60 + k * 48
      let d = ''
      for (let x = -20; x <= W + 20; x += 20) d += `${x === -20 ? 'M' : 'L'}${x} ${(base + 38 * n(x, base)).toFixed(1)} `
      return { d, major: k % 4 === 0 }
    })
  }, [])
}

/** Mapa ilustrativo de productividad del hero (el "productivity_map.qgz"). */
function useLots() {
  return useMemo(() => {
    let seed = 7
    const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    const out: { points: string; fill: string }[] = []
    const cw = 30
    const ch = 26
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 12; i++) {
        const x = i * cw
        const y = j * ch
        const v = (Math.sin(i * 0.55 + 0.4) + Math.cos(j * 0.6 - 1) + r() * 0.9 + 1.2) / 4.1
        const fill = LOT_CLASS_COLORS[Math.max(0, Math.min(4, Math.floor(v * 5)))]
        const sk = (r() - 0.5) * 6
        out.push({ points: `${x + 1},${y + 1 + sk} ${x + cw - 1},${y + 1} ${x + cw - 1},${y + ch - 1 - sk} ${x + 1},${y + ch - 1}`, fill })
      }
    }
    return out
  }, [])
}

const btn =
  'inline-flex items-center gap-2 rounded-xl border border-lab-line bg-lab-card px-5 py-3 text-[15px] font-semibold transition hover:-translate-y-0.5 hover:border-lab-accent'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl border border-lab-accent bg-lab-accent px-5 py-3 text-[15px] font-semibold text-[#06221a] transition hover:-translate-y-0.5'
const chip = 'rounded-lg border border-lab-line bg-lab-bg2 px-2.5 py-1 font-code text-[12px]'
const eyebrow = 'mb-2.5 font-code text-[12.5px] tracking-[0.14em] text-lab-accent uppercase'
const secTitle = 'font-display text-[clamp(28px,4vw,40px)] leading-tight font-bold tracking-tight'

function MapButton({ onClick, lens }: { onClick: () => void; lens: LabProject['lens'] }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 font-code text-[12px] text-lab-muted transition hover:text-lab-fg"
    >
      <i className="h-2 w-2 rounded-[2px]" style={{ background: LENSES[lens].color }} />
      {t.read.viewOnMap}
    </button>
  )
}

/**
 * Vista Leer: jenestiven.github.io integrado en la misma app, alimentado por
 * las mismas colecciones que el mapa. Cada proyecto lleva de vuelta a su capa.
 */
export default function ReadView({ profile, projects, onExplore, onViewOnMap, onViewTraverse }: Props) {
  const { t } = useI18n()
  const r = t.read
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contours = useContours()
  const lots = useLots()

  const featured = projects.filter((p) => p.featured && p.status !== 'in-progress')
  const [lead, ...rest] = featured
  const research = projects.filter((p) => p.status === 'in-progress')
  const others = projects.filter((p) => !p.featured && p.status !== 'in-progress')

  // Los anchors cambiarían el hash (que controla el modo), así que se navega con scrollIntoView.
  const go = (id: string) => scrollerRef.current?.querySelector(`#lab-${id}`)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div ref={scrollerRef} className="lab lab-read absolute inset-0 z-30 overflow-y-auto bg-lab-bg text-[16px] leading-[1.65]">
      <nav className="sticky top-0 z-20 border-b border-lab-line bg-lab-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between px-5">
          <button type="button" onClick={() => go('top')} className="flex items-center gap-2.5 font-display font-bold">
            <img src={profile.photo} alt="" className="h-[30px] w-[30px] rounded-full object-cover" />
            {/* En móvil el conmutador Explore/Read ocupa el centro de la barra: solo cabe la foto. */}
            <span className="hidden sm:inline">{profile.shortName}</span>
          </button>
          <div className="flex items-center gap-5 text-[14px]">
            <ul className="hidden gap-5 text-lab-muted sm:flex">
              {(['work', 'skills', 'path', 'contact'] as const).map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => go(id)} className="hover:text-lab-accent">
                    {r.nav[id]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <header id="lab-top" className="relative overflow-hidden pt-[88px] pb-[72px]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-55" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {contours.map(({ d, major }) => (
            <path key={d} d={d} fill="none" stroke="var(--lab-accent)" strokeWidth={major ? 1.3 : 1} opacity={major ? 0.45 : 0.22} />
          ))}
        </svg>
        <div className="relative mx-auto grid max-w-[1120px] gap-11 px-5 min-[900px]:grid-cols-[1.25fr_0.9fr] min-[900px]:items-center">
          <div>
            <div className="mb-4.5 inline-flex items-center gap-2.5 rounded-full border border-lab-line bg-lab-bg2 px-3 py-1 font-code text-[12.5px] tracking-[0.08em] text-lab-accent">
              <b className="h-[7px] w-[7px] animate-pulse rounded-full bg-lab-accent shadow-[0_0_0_4px_var(--lab-glow)]" />
              {profile.origin.label}
            </div>
            <h1 className="mb-4.5 font-display text-[clamp(38px,6.4vw,68px)] leading-[1.02] font-bold tracking-tight">
              {profile.headline.before}
              <span className="bg-gradient-to-r from-lab-accent to-lab-accent3 bg-clip-text text-transparent">{profile.headline.highlight}</span>
              <br />
              {profile.headline.after}
            </h1>
            <p className="mb-7 max-w-[590px] text-[18px] text-lab-muted">{profile.lead}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onExplore} className={btnPrimary}>
                {r.explore}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px]">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <button type="button" onClick={() => go('work')} className={btn}>
                {r.seeWork}
              </button>
              <a className={btn} href={`mailto:${profile.contact.email}`}>
                {r.email}
              </a>
              <a className={btn} href={profile.contact.linkedin} target="_blank" rel="noopener">
                LinkedIn
              </a>
              <a className={btn} href={profile.contact.github} target="_blank" rel="noopener">
                GitHub
              </a>
            </div>
          </div>

          <div className="rounded-[18px] border border-lab-line bg-lab-card p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
            <div className="mb-2.5 flex items-center justify-between text-[12px] text-lab-muted">
              <div className="flex gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-lab-line" />
                <i className="h-2.5 w-2.5 rounded-full bg-lab-line" />
                <i className="h-2.5 w-2.5 rounded-full bg-lab-line" />
              </div>
              <span className="font-code">productivity_map.qgz</span>
            </div>
            <svg viewBox="0 0 360 260" className="block h-auto w-full rounded-xl bg-lab-bg2" aria-label={r.mapAlt}>
              {lots.map((l) => (
                <polygon key={l.points} points={l.points} fill={l.fill} opacity={0.88} />
              ))}
              <path d="M0 132 C 90 120,170 150,360 128" stroke="rgba(255,255,255,.75)" strokeWidth="3" fill="none" />
              <path d="M178 0 C 186 90,170 170,182 260" stroke="rgba(255,255,255,.55)" strokeWidth="2" fill="none" strokeDasharray="6 4" />
            </svg>
            <div className="mt-2.5 flex items-center gap-1.5 font-code text-[11.5px] text-lab-muted">
              TCH
              {LOT_CLASS_COLORS.map((c) => (
                <i key={c} className="inline-block h-2 w-[22px] rounded-[2px]" style={{ background: c }} />
              ))}
              <span className="ml-auto">{r.jenks}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-lab-muted opacity-80">{r.mapCaption}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-5">
        <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-lab-line bg-lab-line md:grid-cols-4">
          {profile.stats.map((s) => (
            <div key={s.label} className="bg-lab-card px-5 py-5.5">
              <b className="mb-1.5 block font-display text-[32px] leading-none text-lab-fg">{s.value}</b>
              <span className="text-[13.5px] text-lab-muted">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <section id="lab-work" className="mx-auto max-w-[1120px] px-5 pt-[84px]">
        <div className={eyebrow}>{r.workEyebrow}</div>
        <h2 className={`${secTitle} mb-3`}>{r.workTitle}</h2>
        <p className="mb-8.5 max-w-[640px] text-lab-muted">{profile.workNote}</p>

        {lead && (
          <article className="relative grid gap-7 overflow-hidden rounded-[22px] border border-lab-line bg-lab-card p-7 min-[900px]:grid-cols-[1fr_1.05fr] min-[900px]:p-[38px]">
            <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] bg-[radial-gradient(circle,var(--lab-glow),transparent_70%)]" />
            <div className="relative">
              <span className="mb-3.5 inline-block rounded-full border border-lab-accent2/40 px-2.5 py-0.5 text-[12px] font-semibold text-lab-accent2">{lead.tag}</span>
              <h3 className="mb-1.5 font-display text-[30px] font-bold tracking-tight">{lead.title}</h3>
              <div className="mb-4 text-[14px] text-lab-muted">{lead.meta}</div>
              <ul className="mb-4.5 flex flex-col gap-2">
                {(lead.points ?? [lead.summary]).map((p) => (
                  <li key={p} className="relative pl-5.5">
                    <span className="absolute top-[0.62em] left-0 h-[9px] w-[9px] rounded-full border-2 border-lab-accent" />
                    {p}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {lead.stack.map((s) => (
                  <span key={s} className={chip}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <MapButton lens={lead.lens} onClick={() => onViewOnMap(lead.id)} />
                {lead.link && <ProjectLinkButton link={lead.link} compact />}
              </div>
            </div>
            {(lead.media || lead.diagram) && (
              <div className="relative flex flex-col gap-6">
                {lead.media && <ProjectMedia media={lead.media} title={lead.title} />}
                {lead.diagram && <ArchDiagram diagram={lead.diagram} />}
              </div>
            )}
          </article>
        )}

        <div className="mt-4.5 grid gap-4.5 md:grid-cols-2">
          {rest.map((p) => (
            <ProjectCard key={p.id} project={p} onViewOnMap={onViewOnMap} />
          ))}
        </div>

        {research.length > 0 && (
          <>
            <div className={`${eyebrow} mt-14`}>{r.researchEyebrow}</div>
            <div className="grid gap-4.5 md:grid-cols-2">
              {research.map((p) => (
                <ProjectCard key={p.id} project={p} onViewOnMap={onViewOnMap} />
              ))}
            </div>
          </>
        )}

        {others.length > 0 && (
          <>
            <div className={`${eyebrow} mt-14`}>{r.otherEyebrow}</div>
            <div className="grid gap-4.5 md:grid-cols-2">
              {others.map((p) => (
                <ProjectCard key={p.id} project={p} onViewOnMap={onViewOnMap} />
              ))}
            </div>
          </>
        )}
      </section>

      <section id="lab-skills" className="mx-auto max-w-[1120px] px-5 pt-[84px]">
        <div className={eyebrow}>{r.skillsEyebrow}</div>
        <h2 className={`${secTitle} mb-3`}>{r.skillsTitle}</h2>
        <p className="mb-8.5 max-w-[640px] text-lab-muted">{r.skillsSub}</p>
        <div className="grid gap-3.5 md:grid-cols-3">
          {profile.skills.map((group, i) => (
            <div key={group.group} className="rounded-2xl border border-lab-line bg-lab-card p-5">
              <h4 className="mb-3 flex items-center gap-2 font-display text-[16px] font-semibold">
                <i className="h-2 w-2 rounded-[2px]" style={{ background: ['var(--lab-accent)', 'var(--lab-accent3)', 'var(--lab-accent2)'][i % 3] }} />
                {group.group}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((s) => (
                  <span key={s} className={chip}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="lab-path" className="mx-auto max-w-[1120px] px-5 pt-[84px]">
        <div className={eyebrow}>{r.pathEyebrow}</div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className={secTitle}>{r.pathTitle}</h2>
          <button type="button" onClick={onViewTraverse} className="inline-flex items-center gap-2 font-code text-[12px] text-lab-muted hover:text-lab-fg">
            <i className="h-2 w-2 rounded-[2px]" style={{ background: LENSES.topography.color }} />
            {r.traverse}
          </button>
        </div>
        <div className="relative mt-7.5 ml-2 border-l border-dashed border-lab-line pl-6.5">
          {profile.timeline.map((t) => (
            <div key={`${t.when}-${t.title}`} className="relative pb-7">
              <span className="absolute top-1.5 -left-[33px] h-[13px] w-[13px] rounded-full border-2 border-lab-accent bg-lab-bg" />
              <div className="flex items-center gap-2 font-code text-[12.5px] text-lab-accent">
                {t.when}
                {t.code && <span className="rounded border border-lab-accent2/40 px-1 text-[10.5px] text-lab-accent2">{t.code}</span>}
              </div>
              <h4 className="mt-0.5 mb-0.5 font-display text-[18px] font-semibold">{t.title}</h4>
              <p className="text-lab-muted">{t.org}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-[1120px] px-5">
        <div id="lab-contact" className="relative mt-[90px] overflow-hidden rounded-3xl border border-lab-line bg-gradient-to-br from-lab-card to-lab-bg2 px-7 py-11 text-center">
          <div className={eyebrow}>{r.contactEyebrow}</div>
          <h2 className="mb-2.5 font-display text-[clamp(28px,4vw,40px)] font-bold tracking-tight">{profile.contact.title}</h2>
          <p className="mx-auto mb-6 max-w-[520px] text-lab-muted">{profile.contact.body}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a className={btnPrimary} href={`mailto:${profile.contact.email}`}>
              {profile.contact.email}
            </a>
            <a className={btn} href={profile.contact.linkedin} target="_blank" rel="noopener">
              LinkedIn
            </a>
            <a className={btn} href={profile.contact.github} target="_blank" rel="noopener">
              GitHub
            </a>
          </div>
        </div>
        <footer className="py-9 pb-11 text-center font-code text-[13px] text-lab-muted">{profile.footer}</footer>
      </div>
    </div>
  )
}

function ProjectCard({ project: p, onViewOnMap }: { project: LabProject; onViewOnMap: (id: string) => void }) {
  const { t } = useI18n()
  return (
    <article className="relative rounded-[18px] border border-lab-line bg-lab-card p-6 transition hover:-translate-y-[3px] hover:border-lab-accent/55">
      <div className="mb-4 grid h-[42px] w-[42px] place-items-center rounded-[11px] border border-lab-line bg-lab-bg2">
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] fill-none stroke-lab-accent" strokeWidth={1.8}>
          {ICONS[p.icon ?? 'code']}
        </svg>
      </div>
      {p.status === 'in-progress' && (
        <span className="mb-2 inline-block rounded-full border border-lab-accent2/40 px-2.5 py-0.5 text-[12px] font-semibold text-lab-accent2">{t.read.inProgress}</span>
      )}
      <h3 className="mb-1 font-display text-[21px] font-bold tracking-tight">{p.title}</h3>
      <div className="mb-3 text-[14px] text-lab-muted">{p.meta}</div>
      {p.media && (
        <div className="mb-4">
          <ProjectMedia media={p.media} title={p.title} />
        </div>
      )}
      <p className="mb-3.5 text-lab-muted">{p.summary}</p>
      {p.impact && <div className="mb-4 border-l-2 border-lab-accent pl-2.5 text-[14px]">{p.impact}</div>}
      {p.points && p.points.length > 0 && (
        <ul className="mb-4.5 flex flex-col gap-2">
          {p.points.map((point) => (
            <li key={point} className="relative pl-5.5">
              <span className="absolute top-[0.62em] left-0 h-[9px] w-[9px] rounded-full border-2 border-lab-accent" />
              {point}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        {p.stack.map((s) => (
          <span key={s} className={chip}>
            {s}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <MapButton lens={p.lens} onClick={() => onViewOnMap(p.id)} />
        {p.link && <ProjectLinkButton link={p.link} compact />}
      </div>
    </article>
  )
}
