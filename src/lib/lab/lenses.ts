import type { Lens } from '../../types'

/** Orden fijo en el panel: del campo al producto. */
export const LENS_ORDER: Lens[] = ['topography', 'gis', 'software']

export type LensDefinition = {
  label: string
  color: string
  description: string
  /** Capas base que la lente añade, tal como se listan en el panel. */
  baseLayers: string[]
}

/**
 * Cada perfil toma uno de los tres acentos de jenestiven.github.io, así la
 * paleta del sitio publicado se convierte en la leyenda del mapa.
 */
export const LENSES: Record<Lens, LensDefinition> = {
  topography: {
    label: 'Topographer',
    color: '#f2c14e',
    description: 'Measure the ground: 3D relief, contours, graticule and elevation profiles.',
    baseLayers: ['3D relief + hillshade · Terrain-DEM v1', 'Contours · Mapbox Terrain v2', 'Graticule · every 1′', 'Career traverse · stations'],
  },
  gis: {
    label: 'GIS Developer',
    color: '#4ee3b0',
    description: 'Analyse it: satellite imagery, classification and study areas.',
    baseLayers: ['Satellite imagery · Mapbox'],
  },
  software: {
    label: 'Software Developer',
    color: '#5aa9ff',
    description: 'Build on it: tile boundaries, live telemetry, inspector and style editor.',
    baseLayers: ['Live map telemetry', 'Feature inspector + style editor'],
  },
}

/** Rampa de 5 clases de productividad, la misma del mapa de jenestiven.github.io. */
export const LOT_CLASS_COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#7fc97f', '#1b7f4b']
