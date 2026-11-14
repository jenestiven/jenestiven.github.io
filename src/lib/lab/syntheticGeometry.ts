import type { LabProject, TimelineEntry } from '../../types'

/*
 * Geometría ilustrativa para las capas de /lab. Es determinista (semilla = id
 * del proyecto) para que el mapa sea igual en cada visita, y nunca proviene de
 * datos de clientes: la UI lo declara en cada capa.
 */

export type Position = [number, number]

export type LabGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'Polygon'; coordinates: Position[][] }

export type LabFeature = {
  type: 'Feature'
  properties: Record<string, string | number>
  geometry: LabGeometry
}

export type LabFeatureCollection = { type: 'FeatureCollection'; features: LabFeature[] }

export type ProjectData = {
  data: LabFeatureCollection
  /** Cortes de Jenks (min, límites superiores…) cuando la capa es de lotes. */
  breaks?: number[]
}

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let s = h >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d

/**
 * Cortes naturales de Jenks (Fisher–Jenks). Devuelve k + 1 valores: el mínimo
 * y el límite superior de cada clase.
 */
export function jenksBreaks(values: number[], k: number): number[] {
  const data = [...values].sort((a, b) => a - b)
  const n = data.length
  if (n <= k) return [data[0], ...data]

  const lower = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0))
  const variance = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0))
  for (let j = 1; j <= k; j++) {
    lower[1][j] = 1
    for (let i = 2; i <= n; i++) variance[i][j] = Infinity
  }

  for (let l = 2; l <= n; l++) {
    let sum = 0
    let sumSq = 0
    let w = 0
    let v = 0
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1
      const value = data[i3 - 1]
      sumSq += value * value
      sum += value
      w++
      v = sumSq - (sum * sum) / w
      const i4 = i3 - 1
      if (i4 !== 0) {
        for (let j = 2; j <= k; j++) {
          if (variance[l][j] >= v + variance[i4][j - 1]) {
            lower[l][j] = i3
            variance[l][j] = v + variance[i4][j - 1]
          }
        }
      }
    }
    lower[l][1] = 1
    variance[l][1] = v
  }

  const breaks = new Array<number>(k + 1).fill(0)
  breaks[0] = data[0]
  breaks[k] = data[n - 1]
  let count = n
  for (let j = k; j >= 2; j--) {
    const id = lower[count][j] - 2
    breaks[j - 1] = data[id]
    count = lower[count][j] - 1
  }
  return breaks
}

function classOf(value: number, breaks: number[]) {
  for (let j = 1; j < breaks.length; j++) if (value <= breaks[j]) return j
  return breaks.length - 1
}

function lots(project: LabProject, rnd: () => number): ProjectData {
  const [lng0, lat0] = project.layer.anchor
  const cols = 7
  const rows = 9
  const w = 0.0042
  const h = 0.0052
  const gap = 0.0006
  const startLng = lng0 - (cols * (w + gap)) / 2
  const startLat = lat0 - (rows * (h + gap)) / 2
  const features: LabFeature[] = []
  let n = 1

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rnd() < 0.08) continue
      const lng = startLng + c * (w + gap) + r * 0.00035
      const lat = startLat + r * (h + gap)
      const skew = 0.0004
      const ring: Position[] = [
        [lng, lat],
        [lng + w, lat + skew * 0.2],
        [lng + w + skew, lat + h],
        [lng + skew, lat + h],
        [lng, lat],
      ].map(([x, y]) => [round(x), round(y)])
      const wave = (Math.sin(c * 0.55 + 0.4) + Math.cos(r * 0.6 - 1) + 2) / 4
      features.push({
        type: 'Feature',
        properties: {
          projectId: project.id,
          lot: `L-${String(n++).padStart(2, '0')}`,
          tch: Math.round(82 + 62 * wave + rnd() * 12),
          ha: Number((8 + rnd() * 7).toFixed(1)),
        },
        geometry: { type: 'Polygon', coordinates: [ring] },
      })
    }
  }

  const breaks = jenksBreaks(
    features.map((f) => Number(f.properties.tch)),
    5
  )
  features.forEach((f) => {
    f.properties.jenksClass = classOf(Number(f.properties.tch), breaks)
  })
  return { data: { type: 'FeatureCollection', features }, breaks }
}

function points(project: LabProject, rnd: () => number): ProjectData {
  const [lng0, lat0] = project.layer.anchor
  const features: LabFeature[] = Array.from({ length: 24 }, (_, i) => {
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd()) * 0.03
    return {
      type: 'Feature',
      properties: {
        projectId: project.id,
        site: `JOB-${400 + i}`,
        status: rnd() < 0.38 ? 'active' : 'closed',
      },
      geometry: {
        type: 'Point',
        coordinates: [round(lng0 + Math.cos(a) * d), round(lat0 + Math.sin(a) * d * 0.9)],
      },
    }
  })
  return { data: { type: 'FeatureCollection', features } }
}

