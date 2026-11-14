import type { LabProfile } from '../../types'
import { LENSES, LENS_ORDER } from '../../lib/lab/lenses'

type Props = {
  profile: LabProfile
}

/** Tarjeta de identidad del modo Explorar: quién es, dónde está y sus tres perfiles. */
export default function IdentityCard({ profile }: Props) {
  return (
    <section className="rounded-2xl border border-lab-line bg-lab-card/90 p-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <img
          src={profile.photo}
          alt={`Foto de ${profile.shortName}`}
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-lab-accent/40"
        />
        <div className="min-w-0">
          <h1 className="font-display text-lg leading-tight font-bold tracking-tight">{profile.name}</h1>
          <p className="mt-0.5 flex items-center gap-2 font-code text-[11px] tracking-wider text-lab-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lab-accent" />
            {profile.origin.label}
          </p>
        </div>
      </div>

      <p className="mt-3 hidden font-display text-[17px] leading-snug font-semibold tracking-tight md:block">
        {profile.headline.before}
        <span className="bg-gradient-to-r from-lab-accent to-lab-accent3 bg-clip-text text-transparent">
          {profile.headline.highlight}
        </span>{' '}
        {profile.headline.after}
      </p>

      <ul className="mt-3 hidden flex-wrap gap-x-3 gap-y-1 md:flex">
        {LENS_ORDER.map((lens) => (
          <li key={lens} className="flex items-center gap-1.5 font-code text-[11px] text-lab-muted">
            <i className="h-2 w-2 rounded-[2px]" style={{ background: LENSES[lens].color }} />
            {LENSES[lens].label}
          </li>
        ))}
      </ul>

      <div className="mt-3 hidden flex-wrap gap-2 md:flex">
        <a
          href={`mailto:${profile.contact.email}`}
          className="rounded-lg bg-lab-accent px-3 py-1.5 text-[13px] font-semibold text-[#06221a] transition hover:-translate-y-0.5"
        >
          Email me
        </a>
        <a
          href={profile.contact.linkedin}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-lab-line bg-lab-bg2 px-3 py-1.5 text-[13px] font-semibold transition hover:border-lab-accent"
        >
          LinkedIn
        </a>
        <a
          href={profile.contact.github}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-lab-line bg-lab-bg2 px-3 py-1.5 text-[13px] font-semibold transition hover:border-lab-accent"
        >
          GitHub
        </a>
      </div>
    </section>
  )
}
