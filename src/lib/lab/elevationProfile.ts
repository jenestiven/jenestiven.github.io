import along from '@turf/along'
import { lineString } from '@turf/helpers'
import length from '@turf/length'
import type { GeoJSONSource, Map } from 'mapbox-gl'
import { sampleElevations } from './dem'
import { asLayer } from './labLayers'
import { LENSES } from './lenses'
import type { Position } from './syntheticGeometry'

/* Perfil de elevación de la lente Topógrafo: corte del terreno a lo largo de una línea. */

export type ProfileSample = {
  /** Distancia acumulada desde el inicio, en metros (la abscisa). */
  d: number
  /** Cota en metros. */
  ele: number
  /** Pendiente local en %, sobre la cota suavizada. */
  grade: number
  lng: number
  lat: number
}

export type Profile = {
  samples: ProfileSample[]
  /** Longitud horizontal de la línea, en metros. */
  length: number
  min: ProfileSample
  max: ProfileSample
  /** Desnivel acumulado positivo y negativo, en metros. */
  ascent: number
  descent: number
  /** Zoom del DEM con el que se leyeron las cotas. */
  demZoom: number
}

const SAMPLE_SPACING_M = 10
const MIN_SAMPLES = 60
const MAX_SAMPLES = 400
/** Ventana de la media móvil: quita el escalonado del DEM antes de sumar desniveles. */
const SMOOTH_WINDOW = 5

export async function buildProfile(vertices: Position[]): Promise<Profile | null> {
  if (vertices.length < 2) return null
  const line = lineString(vertices)
  const total = length(line, { units: 'kilometers' }) * 1000
  if (total < 5) return null

  const count = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.round(total / SAMPLE_SPACING_M)))
  const distances = Array.from({ length: count + 1 }, (_, i) => (total * i) / count)
  const points = distances.map((d) => along(line, d / 1000, { units: 'kilometers' }).geometry.coordinates as Position)
  const { elevations, zoom } = await sampleElevations(points)

  const half = Math.floor(SMOOTH_WINDOW / 2)
  const smooth = elevations.map((_, i) => {
    const from = Math.max(0, i - half)
    const to = Math.min(elevations.length - 1, i + half)
    let sum = 0
    for (let k = from; k <= to; k++) sum += elevations[k]
    return sum / (to - from + 1)
  })

  let ascent = 0
  let descent = 0
  for (let i = 1; i < smooth.length; i++) {
    const delta = smooth[i] - smooth[i - 1]
    if (delta > 0) ascent += delta
    else descent -= delta
  }

  const samples: ProfileSample[] = distances.map((d, i) => {
    const a = Math.max(0, i - 1)
    const b = Math.min(distances.length - 1, i + 1)
    return {
      d,
      ele: elevations[i],
      grade: ((smooth[b] - smooth[a]) / (distances[b] - distances[a])) * 100,
      lng: points[i][0],
      lat: points[i][1],
    }
  })

  let min = samples[0]
  let max = samples[0]
  for (const sample of samples) {
    if (sample.ele < min.ele) min = sample
    if (sample.ele > max.ele) max = sample
  }
  return { samples, length: total, min, max, ascent, descent, demZoom: zoom }
}

/* ---- Formato ---------------------------------------------------------------- */

/** Abscisa topográfica: K1+250 = a 1 250 m del origen. */
export function formatAbscisa(d: number) {
  const m = Math.round(d)
  return `K${Math.floor(m / 1000)}+${String(m % 1000).padStart(3, '0')}`
}

export const formatMeters = (v: number) => `${Math.round(v).toLocaleString('en-US')} m`

export const formatLength = (d: number) => (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(2)} km`)

export const formatGrade = (g: number) => `${g > 0.05 ? '+' : g < -0.05 ? '−' : ''}${Math.abs(g).toFixed(1)}%`

/** Paso "redondo" (1, 2, 2.5, 5 × 10ⁿ) igual o mayor que el pedido. */
export function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)))
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= raw) ?? 10 * power
}

/* ---- Capas en el mapa ------------------------------------------------------- */

const LINE_SOURCE = 'lab-profile'
const CURSOR_SOURCE = 'lab-profile-cursor'
const EMPTY = { type: 'FeatureCollection', features: [] }
const BG = '#0b0f0e'

/** False también si el mapa ya fue destruido (pasa al recargar en caliente en desarrollo). */
export function hasProfileLayers(map: Map) {
  try {
    return Boolean(map.getSource(LINE_SOURCE))
  } catch {
    return false
  }
}

function ensureProfileLayers(map: Map) {
  if (hasProfileLayers(map)) return
  const amber = LENSES.topography.color
  map.addSource(LINE_SOURCE, { type: 'geojson', data: EMPTY as never })
  map.addSource(CURSOR_SOURCE, { type: 'geojson', data: EMPTY as never })

  const isLine = ['==', ['geometry-type'], 'LineString']
  const isPoint = ['==', ['geometry-type'], 'Point']
  const round = { 'line-cap': 'round', 'line-join': 'round' }
  map.addLayer(
    asLayer({
      id: 'lab-profile-casing',
      type: 'line',
      source: LINE_SOURCE,
      filter: isLine,
      layout: round,
      paint: { 'line-color': BG, 'line-width': 6 },
    })
  )
  map.addLayer(
    asLayer({
      id: 'lab-profile-line',
      type: 'line',
      source: LINE_SOURCE,
      filter: isLine,
      layout: round,
      paint: { 'line-color': amber, 'line-width': 2.5 },
    })
  )
  map.addLayer(
    asLayer({
      id: 'lab-profile-vertices',
      type: 'circle',
      source: LINE_SOURCE,
      filter: isPoint,
      paint: { 'circle-radius': 4.5, 'circle-color': BG, 'circle-stroke-color': amber, 'circle-stroke-width': 2 },
    })
  )
  map.addLayer(
    asLayer({
      id: 'lab-profile-cursor',
      type: 'circle',
      source: CURSOR_SOURCE,
      paint: { 'circle-radius': 6, 'circle-color': amber, 'circle-stroke-color': BG, 'circle-stroke-width': 2 },
    })
  )
}

const pointFeature = (coordinates: Position) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Point', coordinates },
})

/** Dibuja la línea del perfil y sus vértices. Sin vértices, la borra. */
export function setProfileLine(map: Map, vertices: Position[]) {
  ensureProfileLayers(map)
  const features: unknown[] = vertices.map(pointFeature)
  if (vertices.length > 1) {
    features.unshift({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: vertices } })
  }
  ;(map.getSource(LINE_SOURCE) as GeoJSONSource).setData({ type: 'FeatureCollection', features } as never)
}

/** Punto que recorre la línea mientras se lee la gráfica. */
export function setProfileCursor(map: Map, position: Position | null) {
  if (!hasProfileLayers(map)) return
  ;(map.getSource(CURSOR_SOURCE) as GeoJSONSource).setData({
    type: 'FeatureCollection',
    features: position ? [pointFeature(position)] : [],
  } as never)
}
