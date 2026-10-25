import { useEffect, useId, useMemo } from 'react'
import { useMap } from 'react-leaflet'
import type { AnyMapFeature } from '../../types/gis'
import { geographicFocusHull, geographicFocusMaskPath, paddedFocusHull } from '../../utils/mapFocus'
import './GeographicFocusMask.css'

interface GeographicFocusMaskProps {
  features: readonly AnyMapFeature[]
  enabled: boolean
  padding?: number
}

/** Geographic focus affects map tiles only. Markers, vectors, tooltips and UI stay sharp. */
export function GeographicFocusMask({ features, enabled, padding = 64 }: GeographicFocusMaskProps) {
  const map = useMap()
  const id = useId()
  const hull = useMemo(() => enabled ? geographicFocusHull(features) : [], [features, enabled])

  useEffect(() => {
    if (!enabled || hull.length === 0) return
    const paneName = `geographic-focus-${id}`
    const pane = map.getPane(paneName) ?? map.createPane(paneName)
    pane.classList.add('geographic-focus-pane')
    const overlay = document.createElement('div')
    overlay.className = 'geographic-focus-mask'
    overlay.setAttribute('aria-hidden', 'true')
    pane.appendChild(overlay)
    let frame = 0

    const paint = () => {
      frame = 0
      const size = map.getSize()
      const origin = map.containerPointToLayerPoint([0, 0])
      const screenHull = hull.map(([lng, lat]): [number, number] => {
        const point = map.latLngToContainerPoint([lat, lng])
        return [point.x, point.y]
      })
      const path = geographicFocusMaskPath(size.x, size.y, paddedFocusHull(screenHull, padding))
      overlay.style.display = path ? 'block' : 'none'
      overlay.style.width = `${size.x}px`
      overlay.style.height = `${size.y}px`
      overlay.style.transform = `translate(${origin.x}px, ${origin.y}px)`
      overlay.style.clipPath = path ?? ''
    }
    const schedulePaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint)
    }
    paint()
    map.on('move zoom viewreset resize', schedulePaint)
    return () => {
      map.off('move zoom viewreset resize', schedulePaint)
      window.cancelAnimationFrame(frame)
      overlay.remove()
      // Keep the empty registered pane reusable, including React StrictMode effects.
    }
  }, [map, id, hull, enabled, padding])

  return null
}
