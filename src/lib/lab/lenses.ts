import type { Lens } from '../../types'

/** Orden fijo en el panel: del campo al producto. */
export const LENS_ORDER: Lens[] = ['topography', 'gis', 'software']

/**
 * Cada perfil toma uno de los tres acentos de jenestiven.github.io, así la
 * paleta del sitio publicado se convierte en la leyenda del mapa. Los textos
 * de cada lente viven en `i18n.ts`.
 */
export const LENSES: Record<Lens, { color: string }> = {
  topography: { color: '#f2c14e' },
  gis: { color: '#4ee3b0' },
  software: { color: '#5aa9ff' },
}

/** Rampa de 5 clases de productividad, la misma del mapa de jenestiven.github.io. */
export const LOT_CLASS_COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#7fc97f', '#1b7f4b']
