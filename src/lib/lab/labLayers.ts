import type { LayerSpecification, Map } from 'mapbox-gl'
import type { LabLayerKind, LabProject, Lens, TimelineEntry } from '../../types'
import { LENSES, LENS_ORDER, LOT_CLASS_COLORS } from './lenses'
import { buildGraticule, buildTraverse, type ProjectData } from './syntheticGeometry'

/** Estilo de la capa principal de un proyecto: es lo que muestra y edita el editor `</>`. */
export type LayerStyle = {
  type: 'fill-extrusion' | 'circle' | 'line' | 'fill'
  paint: Record<string, unknown>
}

const BG = '#0b0f0e'
const MUTED = '#93a39e'
/** Pila de fuentes de los glyphs de Mapbox disponible en Standard. */
const TEXT_FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular']
/** Extensión de la gratícula: el valle de Cali y su ladera occidental. */
const GRATICULE_BBOX: [number, number, number, number] = [-76.62, 3.33, -76.4, 3.52]

export const mainLayerId = (projectId: string) => `lab-proj-${projectId}`

export function defaultStyle(kind: LabLayerKind, lens: Lens): LayerStyle {
  const color = LENSES[lens].color
  switch (kind) {
    case 'lots':
      return {
        type: 'fill-extrusion',
        paint: {
          'fill-extrusion-color': [
            'match', ['get', 'jenksClass'],
            1, LOT_CLASS_COLORS[0], 2, LOT_CLASS_COLORS[1], 3, LOT_CLASS_COLORS[2],
            4, LOT_CLASS_COLORS[3], 5, LOT_CLASS_COLORS[4], MUTED,
          ],
          'fill-extrusion-height': ['interpolate', ['linear'], ['get', 'tch'], 80, 20, 150, 240],
          'fill-extrusion-opacity': 0.88,
        },
      }
    case 'points':
      return {
        type: 'circle',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 15, 8],
          'circle-color': ['match', ['get', 'status'], 'active', color, MUTED],
          'circle-stroke-color': BG,
          'circle-stroke-width': 1.2,
        },
      }
    case 'routes':
      return {
        type: 'line',
        paint: { 'line-color': color, 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
      }
    case 'graduated':
      return {
        type: 'circle',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'salesPerMonth'], 150, 9, 650, 28],
          'circle-color': color,
          'circle-opacity': 0.35,
          'circle-stroke-color': color,
          'circle-stroke-width': 1.5,
        },
      }
    case 'study-area':
      return {
        type: 'fill',
        paint: { 'fill-color': color, 'fill-opacity': 0.12 },
      }
  }
}

export type LabRegistry = {
  /** Capas base de cada lente (no incluye las de proyectos). */
  lensLayers: Record<Lens, string[]>
  /** Todas las capas de cada proyecto. */
  projectLayers: Record<string, string[]>
  /** Capas que responden al clic. */
  pickLayers: string[]
  projectByLayer: Record<string, string>
}

/** Propiedad de emisión por tipo de capa (la de symbol aplica al texto). */
const EMISSIVE: Record<string, string> = {
  line: 'line-emissive-strength',
  fill: 'fill-emissive-strength',
  'fill-extrusion': 'fill-extrusion-emissive-strength',
  circle: 'circle-emissive-strength',
  raster: 'raster-emissive-strength',
  hillshade: 'hillshade-emissive-strength',
  symbol: 'text-emissive-strength',
}

/**
 * Con `lightPreset: 'night'` Standard ilumina también las capas propias y las
 * deja casi negras. Emisión 1 = la capa se pinta con sus colores reales.
 */
const asLayer = (layer: Record<string, unknown>) => {
  const key = EMISSIVE[String(layer.type)]
  const paint = { ...((layer.paint as Record<string, unknown>) ?? {}) }
  if (key && !(key in paint)) paint[key] = 1
  return { ...layer, paint } as unknown as LayerSpecification
}

