/**
 * Campos comunes a los proyectos de experiencia laboral (Londres y Tokio).
 * Es el equivalente a una tarjeta de experiencia de LinkedIn: cargo, empresa,
 * ubicación y el material de apoyo (video y/o carrusel de imágenes).
 */
export type WorkDetailBase = {
  /** Cargo desempeñado, ej. "Desarrollador Full-Stack". */
  role: string
  company: string
  companyLocation: string
  description: string
  /** Carrusel de imágenes. La primera se usa como preview en el popup. */
  images?: string[]
  /** Video de demo. Tiene prioridad sobre el carrusel si ambos existen. */
  videoUrl?: string
  socialLinks?: {
    linkedin?: string
    github?: string
    website?: string
  }
  /** Link a la demo desplegada, si existe. */
  demoUrl?: string
}

export type SoftwareDetail = WorkDetailBase & {
  kind: 'software'
  stack: string[]
}

export type GeospatialDetail = WorkDetailBase & {
  kind: 'geospatial'
  /** Ruta a diagrama de metodología (SVG/PNG) */
  diagramAsset: string
  methodologyText: string
  /** Solo para casos no confidenciales (ej. tesis Siloé) */
  liveLayer?: {
    sourceUrl: string
    layerType: 'raster' | 'vector'
  }
}

export type ProfileDetail = {
  kind: 'profile'
  subtype: 'education' | 'about' | 'interests' | 'skills'
  /** Imagen de la vista previa del popup y del panel. */
  previewImage: string
  title: string
  /** Contenido del panel completo. */
  body: string
  /** Solo para subtype 'skills': badges de tecnologías. */
  skills?: string[]
}

export type ProjectDetail = SoftwareDetail | GeospatialDetail | ProfileDetail

/** Los dos kinds que comparten `WorkDetailBase`. */
export type WorkDetail = SoftwareDetail | GeospatialDetail

export type Marker = {
  id: string
  coord: [number, number]
  title: string
  type: 'software' | 'geospatial' | 'profile'
  detail: ProjectDetail
}

export type Scene = {
  id: string
  title: string
  /** Nombre corto de la ciudad, para el menú del tour. Cae a `title` si falta. */
  section?: string
  city?: string
  description: string
  camera: {
    center: [number, number]
    zoom: number
    pitch: number
    bearing: number
  }
  duration?: number
  /** Radio en km alrededor de camera.center para la detección de escena activa. */
  radiusKm: number
  markers: Marker[]
}

/* -------------------------------------------------------------------------- */
/* /lab — tres lentes (addendum v8)                                           */
/* -------------------------------------------------------------------------- */

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
  layer: {
    kind: LabLayerKind
    /** Centro aproximado de la geometría ilustrativa [lng, lat]. */
    anchor: [number, number]
    /** Nota visible sobre qué representa la geometría. */
    note: string
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
}