function routes(project: LabProject, rnd: () => number): ProjectData {
  const [lng0, lat0] = project.layer.anchor
  const headings = [-0.5, 1.3, 2.7]
  const features: LabFeature[] = headings.map((heading, k) => {
    let lng = lng0
    let lat = lat0
    const coords: Position[] = [[round(lng), round(lat)]]
    for (let s = 0; s < 9; s++) {
      const a = heading + (rnd() - 0.5) * 1.1
      lng += Math.cos(a) * 0.0055
      lat += Math.sin(a) * 0.0055
      coords.push([round(lng), round(lat)])
    }
    return {
      type: 'Feature',
      properties: { projectId: project.id, crew: `Crew ${'ABC'[k]}`, stops: 9 },
      geometry: { type: 'LineString', coordinates: coords },
    }
  })
  return { data: { type: 'FeatureCollection', features } }
}

function graduated(project: LabProject, rnd: () => number): ProjectData {
  const [lng0, lat0] = project.layer.anchor
  const features: LabFeature[] = Array.from({ length: 4 }, (_, i) => ({
    type: 'Feature',
    properties: { projectId: project.id, branch: `Branch ${i + 1}`, salesPerMonth: Math.round(150 + rnd() * 500) },
    geometry: {
      type: 'Point',
      coordinates: [round(lng0 + (rnd() - 0.5) * 0.06), round(lat0 + (rnd() - 0.5) * 0.06)],
    },
  }))
  return { data: { type: 'FeatureCollection', features } }
}

function studyArea(project: LabProject, rnd: () => number): ProjectData {
  const [lng0, lat0] = project.layer.anchor
  const ring: Position[] = []
  const steps = 28
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const r = 0.0125 * (0.82 + rnd() * 0.36)
    ring.push([round(lng0 + Math.cos(a) * r * 1.1), round(lat0 + Math.sin(a) * r)])
  }
  ring.push(ring[0])
  return {
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { projectId: project.id, area: 'Siloé hillside (approx.)', status: 'research in progress' },
          geometry: { type: 'Polygon', coordinates: [ring] },
        },
      ],
    },
  }
}

export function buildProjectData(project: LabProject): ProjectData {
  const rnd = seededRandom(project.id)
  switch (project.layer.kind) {
    case 'lots':
      return lots(project, rnd)
    case 'points':
      return points(project, rnd)
    case 'routes':
      return routes(project, rnd)
    case 'graduated':
      return graduated(project, rnd)
    case 'study-area':
      return studyArea(project, rnd)
  }
}

/** Poligonal abierta E1…En con las estaciones de la trayectoria. */
export function buildTraverse(timeline: TimelineEntry[]): LabFeatureCollection {
  const stations = timeline
    .filter((t): t is TimelineEntry & { code: string; station: [number, number] } => !!t.code && !!t.station)
    .sort((a, b) => Number(a.code.slice(1)) - Number(b.code.slice(1)))

  const features: LabFeature[] = stations.map((s) => ({
    type: 'Feature',
    properties: { code: s.code, label: `${s.code} · ${s.when.split(' – ')[0]}`, title: s.title, org: s.org },
    geometry: { type: 'Point', coordinates: s.station },
  }))
  if (stations.length > 1) {
    features.unshift({
      type: 'Feature',
      properties: { kind: 'traverse' },
      geometry: { type: 'LineString', coordinates: stations.map((s) => s.station) },
    })
  }
  return { type: 'FeatureCollection', features }
}

const dms = (v: number, pos: string, neg: string) => {
  const a = Math.abs(v)
  const d = Math.floor(a + 1e-9)
  const m = Math.round((a - d) * 60)
  return `${d}°${String(m).padStart(2, '0')}′ ${v >= 0 ? pos : neg}`
}

/** Gratícula cada 1′ sobre el valle de Cali. */
export function buildGraticule(bbox: [number, number, number, number]): LabFeatureCollection {
  const [w, s, e, n] = bbox
  const step = 1 / 60
  const features: LabFeature[] = []
  for (let lng = Math.ceil(w / step) * step; lng <= e; lng += step) {
    features.push({
      type: 'Feature',
      properties: { label: dms(lng, 'E', 'W') },
      geometry: { type: 'LineString', coordinates: [[round(lng), s], [round(lng), n]] },
    })
  }
  for (let lat = Math.ceil(s / step) * step; lat <= n; lat += step) {
    features.push({
      type: 'Feature',
      properties: { label: dms(lat, 'N', 'S') },
      geometry: { type: 'LineString', coordinates: [[w, round(lat)], [e, round(lat)]] },
    })
  }
  return { type: 'FeatureCollection', features }
}

export function bboxOf(fc: LabFeatureCollection): [[number, number], [number, number]] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const visit = ([x, y]: Position) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  fc.features.forEach(({ geometry: g }) => {
    if (g.type === 'Point') visit(g.coordinates)
    else if (g.type === 'LineString') g.coordinates.forEach(visit)
    else g.coordinates.forEach((ring) => ring.forEach(visit))
  })
  return [
    [minX, minY],
    [maxX, maxY],
  ]
}