function addTopography(map: Map, timeline: TimelineEntry[]) {
  const amber = LENSES.topography.color
  map.addSource('lab-dem', {
    type: 'raster-dem',
    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
    tileSize: 512,
  })
  map.addLayer(
    asLayer({
      id: 'lab-topo-hillshade',
      type: 'hillshade',
      source: 'lab-dem',
      slot: 'bottom',
      paint: {
        'hillshade-exaggeration': 0.45,
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#3a3423',
        'hillshade-accent-color': '#1a201f',
      },
    })
  )

  map.addSource('lab-terrain', { type: 'vector', url: 'mapbox://mapbox.mapbox-terrain-v2' })
  const isIndex = ['match', ['get', 'index'], [5, 10], true, false]
  map.addLayer(
    asLayer({
      id: 'lab-topo-contours',
      type: 'line',
      source: 'lab-terrain',
      'source-layer': 'contour',
      slot: 'middle',
      paint: {
        'line-color': amber,
        'line-opacity': ['case', isIndex, 0.7, 0.28],
        'line-width': ['case', isIndex, 1.2, 0.6],
      },
    })
  )
  map.addLayer(
    asLayer({
      id: 'lab-topo-contour-labels',
      type: 'symbol',
      source: 'lab-terrain',
      'source-layer': 'contour',
      slot: 'middle',
      filter: isIndex,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'],
        'text-font': TEXT_FONT,
        'text-size': 10,
      },
      paint: { 'text-color': amber, 'text-halo-color': BG, 'text-halo-width': 1.2 },
    })
  )

  map.addSource('lab-graticule', { type: 'geojson', data: buildGraticule(GRATICULE_BBOX) })
  map.addLayer(
    asLayer({
      id: 'lab-topo-graticule',
      type: 'line',
      source: 'lab-graticule',
      slot: 'middle',
      paint: { 'line-color': amber, 'line-opacity': 0.3, 'line-width': 0.8, 'line-dasharray': [2, 4] },
    })
  )
  map.addLayer(
    asLayer({
      id: 'lab-topo-graticule-labels',
      type: 'symbol',
      source: 'lab-graticule',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 420,
        'text-field': ['get', 'label'],
        'text-font': TEXT_FONT,
        'text-size': 10,
      },
      paint: { 'text-color': amber, 'text-opacity': 0.75, 'text-halo-color': BG, 'text-halo-width': 1 },
    })
  )

  map.addSource('lab-traverse', { type: 'geojson', data: buildTraverse(timeline) })
  map.addLayer(
    asLayer({
      id: 'lab-topo-traverse-line',
      type: 'line',
      source: 'lab-traverse',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': amber, 'line-width': 1.8 },
    })
  )
  map.addLayer(
    asLayer({
      id: 'lab-topo-traverse-stations',
      type: 'circle',
      source: 'lab-traverse',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 6, 'circle-color': BG, 'circle-stroke-color': amber, 'circle-stroke-width': 2 },
    })
  )
  map.addLayer(
    asLayer({
      id: 'lab-topo-traverse-labels',
      type: 'symbol',
      source: 'lab-traverse',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': TEXT_FONT,
        'text-size': 11,
        'text-anchor': 'left',
        'text-offset': [0.9, -0.6],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': amber, 'text-halo-color': BG, 'text-halo-width': 1.4 },
    })
  )

  return [
    'lab-topo-hillshade',
    'lab-topo-contours',
    'lab-topo-contour-labels',
    'lab-topo-graticule',
    'lab-topo-graticule-labels',
    'lab-topo-traverse-line',
    'lab-topo-traverse-stations',
    'lab-topo-traverse-labels',
  ]
}

function addGis(map: Map) {
  map.addSource('lab-satellite', { type: 'raster', url: 'mapbox://mapbox.satellite', tileSize: 256 })
  map.addLayer(
    asLayer({
      id: 'lab-gis-satellite',
      type: 'raster',
      source: 'lab-satellite',
      slot: 'bottom',
      paint: { 'raster-opacity': 0.6, 'raster-saturation': -0.35, 'raster-brightness-max': 0.8 },
    })
  )
  return ['lab-gis-satellite']
}

function addProject(map: Map, project: LabProject, projectData: ProjectData) {
  const id = mainLayerId(project.id)
  const style = defaultStyle(project.layer.kind, project.lens)
  map.addSource(id, { type: 'geojson', data: projectData.data as never })
  map.addLayer(asLayer({ id, type: style.type, source: id, paint: style.paint }))

  const layers = [id]
  let pick = id

  if (project.layer.kind === 'lots') {
    // Las extrusiones sobre terreno no se consultan de forma fiable: el clic
    // se resuelve contra un fill invisible con la misma geometría.
    pick = `${id}-pick`
    map.addLayer(asLayer({ id: pick, type: 'fill', source: id, paint: { 'fill-opacity': 0 } }))
    layers.push(pick)
  }
  if (project.layer.kind === 'study-area') {
    map.addLayer(
      asLayer({
        id: `${id}-outline`,
        type: 'line',
        source: id,
        paint: { 'line-color': LENSES[project.lens].color, 'line-width': 2, 'line-dasharray': [3, 2] },
      })
    )
    layers.push(`${id}-outline`)
  }
  return { layers, pick }
}

export function addLabLayers(
  map: Map,
  projects: LabProject[],
  datasets: Record<string, ProjectData>,
  timeline: TimelineEntry[]
): LabRegistry {
  const registry: LabRegistry = {
    lensLayers: { topography: addTopography(map, timeline), gis: addGis(map), software: [] },
    projectLayers: {},
    pickLayers: [],
    projectByLayer: {},
  }
  projects.forEach((project) => {
    const { layers, pick } = addProject(map, project, datasets[project.id])
    registry.projectLayers[project.id] = layers
    registry.pickLayers.push(pick)
    layers.forEach((layerId) => (registry.projectByLayer[layerId] = project.id))
  })
  return registry
}

export function applyVisibility(
  map: Map,
  registry: LabRegistry,
  projects: LabProject[],
  lenses: Record<Lens, boolean>,
  hidden: Record<string, boolean>,
  tileBoundaries: boolean
) {
  const set = (layerId: string, visible: boolean) => {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  }
  LENS_ORDER.forEach((lens) => registry.lensLayers[lens].forEach((id) => set(id, lenses[lens])))
  projects.forEach((p) => {
    const visible = lenses[p.lens] && !hidden[p.id]
    registry.projectLayers[p.id]?.forEach((id) => set(id, visible))
  })
  // Opt-in: a pantalla completa las fronteras de teselas tapan todo lo demás.
  map.showTileBoundaries = lenses.software && tileBoundaries
}
