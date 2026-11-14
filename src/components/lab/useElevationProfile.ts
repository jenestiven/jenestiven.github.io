import { useCallback, useEffect, useState } from 'react'
import type { Map, MapMouseEvent } from 'mapbox-gl'
import {
  buildProfile,
  hasProfileLayers,
  setProfileCursor,
  setProfileLine,
  type Profile,
} from '../../lib/lab/elevationProfile'
import type { Position } from '../../lib/lab/syntheticGeometry'

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Herramienta de perfil de elevación. Mientras `active` es true, cada clic en
 * el mapa añade un vértice; con dos o más se lee el terreno a lo largo de la
 * línea. El perfil queda a la vista aunque se deje de dibujar.
 */
export function useElevationProfile(map: Map | null) {
  const [active, setActive] = useState(false)
  const [vertices, setVertices] = useState<Position[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<ProfileStatus>('idle')
  /** Índice de la muestra bajo el cursor de la gráfica. */
  const [hover, setHover] = useState<number | null>(null)

  // Dibujo: clic = vértice. El doble clic no debe hacer zoom mientras se dibuja.
  useEffect(() => {
    if (!map || !active) return
    const onClick = (e: MapMouseEvent) => setVertices((v) => [...v, [e.lngLat.lng, e.lngLat.lat]])
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(false)
    }
    map.on('click', onClick)
    map.doubleClickZoom.disable()
    window.addEventListener('keydown', onKey)
    return () => {
      map.off('click', onClick)
      map.doubleClickZoom.enable()
      window.removeEventListener('keydown', onKey)
    }
  }, [map, active])

  // La línea en el mapa sigue a los vértices.
  useEffect(() => {
    if (!map || (vertices.length === 0 && !hasProfileLayers(map))) return
    setProfileLine(map, vertices)
  }, [map, vertices])

  // El perfil se recalcula con cada vértice. Mientras llega el nuevo, el
  // anterior sigue en pantalla (la gráfica solo se atenúa).
  useEffect(() => {
    setHover(null)
    if (vertices.length < 2) {
      setProfile(null)
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('loading')
    buildProfile(vertices)
      .then((next) => {
        if (cancelled) return
        setProfile(next)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [vertices])

  // El punto del mapa acompaña a la lectura de la gráfica.
  useEffect(() => {
    if (!map) return
    const sample = hover !== null ? profile?.samples[hover] : undefined
    setProfileCursor(map, sample ? [sample.lng, sample.lat] : null)
  }, [map, hover, profile])

  const start = useCallback(() => {
    setVertices([])
    setActive(true)
  }, [])
  const close = useCallback(() => {
    setActive(false)
    setVertices([])
  }, [])
  const resume = useCallback(() => setActive(true), [])
  const finish = useCallback(() => setActive(false), [])
  const undo = useCallback(() => setVertices((v) => v.slice(0, -1)), [])
  /** Reintenta la lectura tras un error de red. */
  const retry = useCallback(() => setVertices((v) => [...v]), [])

  return {
    active,
    /** La herramienta está en uso: dibujando o con un perfil a la vista. */
    open: active || vertices.length > 0,
    vertices,
    profile,
    status,
    hover,
    setHover,
    start,
    close,
    resume,
    finish,
    undo,
    retry,
  }
}

export type ElevationProfileTool = ReturnType<typeof useElevationProfile>
