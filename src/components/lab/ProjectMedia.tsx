import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react'
import { useI18n } from '../../lib/lab/i18n'
import type { MediaImage, ProjectLink, ProjectMedia as Media } from '../../types'

/*
 * Material audiovisual de un proyecto (carrusel o video) y su enlace de
 * redirección. Ambos son opcionales: sin `media` ni `link` no se dibuja nada.
 */

type MediaProps = {
  media: Media
  /** Nombre del proyecto, para las etiquetas accesibles. */
  title: string
}

export default function ProjectMedia({ media, title }: MediaProps) {
  return media.type === 'images' ? <Carousel images={media.images} title={title} /> : <Video media={media} />
}

/** Distancia mínima (px) de un deslizamiento para cambiar de imagen. */
const SWIPE_THRESHOLD = 48

const frame = 'relative aspect-video w-full overflow-hidden rounded-xl border border-lab-line bg-lab-bg2'
const arrow =
  'absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-lab-line bg-lab-bg/80 text-lab-fg backdrop-blur-sm transition hover:border-lab-accent focus-visible:outline-2 focus-visible:outline-lab-accent'

function Carousel({ images, title }: { images: MediaImage[]; title: string }) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const touchX = useRef<number | null>(null)
  const total = images.length
  const many = total > 1

  // Otro proyecto (o el cambio de idioma con otra lista) vuelve al inicio.
  useEffect(() => {
    setIndex(0)
    setFailed({})
  }, [images])

  const go = (next: number) => setIndex((next + total) % total)

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!many) return
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
    else return
    e.preventDefault()
  }

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current
    touchX.current = null
    if (start === null || !many) return
    const delta = e.changedTouches[0].clientX - start
    if (Math.abs(delta) >= SWIPE_THRESHOLD) go(delta < 0 ? index + 1 : index - 1)
  }

  const image = images[Math.min(index, total - 1)]

  return (
    <figure className="m-0">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t.media.gallery(title)}
        tabIndex={many ? 0 : undefined}
        onKeyDown={onKey}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
        className={`${frame} focus-visible:outline-2 focus-visible:outline-lab-accent`}
      >
        {failed[index] ? (
          <div className="grid h-full place-items-center font-code text-[11px] text-lab-muted">{t.media.unavailable}</div>
        ) : (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed((f) => ({ ...f, [index]: true }))}
            className="h-full w-full object-contain"
          />
        )}

        {many && (
          <>
            <button type="button" aria-label={t.media.previous} onClick={() => go(index - 1)} className={`${arrow} left-2`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" aria-label={t.media.next} onClick={() => go(index + 1)} className={`${arrow} right-2`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="absolute top-2 right-2 rounded-md bg-lab-bg/80 px-1.5 py-0.5 font-code text-[10.5px] text-lab-fg tabular-nums">
              {t.media.counter(index + 1, total)}
            </span>
          </>
        )}
      </div>

      {(image.caption || many) && (
        <figcaption className="mt-2 flex items-start justify-between gap-3">
          <span className="text-[12.5px] leading-snug text-lab-muted" aria-live="polite">
            {image.caption}
          </span>
          {many && (
            <span className="flex shrink-0 gap-1.5 pt-1">
              {images.map((img, i) => (
                <button
                  key={img.src}
                  type="button"
                  aria-label={t.media.goTo(i + 1)}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-lab-accent' : 'w-1.5 bg-lab-line hover:bg-lab-muted'}`}
                />
              ))}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  )
}

/** URL de inserción para YouTube / Vimeo, o null si es un archivo de video. */
function embedUrl(src: string): string | null {
  try {
    const url = new URL(src, 'https://local.invalid')
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const id = url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}?dnt=1` : null
    }
  } catch {
    // Ruta relativa rara: se trata como archivo.
  }
  return null
}

function Video({ media }: { media: Extract<Media, { type: 'video' }> }) {
  const embed = embedUrl(media.src)
  return (
    <div className={frame}>
      {embed ? (
        <iframe
          src={embed}
          title={media.title}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="h-full w-full border-0"
        />
      ) : (
        <video
          src={media.src}
          poster={media.poster}
          title={media.title}
          aria-label={media.title}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full bg-black object-contain"
        />
      )}
    </div>
  )
}

/** Botón de redirección del proyecto. Siempre abre en otra pestaña. */
export function ProjectLinkButton({ link, compact = false }: { link: ProjectLink; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-lab-accent/60 font-semibold text-lab-fg transition hover:-translate-y-0.5 hover:border-lab-accent hover:bg-lab-accent/10 ${
        compact ? 'px-2.5 py-1 text-[12.5px]' : 'px-3.5 py-2 text-[14px]'
      }`}
    >
      {link.label ?? t.media.visit}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">({t.media.newTab})</span>
    </a>
  )
}
