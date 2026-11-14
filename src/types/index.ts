/*
 * Tipos del portafolio. Son la fuente de verdad: el esquema de
 * `src/content/config.ts` los replica en Zod.
 */

/** Los tres perfiles de Jhon, cada uno es una lente sobre el mismo mapa. */
export type Lens = 'topography' | 'gis' | 'software'

/** Geometría ilustrativa que se genera para la capa de un proyecto. */
export type LabLayerKind = 'lots' | 'points' | 'routes' | 'graduated' | 'study-area'

export type ArchNode = {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub?: string[]
  highlight?: boolean
}

/** Diagrama de arquitectura descrito como datos (cajas + flujos SVG). */
export type ArchDiagram = {
  viewBox: string
  label: string
  nodes: ArchNode[]
  /** Atributo `d` de cada flujo animado. */
  flows: string[]
}

/** Una imagen del carrusel. `src` es una ruta de /public o una URL. */
export type MediaImage = {
  src: string
  alt: string
  caption?: string
  es?: { alt?: string; caption?: string }
}

/**
 * Material audiovisual de un proyecto: un carrusel de imágenes o un video.
 * Es opcional: un proyecto sin material simplemente no lo declara.
 */
export type ProjectMedia =
  | { type: 'images'; images: MediaImage[] }
  | {
      type: 'video'
      /** Archivo (.mp4/.webm en /public o URL) o enlace de YouTube / Vimeo. */
      src: string
      /** Título accesible del video. */
      title: string
      /** Imagen de portada para archivos de video (YouTube y Vimeo traen la suya). */
      poster?: string
      es?: { title?: string }
    }

/** Enlace de redirección del proyecto: demo, sitio en producción, repositorio… */
export type ProjectLink = {
  url: string
  /** Texto del botón. Por defecto: "Visit project" / "Ver proyecto". */
  label?: string
  es?: { label?: string }
}

export type LabProject = {
  id: string
  title: string
  /** Orden de aparición en el panel de capas y en la vista Leer. */
  order: number
  /** Proyecto principal: va en "Featured projects". Los demás, en "Other projects". */
  featured: boolean
  /** No se publica (ni en el mapa ni en Leer) mientras sea `true`. */
  draft?: boolean
  lens: Lens
  status: 'production' | 'delivered' | 'in-progress'
  /** Etiqueta corta, p. ej. "Precision agriculture · 2026". */
  tag: string
  /** Cliente / contexto. */
  meta: string
  summary: string
  impact?: string
  points?: string[]
  stack: string[]
  icon?: 'building' | 'chart' | 'pin' | 'terrain' | 'code'
  diagram?: ArchDiagram
  media?: ProjectMedia
  link?: ProjectLink
  layer: {
    kind: LabLayerKind
    /** Centro aproximado de la geometría ilustrativa [lng, lat]. */
    anchor: [number, number]
    /** Nota visible sobre qué representa la geometría. */
    note: string
  }
  /** Textos en español. Lo que falte cae al inglés. */
  es?: {
    title?: string
    tag?: string
    meta?: string
    summary?: string
    impact?: string
    points?: string[]
    diagram?: ArchDiagram
    layerNote?: string
  }
}

export type TimelineEntry = {
  /** Código de estación en la poligonal, p. ej. "E3". Sin estación no entra a la poligonal. */
  code?: string
  when: string
  title: string
  org: string
  station?: [number, number]
}

export type LabProfile = {
  id: string
  name: string
  shortName: string
  fullName: string
  role: string
  photo: string
  origin: { label: string; coord: [number, number] }
  headline: { before: string; highlight: string; after: string }
  lead: string
  stats: { value: string; label: string }[]
  workNote: string
  skills: { group: string; items: string[] }[]
  timeline: TimelineEntry[]
  contact: {
    title: string
    body: string
    email: string
    linkedin: string
    github: string
  }
  footer: string
  /** Textos en español. Lo que falte cae al inglés. */
  es?: {
    role?: string
    headline?: LabProfile['headline']
    lead?: string
    stats?: LabProfile['stats']
    workNote?: string
    skills?: LabProfile['skills']
    /** Alineada por posición con `timeline`. */
    timeline?: { when: string; title: string; org: string }[]
    contact?: { title: string; body: string }
  }
}
