import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { LngLatBoundsLike, Map, MapMouseEvent } from 'mapbox-gl'
import { initMap, type MapCamera } from '../../lib/map/initMap'
import { addLabLayers, applyVisibility, type LabRegistry } from '../../lib/lab/labLayers'
import { bboxOf, buildProjectData, buildTraverse } from '../../lib/lab/syntheticGeometry'
import type { LabProfile, LabProject, Lens } from '../../types'
import IdentityCard from './IdentityCard'
import Inspector, { type PickedFeature } from './Inspector'
import LayerPanel from './LayerPanel'
import ReadView from './ReadView'
import TelemetryHud from './TelemetryHud'

type Props = {
  profile: LabProfile
  projects: LabProject[]
}

type Mode = 'explore' | 'read'

/** El valle de Cali con la ladera occidental a la vista. */
const LAB_CAMERA: MapCamera = { center: [-76.505, 3.425], zoom: 11.6, pitch: 50, bearing: -14 }

/** Standard en noche + monocromo: el mapa base se apaga para que las lentes pongan el color. */
const LAB_BASEMAP = {
  basemap: {
    lightPreset: 'night',
    theme: 'monochrome',
    showPointOfInterestLabels: false,
    showTransitLabels: false,
  },
}

const ALL_LENSES: Record<Lens, boolean> = { topography: true, gis: true, software: true }

/** Deja libres los paneles al encuadrar una capa. */
function framePadding() {
  if (window.innerWidth < 768) {
    return { top: 140, bottom: Math.round(window.innerHeight * 0.55), left: 30, right: 30 }
  }
  return { top: 90, bottom: 90, left: 410, right: 470 }
}

export default function LabView({ profile, projects }: Props) {
  const [map, setMap] = useState<Map | null>(null)
  const registryRef = useRef<LabRegistry | null>(null)
  const [lenses, setLenses] = useState<Record<Lens, boolean>>(ALL_LENSES)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feature, setFeature] = useState<PickedFeature | null>(null)
  const [mode, setMode] = useState<Mode>('explore')
  const [layersOpen, setLayersOpen] = useState(false)
  const [tileBoundaries, setTileBoundaries] = useState(false)
  const [cursor, setCursor] = useState<{ lng: number; lat: number; ele: number | null } | null>(null)
  /** Proyecto pedido antes de que el mapa terminara de cargar (desde Leer o el hash). */
  const pendingRef = useRef<string | null>(null)

  const datasets = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, buildProjectData(p)])), [projects])
  const traverseBounds = useMemo(() => bboxOf(buildTraverse(profile.timeline)), [profile.timeline])

  // El efecto del mapa corre una sola vez: lee props desde refs.
  const initRef = useRef({ projects, datasets, timeline: profile.timeline })
  initRef.current = { projects, datasets, timeline: profile.timeline }

  useEffect(() => {
    const instance = initMap('lab-map', {
      camera: LAB_CAMERA,
      projection: 'mercator',
      config: LAB_BASEMAP,
      fog: null,
      navigation: false,
    })
    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    instance.addControl(new mapboxgl.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-left')

    instance.on('load', () => {
      const { projects, datasets, timeline } = initRef.current
      registryRef.current = addLabLayers(instance, projects, datasets, timeline)
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
      setSelectedId(id)
      setFeature(null)
      setLayersOpen(false)
      setLenses((l) => (l[project.lens] ? l : { ...l, [project.lens]: true }))
      setHidden((h) => (h[id] ? { ...h, [id]: false } : h))
      fitTo(bboxOf(datasets[id].data))
    },
    [datasets, fitTo, map, projects]
  )

  // Clic y hover sobre las capas de proyectos.
  useEffect(() => {
    if (!map || !registryRef.current) return
    const registry = registryRef.current
    const pickable = () =>
      registry.pickLayers.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none')

    const onClick = (e: MapMouseEvent) => {
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
        map.getCanvas().style.cursor = over ? 'pointer' : ''
        setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat, ele: map.queryTerrainElevation(e.lngLat) ?? null })
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
      if (hash === 'read') setMode('read')
      else if (hash === 'explore') setMode('explore')
      else if (projects.some((p) => p.id === hash)) {
        setMode('explore')
        selectProject(hash)
      }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [projects, selectProject])

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
    />
  )

  return (
    <div className="lab relative h-full w-full overflow-hidden">
      {/* h-full y no `absolute inset-0`: mapbox-gl.css fuerza position: relative en .mapboxgl-map. */}
      <div id="lab-map" className="h-full w-full" />

      <div
        role="group"
        aria-label="View mode"
        className="absolute top-3 left-1/2 z-40 flex -translate-x-1/2 rounded-xl border border-lab-line bg-lab-card/90 p-1 font-code text-[12px] backdrop-blur-md md:top-4"
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

      {mode === 'explore' && (
        <>
          {/* Escritorio: identidad + capas a la izquierda. */}
          <div className="absolute top-4 bottom-14 left-4 z-10 hidden w-[360px] flex-col gap-3 md:flex">
            <IdentityCard profile={profile} />
            {layerPanel}
          </div>

          {/* Móvil: identidad compacta arriba, capas en una hoja inferior. */}
          <div className="absolute inset-x-4 top-16 z-10 md:hidden">
            <IdentityCard profile={profile} />
          </div>
          {!selected && (
            <button
              type="button"
              onClick={() => setLayersOpen((o) => !o)}
              className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-lab-line bg-lab-card px-4 py-2 font-code text-[12px] text-lab-fg md:hidden"
            >
              {layersOpen ? 'Close layers' : 'Layers · 3 lenses'}
            </button>
          )}
          {layersOpen && !selected && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[62%] flex-col md:hidden">{layerPanel}</div>
          )}

          {selected && map && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[70%] items-end md:inset-x-auto md:top-4 md:right-4 md:bottom-14 md:max-h-none md:w-[420px] md:items-start">
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

          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
            {map && lenses.software && <TelemetryHud map={map} />}
            <div className="rounded-lg border border-lab-line bg-lab-card/85 px-3 py-1 font-code text-[11px] text-lab-muted tabular-nums backdrop-blur-md">
              {cursor
                ? `${Math.abs(cursor.lat).toFixed(5)}° ${cursor.lat >= 0 ? 'N' : 'S'} · ${Math.abs(cursor.lng).toFixed(5)}° ${
                    cursor.lng >= 0 ? 'E' : 'W'
                  }${cursor.ele !== null ? ` · ${Math.round(cursor.ele)} m` : ''}`
                : 'WGS84 · move the cursor over the map'}
            </div>
          </div>

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
