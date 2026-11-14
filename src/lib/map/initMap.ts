import mapboxgl from 'mapbox-gl'
import type { FogSpecification, ProjectionSpecification } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.PUBLIC_MAPBOX_TOKEN

export type MapCamera = {
    center: [number, number]
    zoom: number
    pitch: number
    bearing: number
}

export type InitMapOptions = {
    camera: MapCamera
    projection?: ProjectionSpecification['name']
    /** Config de los imports de Standard, p. ej. `{ basemap: { lightPreset: 'night' } }`. */
    config?: Record<string, Record<string, string | boolean | number>>
    fog?: FogSpecification
    navigation?: boolean
}

/** Crea el único `mapboxgl.Map` de la sesión, sobre Mapbox Standard. */
export function initMap(containerId: string, options: InitMapOptions) {
    const { camera, projection = 'globe', config, fog, navigation = true } = options

    const map = new mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/standard',
        projection,
        ...(config ? { config } : {}),
        ...camera,
    })

    // El fog se pierde si el estilo se recarga, así que se reaplica en cada
    // 'style.load' en vez de una sola vez tras el 'load' inicial.
    if (fog) {
        map.on('style.load', () => {
            map.setFog(fog)
        })
    }

    if (navigation) map.addControl(new mapboxgl.NavigationControl())

    return map
}
