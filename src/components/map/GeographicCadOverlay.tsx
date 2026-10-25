import { useEffect, useState } from 'react'
import { CircleMarker, latLngBounds } from 'leaflet'
import { GeoJSON, useMap } from 'react-leaflet'
import type { AssetCollection } from '../../types/gis'
import { loadOperationalCadLayers } from '../../data/dataService'
import { getFeatureBounds } from '../../utils/geo'

let referenceRequest: Promise<AssetCollection> | null = null
function loadReference(): Promise<AssetCollection> {
  referenceRequest ??= loadOperationalCadLayers().then((layers) => ({
    type: 'FeatureCollection' as const,
    features: Object.values(layers).flatMap((layer) => layer.features),
  })).catch((error: unknown) => { referenceRequest = null; throw error })
  return referenceRequest
}

export function GeographicCadOverlay({ focusPosition, onFeaturesLoaded }: { focusPosition: [number, number] | null; onFeaturesLoaded?: (features: AssetCollection['features']) => void }) {
  const map = useMap()
  const [collection, setCollection] = useState<AssetCollection | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void loadReference().then((data) => { if (active) { setCollection(data); onFeaturesLoaded?.(data.features) } }, () => { if (active) setError(true) })
    return () => { active = false }
  }, [onFeaturesLoaded])

  useEffect(() => {
    if (!collection) return
    if (focusPosition) { map.setView(focusPosition, 16, { animate: false }); return }
    const bounds = latLngBounds([])
    for (const feature of collection.features) {
      const extent = getFeatureBounds(feature)
      if (extent) bounds.extend(extent)
    }
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 80], maxZoom: 14, animate: false })
  }, [collection, focusPosition, map])

  return <>
    {collection && <GeoJSON data={collection} interactive={false}
      style={{ color: '#d97706', weight: 2, opacity: 0.75, fillOpacity: 0.06, dashArray: '5 4' }}
      pointToLayer={(_, latlng) => new CircleMarker(latlng, { radius: 5, color: '#d97706', fillOpacity: 0.6, interactive: false })} />}
    <p role="status" className="pointer-events-none absolute left-3 top-16 z-[800] max-w-[calc(100%-1.5rem)] rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800">
      {error ? 'Chưa tải được CAD đối chiếu. Tắt rồi bật lại để thử lại.' : collection
        ? `CAD đối chiếu · ${collection.features.length.toLocaleString('vi-VN')} đối tượng · nét vàng đứt` : 'Đang tải CAD đối chiếu…'}
    </p>
  </>
}
