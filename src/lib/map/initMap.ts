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

/**
 * Cámara con la que abre el portafolio: el planeta visto de lejos, con
 * Colombia al centro y espacio alrededor para que el Hero respire encima.
 * El recorrido no arranca aquí — espera al clic del CTA (ver `startJourney`
 * en MapView).
 */
export const HERO_CAMERA: MapCamera = {
    center: [-76, 4],
    zoom: 3,
    pitch: 70,
    bearing: 0,
}

/**
 * Atmósfera del Hero. `star-intensity` es lo que dibuja el campo de estrellas
 * detrás del globo: Standard no lo trae encendido de fábrica, y por debajo de
 * ~0.4 el fondo se ve plano contra el negro del espacio.
 */
const HERO_FOG: FogSpecification = {
    'star-intensity': 0.55,
    'space-color': '#01030a',
    'horizon-blend': 0.02,
}

export type InitMapOptions = {
    camera?: MapCamera
    projection?: ProjectionSpecification['name']
    /** Config de los imports de Standard, p. ej. `{ basemap: { lightPreset: 'night' } }`. */
    config?: Record<string, Record<string, string | boolean | number>>
    /** `null` desactiva el fog. */
    fog?: FogSpecification | null
    navigation?: boolean
}

/**
 * Sin opciones abre el portafolio principal (globo + Hero). `/lab` pasa su
 * propia cámara, proyección y config de Standard.
 */
export function initMap(containerId: string, options: InitMapOptions = {}) {
    const {
        camera = HERO_CAMERA,
        projection = 'globe',
        config,
        fog = HERO_FOG,
        navigation = true,
    } = options

    // Mapbox Standard ya trae terreno 3D, edificios y landmarks de fábrica:
    // no se añaden DEM, curvas de nivel ni tráfico propios (esos tilesets
    // además no cubren el globo y devolvían 404 fuera de Colombia).
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
