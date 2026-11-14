import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FogSpecification, LngLatBoundsLike, Map, MapMouseEvent } from 'mapbox-gl'
import { initMap, type MapCamera } from '../../lib/map/initMap'
import { elevationAt } from '../../lib/lab/dem'
import { formatMeters } from '../../lib/lab/elevationProfile'
import { addLabLayers, applyVisibility, type LabRegistry } from '../../lib/lab/labLayers'
import { LENSES, LENS_ORDER } from '../../lib/lab/lenses'
import { bboxOf, buildProjectData, buildTraverse } from '../../lib/lab/syntheticGeometry'
import type { LabProfile, LabProject, Lens } from '../../types'
import IdentityCard from './IdentityCard'
import Inspector, { type PickedFeature } from './Inspector'
import IntroOverlay from './IntroOverlay'
import LayerPanel from './LayerPanel'
import ProfilePanel from './ProfilePanel'
import ReadView from './ReadView'
import TelemetryHud from './TelemetryHud'
import { useElevationProfile } from './useElevationProfile'

type Props = {
  profile: LabProfile
  projects: LabProject[]
}

type Mode = 'explore' | 'read'

/**
 * Etapas de la entrada. 'hero': portada sobre el globo, nada se mueve hasta
 * el CTA. 'flying': descenso a Cali. 'reveal': las lentes se encienden una a
 * una. 'done': el mapa es del usuario.
 */
type Intro = 'hero' | 'flying' | 'reveal' | 'done'

/** El valle de Cali con la ladera occidental a la vista. */
const LAB_CAMERA: MapCamera = { center: [-76.505, 3.425], zoom: 11.6, pitch: 50, bearing: -14 }

/** En una pantalla angosta el valle no cabe a ese zoom: se abre el encuadre. */
const landingCamera = (): MapCamera =>
  window.innerWidth < 768 ? { ...LAB_CAMERA, center: [-76.5, 3.432], zoom: 10.3, pitch: 36 } : LAB_CAMERA

/** Standard en noche + monocromo: el mapa base se apaga para que las lentes pongan el color. */
const LAB_BASEMAP = {
  basemap: {
    lightPreset: 'night',
    theme: 'monochrome',
    showPointOfInterestLabels: false,
    showTransitLabels: false,
  },
}

/**
 * Cámara de la portada: el planeta visto de lejos. El centro queda al norte de
 * Colombia a propósito — con este pitch el centro cae sobre el horizonte, así
 * Cali aparece ya dentro del disco, de cara al usuario.
 */
const INTRO_CAMERA: MapCamera = { center: [-76, 17], zoom: 2.9, pitch: 68, bearing: 0 }

/** Atmósfera en el menta del sitio; sin esto el limbo del globo sale blanco. */
const LAB_FOG: FogSpecification = {
  color: '#2f9e80',
  'high-color': '#0e3a30',
  'space-color': '#05090a',
  'star-intensity': 0.5,
  'horizon-blend': 0.05,
  range: [1, 12],
}

const ALL_LENSES: Record<Lens, boolean> = { topography: true, gis: true, software: true }
const NO_LENSES: Record<Lens, boolean> = { topography: false, gis: false, software: false }

/** Descenso desde el globo hasta Cali. */
const LANDING_FLY_MS = 6500
/** Pausa tras aterrizar y separación entre lentes durante la revelación. */
const REVEAL_DELAY_MS = 600
const REVEAL_STEP_MS = 1400

/** Deja libres los paneles al encuadrar una capa. */
function framePadding() {
  if (window.innerWidth < 768) {
    return { top: 150, bottom: 250, left: 24, right: 24 }
  }
  return { top: 90, bottom: 90, left: 410, right: 470 }
}

/** Por debajo de este zoom no se pide la cota bajo el cursor: serían demasiadas teselas. */
const CURSOR_ELEVATION_MIN_ZOOM = 9

