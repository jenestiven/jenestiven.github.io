import mapboxgl from 'mapbox-gl'
import type { Position } from './syntheticGeometry'

/*
 * Lector propio de Mapbox Terrain-DEM v1 (teselas Terrain-RGB).
 *
 * No se usa `map.queryTerrainElevation`: depende de que el terreno 3D esté
 * activo, y Mapbox lo desactiva en navegadores con protección contra
 * fingerprinting (Brave, modo privado), porque ahí leer píxeles desde un
 * canvas devuelve ruido. Aquí el PNG se decodifica a mano (inflate + filtros
 * de línea), sin canvas, así la cota sale igual en cualquier navegador y no
 * depende de lo que el mapa tenga cargado en pantalla.
 */

const TILESET = 'mapbox.mapbox-terrain-dem-v1'
/** Máximo detalle del tileset: ~9,5 m por píxel en el ecuador con teselas de 256 px. */
const MAX_ZOOM = 14
const MIN_ZOOM = 6
/** Zoom de la cota bajo el cursor: más grueso, pero con muy pocas teselas. */
const CURSOR_ZOOM = 12

type DemTile = {
  /** Lado de la tesela sin el borde. */
  size: number
  /** Píxeles de borde por lado (0 o 1, según cómo sirva Mapbox la tesela). */
  buffer: number
  channels: number
  stride: number
  data: Uint8Array
}

const tiles = new Map<string, DemTile>()
const pending = new Map<string, Promise<DemTile>>()
const failed = new Set<string>()

type Png = { width: number; height: number; channels: number; data: Uint8Array }

/** Decodifica un PNG RGB/RGBA de 8 bits sin entrelazado (lo que devuelve `.pngraw`). */
async function decodePng(buffer: ArrayBuffer): Promise<Png> {
  const view = new DataView(buffer)
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat: Uint8Array<ArrayBuffer>[] = []

  // 8 bytes de firma y luego chunks: longitud (4) + tipo (4) + datos + CRC (4).
  for (let offset = 8; offset < buffer.byteLength; ) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...new Uint8Array(buffer, offset + 4, 4))
    const start = offset + 8
    if (type === 'IHDR') {
      width = view.getUint32(start)
      height = view.getUint32(start + 4)
      bitDepth = view.getUint8(start + 8)
      colorType = view.getUint8(start + 9)
      interlace = view.getUint8(start + 12)
    } else if (type === 'IDAT') {
      idat.push(new Uint8Array(buffer, start, length))
    } else if (type === 'IEND') {
      break
    }
    offset = start + length + 4
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`Formato PNG no soportado (profundidad ${bitDepth}, tipo ${colorType})`)
  }
  const channels = colorType === 2 ? 3 : 4

  // Los IDAT concatenados son un flujo zlib.
  const stream = new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))
  const inflated = new Uint8Array(await new Response(stream).arrayBuffer())

  // Cada línea llega con un byte de filtro delante; se deshace contra el
  // píxel de la izquierda (a), el de arriba (b) y el de arriba-izquierda (c).
  const stride = width * channels
  const data = new Uint8Array(stride * height)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = inflated[p++]
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const raw = inflated[p++]
      const a = x >= channels ? data[row + x - channels] : 0
      const b = y > 0 ? data[row - stride + x] : 0
      const c = x >= channels && y > 0 ? data[row - stride + x - channels] : 0
      let value = raw
      if (filter === 1) value = raw + a
      else if (filter === 2) value = raw + b
      else if (filter === 3) value = raw + ((a + b) >> 1)
      else if (filter === 4) {
        const estimate = a + b - c
        const da = Math.abs(estimate - a)
        const db = Math.abs(estimate - b)
        const dc = Math.abs(estimate - c)
        value = raw + (da <= db && da <= dc ? a : db <= dc ? b : c)
      }
      data[row + x] = value & 255
    }
  }
  return { width, height, channels, data }
}

