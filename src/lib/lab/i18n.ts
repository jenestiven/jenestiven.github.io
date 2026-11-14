import { createContext, useContext } from 'react'
import type { LabProfile, LabProject, Lens } from '../../types'

/*
 * Idiomas de la v2. Los textos de interfaz viven aquí; el contenido (perfil y
 * proyectos) vive en las Content Collections, en inglés, con un bloque `es`
 * opcional que `localizeProject` / `localizeProfile` superponen.
 */

export type Lang = 'en' | 'es'
export const LANGS: Lang[] = ['es', 'en']
export const LANG_STORAGE_KEY = 'portfolio-lang'

type LensText = { label: string; description: string; baseLayers: string[] }

const en = {
  photoAlt: (name: string) => `Photo of ${name}`,
  language: 'Language',
  mode: { label: 'View mode', explore: 'explore', read: 'read' },
  lenses: {
    topography: {
      label: 'Topographer',
      description: 'Measure the ground: 3D relief, contours, graticule and elevation profiles.',
      baseLayers: ['3D relief + hillshade · Terrain-DEM v1', 'Contours · Mapbox Terrain v2', 'Graticule · every 1′', 'Career traverse · stations'],
    },
    gis: {
      label: 'GIS Developer',
      description: 'Analyse it: satellite imagery, classification and study areas.',
      baseLayers: ['Satellite imagery · Mapbox'],
    },
    software: {
      label: 'Software Developer',
      description: 'Build on it: tile boundaries, live telemetry, inspector and style editor.',
      baseLayers: ['Live map telemetry', 'Feature inspector + style editor'],
    },
  } as Record<Lens, LensText>,
  intro: {
    tagline: 'One map, three lenses: the ground, the data and the software built on top of them.',
    explore: 'Explore the map',
    loading: 'Loading map…',
    read: 'Read the portfolio',
    descending: 'Descending to Cali, Colombia',
    lensOf: (i: number, n: number) => `Lens ${i} of ${n}`,
  },
  identity: { email: 'Email me' },
  layers: {
    eyebrow: '// layers',
    title: 'Three lenses, one map',
    all: 'all at once',
    close: 'Close layers',
    open: 'Layers · 3 lenses',
    show: (title: string) => `Show ${title}`,
    profileOpen: 'Cut an elevation profile',
    profileClose: 'Close elevation profile',
    tool: 'tool',
    status: { production: 'in production', delivered: 'delivered', 'in-progress': 'in progress' },
    note: 'Project geometries are synthetic and illustrative. Client data stays private.',
    v1: 'v1 · the guided-tour version →',
  },
  inspector: {
    close: 'Close inspector',
    lensLine: (label: string) => `${label} lens`,
    inProgress: 'in progress',
    expand: 'Project details and layer style ↑',
    collapse: 'Hide details ↓',
    tabAttributes: 'Attribute table',
    tabStyle: '</> Layer style',
    aboutLayer: 'About this layer',
    jenks: 'Jenks breaks (TCH)',
    styleHint: 'Mapbox style expression for this layer. Edit it and the map updates live.',
    styleLabel: 'Layer style JSON',
    valid: 'Valid style',
    applied: 'Applied with setPaintProperty()',
    restored: 'Style restored',
    invalidJson: 'Invalid JSON',
    typeLocked: (type: string) => `This layer is a "${type}" layer; its type can't change here.`,
    missingPaint: 'Missing "paint" object.',
    reset: 'Reset',
  },
  profile: {
    title: 'Elevation profile',
    view: 'View',
    chart: 'Chart',
    table: 'Table',
    undo: 'Undo point',
    stop: 'Stop drawing',
    add: 'Add points',
    close: 'Close elevation profile',
    error: "Couldn't load the elevation data. Check your connection and try again.",
    retry: 'Retry',
    reading: 'Reading Mapbox Terrain-DEM…',
    onePoint: 'Start point set. Click a second point to cut the profile.',
    empty: 'Click two or more points on the map to cut a terrain profile along that line.',
    length: 'Length',
    lowest: 'Lowest',
    highest: 'Highest',
    ascent: 'Ascent',
    descent: 'Descent',
    avgGrade: 'Avg. grade',
    source: (zoom: number, samples: number, spacing: string) =>
      `Mapbox Terrain-DEM v1 · zoom ${zoom} · ${samples} samples, one every ${spacing} m`,
    axis: 'Elevation (m)',
    exaggeration: 'Vertical exaggeration',
    chartLabel: 'Elevation profile chart. Use the arrow keys to read the elevation along the line.',
    grade: 'grade',
    station: 'Station',
    elevation: 'Elevation',
    gradeHeader: 'Grade',
  },
  hud: { cursorHint: 'WGS84 · move the cursor over the map', loadingMap: 'loading map…' },
  read: {
    nav: { work: 'Work', skills: 'Skills', path: 'Experience', contact: 'Contact' },
    explore: 'Explore the map',
    seeWork: 'See my work',
    email: 'Email me',
    mapAlt: 'Illustrative productivity map of agricultural lots',
    jenks: 'Jenks · 5 classes',
    mapCaption: 'Illustration of the kind of map my pipeline produces (not real data)',
    workEyebrow: '// selected work',
    workTitle: 'Featured projects',
    researchEyebrow: '// research in progress',
    otherEyebrow: '// other projects',
    skillsEyebrow: '// toolbox',
    skillsTitle: 'What I work with',
    skillsSub: 'I can work across the whole path from raw field data to a finished product.',
    pathEyebrow: '// path',
    pathTitle: 'Experience & education',
    traverse: 'Walk it as a survey traverse →',
    contactEyebrow: "// let's talk",
    viewOnMap: 'View on the map →',
    inProgress: 'in progress',
    v1: 'Previous version (v1)',
  },
}