/** True desde `md` (768 px): paneles laterales en vez de hojas inferiores. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return desktop
}

export default function LabView({ profile, projects }: Props) {
  const [map, setMap] = useState<Map | null>(null)
  const registryRef = useRef<LabRegistry | null>(null)
  const [intro, setIntro] = useState<Intro>('hero')
  const introRef = useRef<Intro>(intro)
  introRef.current = intro
  /** Lente que se acaba de encender durante la revelación (para el rótulo). */
  const [revealing, setRevealing] = useState<Lens | null>(null)
  const [lenses, setLenses] = useState<Record<Lens, boolean>>(NO_LENSES)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feature, setFeature] = useState<PickedFeature | null>(null)
  const [mode, setMode] = useState<Mode>('explore')
  const [layersOpen, setLayersOpen] = useState(false)
  const [tileBoundaries, setTileBoundaries] = useState(false)
  const [cursor, setCursor] = useState<{ lng: number; lat: number; ele: number | null } | null>(null)
  /** Proyecto pedido antes de que el mapa terminara de cargar (desde Leer o el hash). */
  const pendingRef = useRef<string | null>(null)
  const isDesktop = useIsDesktop()

  /** Herramienta de perfil de elevación (lente Topógrafo). */
  const terrainProfile = useElevationProfile(map)
  const { open: profileOpen, close: closeProfile } = terrainProfile
  /** Mientras se dibuja el perfil, los clics del mapa son vértices, no selección. */
  const drawingRef = useRef(false)
  drawingRef.current = terrainProfile.active

  const datasets = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, buildProjectData(p)])), [projects])
  const traverseBounds = useMemo(() => bboxOf(buildTraverse(profile.timeline)), [profile.timeline])

  // El efecto del mapa corre una sola vez: lee props desde refs.
  const initRef = useRef({ projects, datasets, timeline: profile.timeline })
  initRef.current = { projects, datasets, timeline: profile.timeline }

  useEffect(() => {
    // Un enlace con hash (#read, #<proyecto>) va directo a su destino, sin portada.
    const deepLink = location.hash.length > 1
    if (deepLink) {
      setIntro('done')
      setLenses(ALL_LENSES)
    }

    const instance = initMap('lab-map', {
      camera: deepLink ? landingCamera() : INTRO_CAMERA,
      // Globe se convierte solo en mercator al acercarse: sirve para la portada y para el valle.
      projection: 'globe',
      config: LAB_BASEMAP,
      fog: LAB_FOG,
      navigation: false,
    })
    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    instance.addControl(new mapboxgl.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-left')

    instance.on('load', () => {
      const { projects, datasets, timeline } = initRef.current
      registryRef.current = addLabLayers(instance, projects, datasets, timeline)
      // La portada se cerró ("Read the portfolio") antes de que el mapa cargara.
      if (introRef.current === 'done') instance.jumpTo(landingCamera())
      setMap(instance)
    })

    return () => {
      setMap(null)
      registryRef.current = null
      instance.remove()
    }
  }, [])

  useEffect(() => {
    if (map && registryRef.current) applyVisibility(map, registryRef.current, projects, lenses, hidden, tileBoundaries)
  }, [map, projects, lenses, hidden, tileBoundaries])

  /** Cierra la portada sin vuelo: todo encendido y la cámara ya en el valle. */
  const skipIntro = useCallback(() => {
    if (introRef.current === 'done') return
    setIntro('done')
    setRevealing(null)
    setLenses(ALL_LENSES)
    map?.stop()
    map?.jumpTo(landingCamera())
  }, [map])

  const startExplore = () => {
    if (!map || intro !== 'hero') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      skipIntro()
      return
    }
    setIntro('flying')
    // Si el usuario toma el mapa a mitad de vuelo, 'moveend' llega igual y la
    // revelación ocurre donde haya quedado.
    map.once('moveend', () => setIntro((stage) => (stage === 'flying' ? 'reveal' : stage)))
    map.flyTo({ ...landingCamera(), duration: LANDING_FLY_MS, essential: true })
  }

  // Durante la portada y el vuelo, un pulso marca dónde se va a aterrizar.
  const landing = intro === 'hero' || intro === 'flying'
  useEffect(() => {
    if (!map || !landing) return
    const el = document.createElement('div')
    el.className = 'relative h-3 w-3'
    el.innerHTML =
      '<span class="absolute inset-0 animate-ping rounded-full bg-lab-accent/70"></span>' +
      '<span class="absolute inset-0 rounded-full border-2 border-lab-bg bg-lab-accent"></span>'
    const marker = new mapboxgl.Marker({ element: el }).setLngLat(profile.origin.coord).addTo(map)
    return () => {
      marker.remove()
    }
  }, [map, landing, profile.origin.coord])

  // Revelación: una lente por paso, del campo al producto.
  useEffect(() => {
    if (intro !== 'reveal') return
    const timers = LENS_ORDER.map((lens, i) =>
      window.setTimeout(() => {
        setLenses((l) => ({ ...l, [lens]: true }))
        setRevealing(lens)
      }, REVEAL_DELAY_MS + i * REVEAL_STEP_MS)
    )
    timers.push(
      window.setTimeout(() => {
        setRevealing(null)
        setIntro('done')
      }, REVEAL_DELAY_MS + LENS_ORDER.length * REVEAL_STEP_MS)
    )
    return () => timers.forEach(window.clearTimeout)
  }, [intro])

  const fitTo = useCallback(
    (bounds: LngLatBoundsLike) => {
      map?.fitBounds(bounds, {
        padding: framePadding(),
        pitch: 52,
        bearing: -14,
        maxZoom: 15.2,
        duration: 2200,
        essential: true,
      })
    },
    [map]
  )

  const selectProject = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id)
      if (!project) return
      if (!map) {
        pendingRef.current = id
        return
      }
      closeProfile()
      setSelectedId(id)
      setFeature(null)
      setLayersOpen(false)
      setLenses((l) => (l[project.lens] ? l : { ...l, [project.lens]: true }))
      setHidden((h) => (h[id] ? { ...h, [id]: false } : h))
      fitTo(bboxOf(datasets[id].data))
    },
    [closeProfile, datasets, fitTo, map, projects]
  )

  const toggleProfile = () => {
    if (profileOpen) {
      closeProfile()
      return
    }
    setSelectedId(null)
    setFeature(null)
    setLayersOpen(false)
    terrainProfile.start()
  }

  // El perfil pertenece a la lente Topógrafo: si se apaga, se cierra.
  useEffect(() => {
    if (!lenses.topography && profileOpen) closeProfile()
  }, [lenses.topography, profileOpen, closeProfile])

  // Clic y hover sobre las capas de proyectos.
  useEffect(() => {
    if (!map || !registryRef.current) return
    const registry = registryRef.current
    const pickable = () =>
      registry.pickLayers.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none')

    const onClick = (e: MapMouseEvent) => {
      if (drawingRef.current) return
      const layers = pickable()
      const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined
      if (!hit) return
      const layerId = hit.layer?.id ?? ''
      setSelectedId(registry.projectByLayer[layerId] ?? String(hit.properties?.projectId))
      setFeature({ layer: layerId, geometryType: hit.geometry.type, properties: { ...hit.properties } })
    }

    let raf = 0
    const onMove = (e: MapMouseEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const layers = pickable()
        const over = layers.length > 0 && map.queryRenderedFeatures(e.point, { layers }).length > 0
        map.getCanvas().style.cursor = drawingRef.current ? 'crosshair' : over ? 'pointer' : ''
        setCursor({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          ele: map.getZoom() >= CURSOR_ELEVATION_MIN_ZOOM ? elevationAt(e.lngLat.lng, e.lngLat.lat) : null,
        })
      })
    }

    map.on('click', onClick)
    map.on('mousemove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      map.off('click', onClick)
      map.off('mousemove', onMove)
    }
  }, [map])

  // Hash: #read abre la vista Leer; #<id-de-proyecto> vuela a esa capa.
  useEffect(() => {
    const fromHash = () => {
      const hash = decodeURIComponent(location.hash.slice(1))
      const isProject = projects.some((p) => p.id === hash)
      if (hash !== 'read' && hash !== 'explore' && !isProject) return
      skipIntro()
      setMode(hash === 'read' ? 'read' : 'explore')
      if (isProject) selectProject(hash)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [projects, selectProject, skipIntro])

  useEffect(() => {
    if (map && pendingRef.current) {
      const id = pendingRef.current
      pendingRef.current = null
      selectProject(id)
    }
  }, [map, selectProject])

  const switchMode = (next: Mode) => {
    setMode(next)
    history.replaceState(null, '', next === 'read' ? '#read' : location.pathname)
  }

  const toggleLens = (lens: Lens) => setLenses((l) => ({ ...l, [lens]: !l[lens] }))
  const toggleProject = (id: string) => setHidden((h) => ({ ...h, [id]: !h[id] }))

  const showTraverse = () => {
    switchMode('explore')
    setSelectedId(null)
    setLenses((l) => ({ ...l, topography: true }))
    fitTo(traverseBounds)
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null
  /** La interfaz del mapa aparece al aterrizar, no durante la portada ni el vuelo. */
  const chrome = intro === 'reveal' || intro === 'done'

  const layerPanel = (
    <LayerPanel
      lenses={lenses}
      onToggleLens={toggleLens}
      onAllLenses={() => setLenses(ALL_LENSES)}
      projects={projects}
      hidden={hidden}
      onToggleProject={toggleProject}
      selectedId={selectedId}
      onSelect={selectProject}
      tileBoundaries={tileBoundaries}
      onToggleTileBoundaries={() => setTileBoundaries((v) => !v)}
      profileOpen={profileOpen}
      onToggleProfile={toggleProfile}
      onClose={() => setLayersOpen(false)}
    />
  )

  return (
    <div className="lab relative h-full w-full overflow-hidden" data-intro={intro}>
      {/* h-full y no `absolute inset-0`: mapbox-gl.css fuerza position: relative en .mapboxgl-map. */}
      <div id="lab-map" className="h-full w-full" />

      {chrome && (
        <div
          role="group"
          aria-label="View mode"
          className="absolute top-3 left-1/2 z-40 flex -translate-x-1/2 animate-scene-in rounded-xl border border-lab-line bg-lab-card/90 p-1 font-code text-[12px] backdrop-blur-md md:top-4"
        >
          {(['explore', 'read'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={`rounded-lg px-4 py-1.5 tracking-wider uppercase transition ${
                mode === m ? 'bg-lab-accent text-[#06221a]' : 'text-lab-muted hover:text-lab-fg'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {(intro === 'hero' || intro === 'flying') && (
        <IntroOverlay
          profile={profile}
          leaving={intro === 'flying'}
          mapReady={map !== null}
          onExplore={startExplore}
          onRead={() => {
            skipIntro()
            switchMode('read')
          }}
        />
      )}

      {intro === 'flying' && (
        <p className="pointer-events-none absolute bottom-12 left-1/2 z-30 -translate-x-1/2 animate-scene-in rounded-lg border border-lab-line bg-lab-card/85 px-3 py-1.5 font-code text-[11.5px] whitespace-nowrap text-lab-muted backdrop-blur-md">
          Descending to Cali, Colombia · {profile.origin.label.split(' · ')[0]}
        </p>
      )}

      {intro === 'reveal' && revealing && (
        <p
          key={revealing}
          className="pointer-events-none absolute top-[148px] left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 animate-scene-in items-center gap-2.5 rounded-xl border bg-lab-card/90 px-4 py-2 text-[13px] backdrop-blur-md md:top-[72px]"
          style={{ borderColor: `${LENSES[revealing].color}80` }}
        >
          <i className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: LENSES[revealing].color }} />
          <span>
            <span className="font-code text-[11px] text-lab-muted">
              Lens {LENS_ORDER.indexOf(revealing) + 1} of {LENS_ORDER.length} ·{' '}
            </span>
            <span className="font-display font-semibold" style={{ color: LENSES[revealing].color }}>
              {LENSES[revealing].label}
            </span>
          </span>
        </p>
      )}

      {mode === 'explore' && chrome && (
        <>
          {/* Escritorio: identidad + capas a la izquierda. */}
          <div className="absolute top-4 bottom-14 left-4 z-10 hidden w-[360px] animate-scene-in flex-col gap-3 md:flex">
            <IdentityCard profile={profile} />
            {layerPanel}
          </div>

          {/* Móvil: identidad compacta arriba, capas en una hoja inferior. */}
          <div className="absolute inset-x-4 top-16 z-10 md:hidden">
            <IdentityCard profile={profile} />
          </div>
          {!selected && !profileOpen && !layersOpen && (
            <button
              type="button"
              onClick={() => setLayersOpen(true)}
              className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-lab-line bg-lab-card px-5 py-2.5 font-code text-[12px] text-lab-fg shadow-lg md:hidden"
            >
              Layers · 3 lenses
            </button>
          )}
          {layersOpen && !selected && !profileOpen && (
            <>
              <button
                type="button"
                aria-label="Close layers"
                onClick={() => setLayersOpen(false)}
                className="absolute inset-0 z-[9] cursor-default md:hidden"
              />
              <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[64%] animate-modal-drawer-in flex-col md:hidden">
                {layerPanel}
              </div>
            </>
          )}

          {selected && map && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-end md:inset-x-auto md:top-4 md:right-4 md:bottom-14 md:w-[420px] md:items-start">
              <Inspector
                map={map}
                project={selected}
                feature={feature?.properties.projectId === selected.id ? feature : null}
                breaks={datasets[selected.id]?.breaks}
                onClose={() => {
                  setSelectedId(null)
                  setFeature(null)
                }}
              />
            </div>
          )}

          {/* Centro inferior, en el espacio libre entre paneles: perfil, telemetría y coordenadas. */}
          <div
            className={`pointer-events-none absolute bottom-4 left-[392px] z-10 hidden flex-col items-center gap-2 md:flex ${
              selected ? 'right-[452px]' : 'right-16'
            }`}
          >
            {profileOpen && isDesktop && (
              <div className="w-full max-w-[760px]">
                <ProfilePanel tool={terrainProfile} />
              </div>
            )}
            {map && lenses.software && !profileOpen && (
              <div className={selected ? 'hidden xl:block' : ''}>
                <TelemetryHud map={map} />
              </div>
            )}
            <div className="rounded-lg border border-lab-line bg-lab-card/85 px-3 py-1 font-code text-[11px] text-lab-muted tabular-nums backdrop-blur-md">
              {cursor
                ? `${Math.abs(cursor.lat).toFixed(5)}° ${cursor.lat >= 0 ? 'N' : 'S'} · ${Math.abs(cursor.lng).toFixed(5)}° ${
                    cursor.lng >= 0 ? 'E' : 'W'
                  }${cursor.ele !== null ? ` · ${formatMeters(cursor.ele)}` : ''}`
                : 'WGS84 · move the cursor over the map'}
            </div>
          </div>

          {/* Móvil: el perfil ocupa la hoja inferior. */}
          {profileOpen && !isDesktop && (
            <div className="absolute inset-x-0 bottom-0 z-20">
              <ProfilePanel tool={terrainProfile} />
            </div>
          )}

          {!map && (
            <div className="absolute inset-0 z-0 grid place-items-center font-code text-[12px] text-lab-muted">
              loading map…
            </div>
          )}
        </>
      )}

      {mode === 'read' && (
        <ReadView
          profile={profile}
          projects={projects}
          onExplore={() => switchMode('explore')}
          onViewOnMap={(id) => {
            switchMode('explore')
            selectProject(id)
          }}
          onViewTraverse={showTraverse}
        />
      )}
    </div>
  )
}
