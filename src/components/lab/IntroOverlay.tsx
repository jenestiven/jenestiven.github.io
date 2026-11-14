import type { LabProfile } from '../../types'
import { useI18n } from '../../lib/lab/i18n'
import { LENSES, LENS_ORDER } from '../../lib/lab/lenses'
import LangToggle from './LangToggle'

type Props = {
  profile: LabProfile
  /** El vuelo ya arrancó: la portada se desvanece y deja de recibir eventos. */
  leaving: boolean
  /** El CTA de explorar queda inerte hasta que el mapa cargue. */
  mapReady: boolean
  onExplore: () => void
  onRead: () => void
}

/**
 * Portada de la v2: se dibuja sobre el mapa en vista de planeta. Ofrece las
 * dos formas de recorrer el portafolio — volar al mapa o leerlo — para que
 * quien tiene 30 segundos no dependa de la animación.
 */
export default function IntroOverlay({ profile, leaving, mapReady, onExplore, onRead }: Props) {
  const { t } = useI18n()
  return (
    <div
      className={`lab-intro absolute inset-0 z-30 flex flex-col items-center overflow-y-auto px-6 pt-[9vh] pb-8 text-center transition-opacity duration-700 ease-out ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        // Velo oscuro detrás del texto: da contraste sobre el globo, de día o de noche.
        background:
          'radial-gradient(ellipse 80% 62% at 50% 28%, rgb(11 15 14 / 0.9) 0%, rgb(11 15 14 / 0.62) 55%, rgb(11 15 14 / 0.42) 100%)',
      }}
    >
      <LangToggle className="absolute top-3 right-3 rounded-xl border border-lab-line bg-lab-card/80 p-1 backdrop-blur-sm" />

      <div className="flex items-center gap-3">
        <img
          src={profile.photo}
          alt={t.photoAlt(profile.shortName)}
          className="h-12 w-12 rounded-full object-cover ring-2 ring-lab-accent/40"
        />
        <div className="text-left">
          <h1 className="font-display text-[17px] leading-tight font-bold tracking-tight">{profile.name}</h1>
          <p className="mt-0.5 flex items-center gap-2 font-code text-[11px] tracking-wider text-lab-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lab-accent" />
            {profile.origin.label}
          </p>
        </div>
      </div>

      <p className="mt-7 max-w-[820px] font-display text-[clamp(34px,6vw,64px)] leading-[1.03] font-bold tracking-tight text-balance">
        {profile.headline.before}
        <span className="bg-linear-to-r from-lab-accent to-lab-accent3 bg-clip-text text-transparent">
          {profile.headline.highlight}
        </span>{' '}
        {profile.headline.after}
      </p>

      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {LENS_ORDER.map((lens) => (
          <li
            key={lens}
            className="flex items-center gap-2 rounded-full border bg-lab-bg/60 px-3 py-1 font-code text-[12px] backdrop-blur-sm"
            style={{ borderColor: `${LENSES[lens].color}66`, color: LENSES[lens].color }}
          >
            <i className="h-2 w-2 rounded-xs" style={{ background: LENSES[lens].color }} />
            {t.lenses[lens].label}
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-[520px] text-[15px] text-lab-fg/85 [text-shadow:0_1px_8px_rgb(11_15_14/0.9)]">{t.intro.tagline}</p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onExplore}
          disabled={!mapReady}
          className="inline-flex items-center gap-2 rounded-xl border border-lab-accent bg-lab-accent px-5 py-3 text-[15px] font-semibold text-[#06221a] transition enabled:hover:-translate-y-0.5 disabled:opacity-60"
        >
          {mapReady ? t.intro.explore : t.intro.loading}
          {mapReady && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px]">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onRead}
          className="inline-flex items-center gap-2 rounded-xl border border-lab-line bg-lab-card/80 px-5 py-3 text-[15px] font-semibold backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-lab-accent"
        >
          {t.intro.read}
        </button>
      </div>
    </div>
  )
}