function loadTile(z: number, x: number, y: number): Promise<DemTile> {
  const key = `${z}/${x}/${y}`
  const ready = tiles.get(key)
  if (ready) return Promise.resolve(ready)

  let request = pending.get(key)
  if (!request) {
    request = fetch(`https://api.mapbox.com/v4/${TILESET}/${key}.pngraw?access_token=${mapboxgl.accessToken}`)
      .then((response) => {
        if (!response.ok) throw new Error(`DEM ${key}: HTTP ${response.status}`)
        return response.arrayBuffer()
      })
      .then(decodePng)
      .then((png) => {
        // 256/512 px: sin borde. 258/514 px: 1 px de borde por lado.
        const buffer = (png.width & (png.width - 1)) === 0 ? 0 : 1
        const tile: DemTile = {
          size: png.width - buffer * 2,
          buffer,
          channels: png.channels,
          stride: png.width * png.channels,
          data: png.data,
        }
        tiles.set(key, tile)
        return tile
      })
      .finally(() => pending.delete(key))
    pending.set(key, request)
  }
  return request
}

/** Coordenadas de tesela fraccionarias (Web Mercator). */
function tileCoords(lng: number, lat: number, z: number) {
  const n = 2 ** z
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * n,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n,
  }
}

/** Cota en metros con interpolación bilineal; fx y fy van de 0 a 1 dentro de la tesela. */
function tileElevation(tile: DemTile, fx: number, fy: number) {
  const px = fx * tile.size - 0.5
  const py = fy * tile.size - 0.5
  const x0 = Math.floor(px)
  const y0 = Math.floor(py)
  const tx = px - x0
  const ty = py - y0
  const limit = tile.size - 1 + tile.buffer
  const at = (x: number, y: number) => {
    const cx = Math.min(Math.max(x, -tile.buffer), limit) + tile.buffer
    const cy = Math.min(Math.max(y, -tile.buffer), limit) + tile.buffer
    const i = cy * tile.stride + cx * tile.channels
    // Terrain-RGB: décimas de metro desde −10 000 m.
    return -10000 + (tile.data[i] * 65536 + tile.data[i + 1] * 256 + tile.data[i + 2]) * 0.1
  }
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
  return top * (1 - ty) + bottom * ty
}

/**
 * Cotas de una lista de puntos. Baja el zoom hasta que los puntos caigan en
 * pocas teselas: una línea de 2 km se lee a z14, una de 80 km a un zoom menor.
 */
export async function sampleElevations(points: Position[], maxTiles = 9) {
  const keyAt = ([lng, lat]: Position, z: number) => {
    const { x, y } = tileCoords(lng, lat, z)
    return `${z}/${Math.floor(x)}/${Math.floor(y)}`
  }

  let zoom = MAX_ZOOM
  let keys = new Set(points.map((point) => keyAt(point, zoom)))
  while (keys.size > maxTiles && zoom > MIN_ZOOM) {
    zoom--
    keys = new Set(points.map((point) => keyAt(point, zoom)))
  }

  await Promise.all(
    [...keys].map((key) => {
      const [z, x, y] = key.split('/').map(Number)
      return loadTile(z, x, y)
    })
  )

  const elevations = points.map(([lng, lat]) => {
    const { x, y } = tileCoords(lng, lat, zoom)
    const tile = tiles.get(`${zoom}/${Math.floor(x)}/${Math.floor(y)}`) as DemTile
    return tileElevation(tile, x - Math.floor(x), y - Math.floor(y))
  })
  return { elevations, zoom }
}

/**
 * Cota bajo el cursor, síncrona: responde desde la caché y, si la tesela no
 * está, la pide y devuelve null hasta que llegue.
 */
export function elevationAt(lng: number, lat: number): number | null {
  const { x, y } = tileCoords(lng, lat, CURSOR_ZOOM)
  const tx = Math.floor(x)
  const ty = Math.floor(y)
  const key = `${CURSOR_ZOOM}/${tx}/${ty}`
  const tile = tiles.get(key)
  if (tile) return tileElevation(tile, x - tx, y - ty)
  if (!failed.has(key)) loadTile(CURSOR_ZOOM, tx, ty).catch(() => failed.add(key))
  return null
}