export type Strings = typeof en

const es: Strings = {
  photoAlt: (name) => `Foto de ${name}`,
  language: 'Idioma',
  mode: { label: 'Modo de vista', explore: 'explorar', read: 'leer' },
  lenses: {
    topography: {
      label: 'Topógrafo',
      description: 'Medir el terreno: relieve 3D, curvas de nivel, gratícula y perfiles de elevación.',
      baseLayers: ['Relieve 3D + sombreado · Terrain-DEM v1', 'Curvas de nivel · Mapbox Terrain v2', 'Gratícula · cada 1′', 'Poligonal de trayectoria · estaciones'],
    },
    gis: {
      label: 'Desarrollador GIS',
      description: 'Analizarlo: imágenes satelitales, clasificación y zonas de estudio.',
      baseLayers: ['Imagen satelital · Mapbox'],
    },
    software: {
      label: 'Desarrollador de software',
      description: 'Construir encima: límites de teselas, telemetría en vivo, inspector y editor de estilos.',
      baseLayers: ['Telemetría del mapa en vivo', 'Inspector de elementos + editor de estilo'],
    },
  },
  intro: {
    tagline: 'Un mapa, tres lentes: el terreno, los datos y el software que se construye sobre ellos.',
    explore: 'Explorar el mapa',
    loading: 'Cargando el mapa…',
    read: 'Leer el portafolio',
    descending: 'Descendiendo a Cali, Colombia',
    lensOf: (i, n) => `Lente ${i} de ${n}`,
  },
  identity: { email: 'Escríbeme' },
  layers: {
    eyebrow: '// capas',
    title: 'Tres lentes, un mapa',
    all: 'todas a la vez',
    close: 'Cerrar capas',
    open: 'Capas · 3 lentes',
    show: (title) => `Mostrar ${title}`,
    profileOpen: 'Trazar un perfil de elevación',
    profileClose: 'Cerrar el perfil de elevación',
    tool: 'herramienta',
    status: { production: 'en producción', delivered: 'entregado', 'in-progress': 'en curso' },
    note: 'Las geometrías de los proyectos son sintéticas e ilustrativas. Los datos de los clientes son privados.',
    v1: 'v1 · la versión de tour guiado →',
  },
  inspector: {
    close: 'Cerrar el inspector',
    lensLine: (label) => `Lente ${label}`,
    inProgress: 'en curso',
    expand: 'Detalles del proyecto y estilo de capa ↑',
    collapse: 'Ocultar detalles ↓',
    tabAttributes: 'Tabla de atributos',
    tabStyle: '</> Estilo de capa',
    aboutLayer: 'Sobre esta capa',
    jenks: 'Cortes de Jenks (TCH)',
    styleHint: 'Expresión de estilo de Mapbox para esta capa. Edítala y el mapa se actualiza al instante.',
    styleLabel: 'JSON del estilo de la capa',
    valid: 'Estilo válido',
    applied: 'Aplicado con setPaintProperty()',
    restored: 'Estilo restaurado',
    invalidJson: 'JSON inválido',
    typeLocked: (type) => `Esta capa es de tipo "${type}"; aquí no se puede cambiar el tipo.`,
    missingPaint: 'Falta el objeto "paint".',
    reset: 'Restaurar',
  },
  profile: {
    title: 'Perfil de elevación',
    view: 'Vista',
    chart: 'Gráfica',
    table: 'Tabla',
    undo: 'Deshacer punto',
    stop: 'Dejar de dibujar',
    add: 'Añadir puntos',
    close: 'Cerrar el perfil de elevación',
    error: 'No se pudieron cargar los datos de elevación. Revisa la conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    reading: 'Leyendo Mapbox Terrain-DEM…',
    onePoint: 'Punto inicial fijado. Haz clic en un segundo punto para trazar el perfil.',
    empty: 'Haz clic en dos o más puntos del mapa para cortar un perfil del terreno a lo largo de esa línea.',
    length: 'Longitud',
    lowest: 'Cota mínima',
    highest: 'Cota máxima',
    ascent: 'Ascenso',
    descent: 'Descenso',
    avgGrade: 'Pend. media',
    source: (zoom, samples, spacing) => `Mapbox Terrain-DEM v1 · zoom ${zoom} · ${samples} muestras, una cada ${spacing} m`,
    axis: 'Cota (m)',
    exaggeration: 'Exageración vertical',
    chartLabel: 'Gráfica del perfil de elevación. Usa las flechas para leer la cota a lo largo de la línea.',
    grade: 'pendiente',
    station: 'Abscisa',
    elevation: 'Cota',
    gradeHeader: 'Pendiente',
  },
  hud: { cursorHint: 'WGS84 · mueve el cursor sobre el mapa', loadingMap: 'cargando el mapa…' },
  read: {
    nav: { work: 'Proyectos', skills: 'Herramientas', path: 'Experiencia', contact: 'Contacto' },
    explore: 'Explorar el mapa',
    seeWork: 'Ver mi trabajo',
    email: 'Escríbeme',
    mapAlt: 'Mapa ilustrativo de productividad de lotes agrícolas',
    jenks: 'Jenks · 5 clases',
    mapCaption: 'Ilustración del tipo de mapa que produce mi pipeline (no son datos reales)',
    workEyebrow: '// trabajo seleccionado',
    workTitle: 'Proyectos destacados',
    researchEyebrow: '// investigación en curso',
    otherEyebrow: '// otros proyectos',
    skillsEyebrow: '// herramientas',
    skillsTitle: 'Con qué trabajo',
    skillsSub: 'Puedo cubrir todo el camino, desde el dato crudo de campo hasta el producto terminado.',
    pathEyebrow: '// trayectoria',
    pathTitle: 'Experiencia y formación',
    traverse: 'Recorrerla como poligonal →',
    contactEyebrow: '// hablemos',
    viewOnMap: 'Ver en el mapa →',
    inProgress: 'en curso',
    v1: 'Versión anterior (v1)',
  },
}

export const STRINGS: Record<Lang, Strings> = { en, es }

export type LabI18n = { lang: Lang; t: Strings; setLang: (lang: Lang) => void }

export const LabI18nContext = createContext<LabI18n>({ lang: 'en', t: en, setLang: () => {} })
export const useI18n = () => useContext(LabI18nContext)

/** Idioma preferido: el guardado, o español si el navegador está en español. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    // Sin almacenamiento (modo privado): se decide por el idioma del navegador.
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function localizeProject(project: LabProject, lang: Lang): LabProject {
  if (lang === 'en' || !project.es) return project
  const { layerNote, ...text } = project.es
  return { ...project, ...text, layer: { ...project.layer, note: layerNote ?? project.layer.note } }
}

export function localizeProfile(profile: LabProfile, lang: Lang): LabProfile {
  if (lang === 'en' || !profile.es) return profile
  const { timeline, contact, ...text } = profile.es
  return {
    ...profile,
    ...text,
    // La trayectoria traducida va alineada por posición: conserva código y estación.
    timeline: profile.timeline.map((entry, i) => ({ ...entry, ...timeline?.[i] })),
    contact: { ...profile.contact, ...contact },
  }
}
