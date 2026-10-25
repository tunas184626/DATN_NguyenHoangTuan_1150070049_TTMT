import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export function MapResizeController() {
  const map = useMap()

  useEffect(() => {
    let frame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true })
      })
    })
    observer.observe(map.getContainer())
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [map])

  return null
}
