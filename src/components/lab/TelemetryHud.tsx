import { useEffect, useState } from 'react'
import type { Map } from 'mapbox-gl'

type Props = {
  map: Map
}

type Telemetry = {
  zoom: number
  pitch: number
  bearing: number
  lng: number
  lat: number
}

/** Telemetría en vivo del mapa: la lente Software muestra el motor por dentro. */
export default function TelemetryHud({ map }: Props) {
  const read = (): Telemetry => {
    const c = map.getCenter()
    return { zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), lng: c.lng, lat: c.lat }
  }
  const [t, setT] = useState<Telemetry>(read)
  const [fps, setFps] = useState(0)
  const [tiles, setTiles] = useState(0)

  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      frames++
      if (now - last >= 1000) {
        setFps(frames)
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onMove = () => setT(read())
    let count = 0
    const onData = (e: { dataType?: string; tile?: unknown }) => {
      if (e.dataType === 'source' && e.tile) setTiles(++count)
    }
    map.on('move', onMove)
    map.on('data', onData as never)
    return () => {
      cancelAnimationFrame(raf)
      map.off('move', onMove)
      map.off('data', onData as never)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  const cell = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="text-[9.5px] tracking-wider text-lab-muted uppercase">{label}</span>
      <span className="text-[12px] text-lab-fg tabular-nums">{value}</span>
    </div>
  )

  return (
    <div className="flex items-center gap-4 rounded-xl border border-lab-accent3/40 bg-lab-card/90 px-3.5 py-2 font-code backdrop-blur-md">
      <span className="text-[10px] tracking-wider text-lab-accent3 uppercase">map.telemetry</span>
      {cell('zoom', t.zoom.toFixed(2))}
      {cell('pitch', `${t.pitch.toFixed(0)}°`)}
      {cell('bearing', `${t.bearing.toFixed(0)}°`)}
      <span className="hidden lg:contents">{cell('center', `${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}`)}</span>
      {cell('tiles', String(tiles))}
      {cell('fps', String(fps))}
    </div>
  )
}
