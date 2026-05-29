import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileImage, Maximize2 } from 'lucide-react'
import { CRS, type LatLngBoundsExpression } from 'leaflet'
import { ImageOverlay, MapContainer, useMap } from 'react-leaflet'

export interface LayoutOption {
  id: string
  label: string
  fileName: string
  url: string
}

interface CadLayoutPreviewProps {
  selectedLayoutId: string
  onSelectedLayoutChange: (layoutId: string) => void
}

interface LayoutImageState {
  status: 'loading' | 'loaded' | 'error'
  width: number
  height: number
}

export const CAD_LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'duc-hoa',
    label: 'Đức Hòa',
    fileName: 'duc-hoa-layout.png',
    url: '/maps/layouts/duc-hoa-layout.png',
  },
  {
    id: 'my-hanh',
    label: 'Mỹ Hạnh',
    fileName: 'my-hanh-layout.png',
    url: '/maps/layouts/my-hanh-layout.png',
  },
  {
    id: 'duc-lap',
    label: 'Đức Lập',
    fileName: 'duc-lap-layout.png',
    url: '/maps/layouts/duc-lap-layout.png',
  },
]

function getImageBounds(image: LayoutImageState): LatLngBoundsExpression {
  return [
    [0, 0],
    [image.height, image.width],
  ]
}

function useLayoutImage(url: string): LayoutImageState {
  const [image, setImage] = useState<LayoutImageState>({
    status: 'loading',
    width: 0,
    height: 0,
  })

  useEffect(() => {
    let cancelled = false
    const layoutImage = new Image()

    setImage({ status: 'loading', width: 0, height: 0 })

    layoutImage.onload = () => {
      if (cancelled) {
        return
      }

      setImage({
        status: 'loaded',
        width: layoutImage.naturalWidth,
        height: layoutImage.naturalHeight,
      })
    }

    layoutImage.onerror = () => {
      if (!cancelled) {
        setImage({ status: 'error', width: 0, height: 0 })
      }
    }

    layoutImage.src = url

    return () => {
      cancelled = true
    }
  }, [url])

  return image
}

function LayoutMapController({
  bounds,
  resetVersion,
}: {
  bounds: LatLngBoundsExpression
  resetVersion: number
}) {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(bounds, { padding: [28, 28], animate: false })
    map.setMaxBounds(bounds)
  }, [bounds, map, resetVersion])

  return null
}

export function CadLayoutPreview({
  selectedLayoutId,
  onSelectedLayoutChange,
}: CadLayoutPreviewProps) {
  const [resetVersion, setResetVersion] = useState(0)
  const selectedLayout =
    CAD_LAYOUT_OPTIONS.find((layout) => layout.id === selectedLayoutId) ?? CAD_LAYOUT_OPTIONS[0]
  const image = useLayoutImage(selectedLayout.url)
  const bounds = useMemo(() => (image.status === 'loaded' ? getImageBounds(image) : null), [image])

  return (
    <div className="panel relative h-full min-h-[580px] overflow-hidden bg-[#111827]">
      <div className="absolute left-4 top-4 z-[800] flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/90 p-1 shadow-sm">
          {CAD_LAYOUT_OPTIONS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => onSelectedLayoutChange(layout.id)}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                selectedLayout.id === layout.id
                  ? 'bg-white text-slate-900'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              {layout.label}
            </button>
          ))}
        </div>
        <select
          value={selectedLayout.id}
          onChange={(event) => onSelectedLayoutChange(event.target.value)}
          className="h-9 rounded-lg border border-slate-700 bg-slate-900/90 px-3 text-xs font-semibold text-slate-100 shadow-sm"
        >
          {CAD_LAYOUT_OPTIONS.map((layout) => (
            <option key={layout.id} value={layout.id}>
              {layout.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setResetVersion((value) => value + 1)}
          disabled={!bounds}
          className="ghost-btn h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Maximize2 className="mr-2 size-4" />
          Fit bản vẽ
        </button>
      </div>

      <div className="absolute right-4 top-4 z-[800] rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm">
        Bản vẽ gốc tham chiếu: {selectedLayout.fileName}
      </div>

      <div className="absolute bottom-4 left-4 z-[800] max-w-[520px] rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-sm">
        Layout chỉ dùng để tham khảo khung in, title block và chú giải. Dữ liệu GIS chính vẫn là CAD Vector từ Model.
      </div>

      {image.status === 'loading' && (
        <div className="flex h-full items-center justify-center p-6 text-center text-white">
          <div>
            <FileImage className="mx-auto mb-3 size-8 animate-pulse text-sky-300" />
            <p className="text-base font-semibold">Đang tải layout...</p>
            <p className="mt-1 text-sm text-slate-300">{selectedLayout.url}</p>
          </div>
        </div>
      )}

      {image.status === 'error' && (
        <div className="flex h-full items-center justify-center p-6 text-center text-white">
          <div className="max-w-md rounded-xl border border-slate-700 bg-slate-900/80 p-5">
            <AlertTriangle className="mx-auto mb-3 size-8 text-amber-300" />
            <p className="text-base font-semibold">Chưa có ảnh layout</p>
            <p className="mt-2 text-sm text-slate-300">
              Chưa có ảnh layout, vui lòng export layout từ DWG và đặt vào public/maps/layouts/
            </p>
          </div>
        </div>
      )}

      {image.status === 'loaded' && bounds && (
        <MapContainer
          key={`${selectedLayout.id}-${image.width}x${image.height}`}
          crs={CRS.Simple}
          center={[image.height / 2, image.width / 2]}
          zoom={-1}
          minZoom={-5}
          maxZoom={4}
          maxBounds={bounds}
          maxBoundsViscosity={1}
          scrollWheelZoom
          className="h-full w-full bg-[#111827]"
          attributionControl={false}
        >
          <ImageOverlay url={selectedLayout.url} bounds={bounds} opacity={1} />
          <LayoutMapController bounds={bounds} resetVersion={resetVersion} />
        </MapContainer>
      )}
    </div>
  )
}
