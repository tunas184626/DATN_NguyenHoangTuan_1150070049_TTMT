import { useEffect, useMemo, useState } from 'react'
import {
  Clipboard,
  Eye,
  EyeOff,
  LocateFixed,
  MapPinned,
  Maximize2,
  MousePointer2,
  Move,
} from 'lucide-react'
import { CRS, type LatLngBoundsExpression, type LeafletMouseEvent, type PathOptions } from 'leaflet'
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Polygon,
  Polyline,
  Tooltip as LeafletTooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { CadBlueprintAsset, CadBlueprintConfig, LayerKey } from '../../types/gis'
import { LAYER_COLORS } from '../../utils/asset'

const CAD_IMAGE_URL = '/maps/biwase-hien-trang.png'
const CAD_IMAGE_NAME = 'biwase-hien-trang.png'

interface CadBlueprintMapProps {
  assets: CadBlueprintAsset[]
  config: CadBlueprintConfig
  visibleLayers: Record<LayerKey, boolean>
  selectedAssetId: string | null
  hoveredAssetId: string | null
  editMode: boolean
  onEditModeChange: (enabled: boolean) => void
  onSelectAsset: (id: string) => void
  onHoverAsset: (id: string | null) => void
  onUpdatePointPosition: (id: string, cadPosition: [number, number]) => void
  onImageStatusChange: (loaded: boolean) => void
}

interface CadImageState {
  status: 'loading' | 'loaded' | 'error'
  width: number
  height: number
}

function roundCadCoord(value: number): number {
  return Math.round(value * 100) / 100
}

function getImageBounds(image: CadImageState): LatLngBoundsExpression {
  return [
    [0, 0],
    [image.height, image.width],
  ]
}

function getAssetCoordinates(asset: CadBlueprintAsset): [number, number][] {
  if (asset.geometryType === 'Point') {
    return asset.cadPosition ? [asset.cadPosition] : []
  }

  return asset.cadPath ?? []
}

function getAssetBounds(asset: CadBlueprintAsset, image: CadImageState): LatLngBoundsExpression | null {
  const coordinates = getAssetCoordinates(asset)

  if (!coordinates.length) {
    return null
  }

  const yValues = coordinates.map(([y]) => y)
  const xValues = coordinates.map(([, x]) => x)
  const minY = Math.min(...yValues)
  const minX = Math.min(...xValues)
  const maxY = Math.max(...yValues)
  const maxX = Math.max(...xValues)
  const padding = asset.geometryType === 'Point' ? 90 : 56

  return [
    [Math.max(0, minY - padding), Math.max(0, minX - padding)],
    [Math.min(image.height, maxY + padding), Math.min(image.width, maxX + padding)],
  ]
}

function useCadImage(): CadImageState {
  const [image, setImage] = useState<CadImageState>({
    status: 'loading',
    width: 0,
    height: 0,
  })

  useEffect(() => {
    let cancelled = false
    const cadImage = new Image()

    cadImage.onload = () => {
      if (cancelled) {
        return
      }

      setImage({
        status: 'loaded',
        width: cadImage.naturalWidth,
        height: cadImage.naturalHeight,
      })
    }

    cadImage.onerror = () => {
      if (!cancelled) {
        setImage({ status: 'error', width: 0, height: 0 })
      }
    }

    cadImage.src = CAD_IMAGE_URL

    return () => {
      cancelled = true
    }
  }, [])

  return image
}

function CadMapController({
  image,
  selectedAsset,
  resetVersion,
  selectedFocusVersion,
}: {
  image: CadImageState
  selectedAsset: CadBlueprintAsset | null
  resetVersion: number
  selectedFocusVersion: number
}) {
  const map = useMap()
  const fullBounds = useMemo(() => getImageBounds(image), [image])

  useEffect(() => {
    map.fitBounds(fullBounds, { padding: [24, 24], animate: false })
    map.setMaxBounds(fullBounds)
  }, [fullBounds, map, resetVersion])

  useEffect(() => {
    if (!selectedAsset) {
      return
    }

    const assetBounds = getAssetBounds(selectedAsset, image)
    if (assetBounds) {
      map.fitBounds(assetBounds, { padding: [40, 40], maxZoom: 2 })
    }
  }, [image, map, selectedAsset, selectedFocusVersion])

  return null
}

function CadMapClickHandler({
  coordinateMode,
  editMode,
  selectedAsset,
  onCoordinate,
  onUpdatePointPosition,
}: {
  coordinateMode: boolean
  editMode: boolean
  selectedAsset: CadBlueprintAsset | null
  onCoordinate: (cadPosition: [number, number]) => void
  onUpdatePointPosition: (cadPosition: [number, number]) => void
}) {
  useMapEvents({
    click: (event) => {
      const cadPosition: [number, number] = [
        roundCadCoord(event.latlng.lat),
        roundCadCoord(event.latlng.lng),
      ]

      if (coordinateMode) {
        console.log('cadPosition:', cadPosition)
        onCoordinate(cadPosition)
      }

      if (editMode && selectedAsset?.geometryType === 'Point') {
        onUpdatePointPosition(cadPosition)
      }
    },
  })

  return null
}

function getCadAssetStyle(
  layerKey: Exclude<LayerKey, 'incidents'>,
  selected: boolean,
  hovered: boolean,
): PathOptions {
  const color = LAYER_COLORS[layerKey]

  return {
    color,
    fillColor: color,
    fillOpacity: layerKey === 'boundaries' ? 0.05 : selected ? 0.24 : hovered ? 0.18 : 0.1,
    opacity: selected ? 1 : hovered ? 0.92 : 0.78,
    weight: selected ? 4 : hovered ? 3 : 2,
    dashArray: layerKey === 'boundaries' ? '10 8' : undefined,
  }
}

function CadAssetShape({
  asset,
  selected,
  hovered,
  onSelectAsset,
  onHoverAsset,
}: {
  asset: CadBlueprintAsset
  selected: boolean
  hovered: boolean
  onSelectAsset: (id: string) => void
  onHoverAsset: (id: string | null) => void
}) {
  const pathOptions = getCadAssetStyle(asset.layerKey, selected, hovered)
  const eventHandlers = {
    click: (event: LeafletMouseEvent) => {
      event.originalEvent.stopPropagation()
      onSelectAsset(asset.id)
    },
    mouseover: () => onHoverAsset(asset.id),
    mouseout: () => onHoverAsset(null),
  }

  if (asset.geometryType === 'LineString' && asset.cadPath?.length) {
    return (
      <Polyline positions={asset.cadPath} pathOptions={pathOptions} eventHandlers={eventHandlers}>
        <LeafletTooltip sticky>
          <div className="text-xs font-semibold">{asset.name}</div>
        </LeafletTooltip>
      </Polyline>
    )
  }

  if (asset.geometryType === 'Polygon' && asset.cadPath?.length) {
    return (
      <Polygon positions={asset.cadPath} pathOptions={pathOptions} eventHandlers={eventHandlers}>
        <LeafletTooltip sticky>
          <div className="text-xs font-semibold">{asset.name}</div>
        </LeafletTooltip>
      </Polygon>
    )
  }

  if (!asset.cadPosition) {
    return null
  }

  return (
    <CircleMarker
      center={asset.cadPosition}
      radius={selected ? 10 : hovered ? 9 : 7}
      pathOptions={{
        ...pathOptions,
        color: '#f8fafc',
        fillColor: LAYER_COLORS[asset.layerKey],
        fillOpacity: selected ? 1 : 0.86,
        weight: selected ? 3 : 2,
      }}
      eventHandlers={eventHandlers}
    >
      <LeafletTooltip direction="top" opacity={0.95}>
        <div className="text-xs font-semibold">{asset.name}</div>
      </LeafletTooltip>
    </CircleMarker>
  )
}

export function CadBlueprintMap({
  assets,
  config,
  visibleLayers,
  selectedAssetId,
  hoveredAssetId,
  editMode,
  onEditModeChange,
  onSelectAsset,
  onHoverAsset,
  onUpdatePointPosition,
  onImageStatusChange,
}: CadBlueprintMapProps) {
  const [showBackground, setShowBackground] = useState(true)
  const [showInteractionLayer, setShowInteractionLayer] = useState(true)
  const [coordinateMode, setCoordinateMode] = useState(false)
  const [lastCoordinate, setLastCoordinate] = useState<[number, number] | null>(null)
  const [resetVersion, setResetVersion] = useState(0)
  const [selectedFocusVersion, setSelectedFocusVersion] = useState(0)
  const [copyState, setCopyState] = useState('Copy tọa độ')
  const image = useCadImage()
  const bounds = useMemo(() => (image.status === 'loaded' ? getImageBounds(image) : undefined), [image])
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null
  const visibleAssets = assets.filter((asset) => {
    if (!showInteractionLayer || !visibleLayers[asset.layerKey]) {
      return false
    }

    if (asset.geometryType === 'Point') {
      return true
    }

    return asset.id === selectedAssetId
  })

  useEffect(() => {
    onImageStatusChange(image.status === 'loaded')
  }, [image.status, onImageStatusChange])

  const handleCopyCoordinate = async () => {
    if (!lastCoordinate) {
      return
    }

    const text = `[${lastCoordinate[0]}, ${lastCoordinate[1]}]`

    try {
      await navigator.clipboard.writeText(text)
      setCopyState('Đã copy')
      window.setTimeout(() => setCopyState('Copy tọa độ'), 1200)
    } catch {
      setCopyState(text)
    }
  }

  if (image.status === 'loading') {
    return (
      <div className="panel flex h-full min-h-[580px] items-center justify-center overflow-hidden bg-[#111827] p-6 text-center text-white">
        <div>
          <MapPinned className="mx-auto mb-3 size-8 text-sky-300" />
          <p className="text-base font-semibold">Đang tải ảnh CAD...</p>
          <p className="mt-1 text-sm text-slate-300">{CAD_IMAGE_URL}</p>
        </div>
      </div>
    )
  }

  if (image.status === 'error' || !bounds) {
    return (
      <div className="panel flex h-full min-h-[580px] items-center justify-center overflow-hidden bg-[#111827] p-6 text-center text-white">
        <div className="max-w-md rounded-xl border border-slate-700 bg-slate-900/80 p-5">
          <MapPinned className="mx-auto mb-3 size-8 text-amber-300" />
          <p className="text-base font-semibold">Chưa tìm thấy ảnh CAD</p>
          <p className="mt-2 text-sm text-slate-300">
            Hãy đặt file tại <span className="font-semibold text-white">public/maps/biwase-hien-trang.png</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel relative h-full min-h-[580px] overflow-hidden bg-[#111827]">
      <div className="absolute left-4 top-4 z-[800] flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
        <button type="button" onClick={() => setResetVersion((value) => value + 1)} className="ghost-btn h-9 px-3">
          <Maximize2 className="mr-2 size-4" />
          Fit bản vẽ
        </button>
        <button
          type="button"
          onClick={() => setCoordinateMode((value) => !value)}
          className={`ghost-btn h-9 px-3 ${coordinateMode ? 'border-sky-300 bg-sky-50 text-sky-700' : ''}`}
        >
          <MousePointer2 className="mr-2 size-4" />
          Lấy tọa độ
        </button>
        <button
          type="button"
          onClick={() => setShowInteractionLayer((value) => !value)}
          className="ghost-btn h-9 px-3"
        >
          {showInteractionLayer ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
          {showInteractionLayer ? 'Ẩn lớp tương tác' : 'Hiện lớp tương tác'}
        </button>
        <button type="button" onClick={() => setShowBackground((value) => !value)} className="ghost-btn h-9 px-3">
          {showBackground ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
          {showBackground ? 'Ẩn nền CAD' : 'Hiện nền CAD'}
        </button>
        <button
          type="button"
          onClick={() => onEditModeChange(!editMode)}
          className={`ghost-btn h-9 px-3 ${editMode ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}
        >
          <Move className="mr-2 size-4" />
          Chỉnh vị trí
        </button>
        <button
          type="button"
          onClick={() => setSelectedFocusVersion((value) => value + 1)}
          disabled={!selectedAsset}
          className="ghost-btn h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LocateFixed className="mr-2 size-4" />
          Zoom đối tượng
        </button>
      </div>

      <div className="absolute right-4 top-4 z-[800] rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm">
        Đang dùng ảnh CAD: {config.imageFileName || CAD_IMAGE_NAME}
      </div>

      <MapContainer
        key={`${image.width}x${image.height}`}
        crs={CRS.Simple}
        center={[image.height / 2, image.width / 2]}
        zoom={-1}
        minZoom={-4}
        maxZoom={4}
        maxBounds={bounds}
        maxBoundsViscosity={1}
        scrollWheelZoom
        className="h-full w-full bg-[#111827]"
        attributionControl={false}
      >
        {showBackground && <ImageOverlay url={CAD_IMAGE_URL} bounds={bounds} opacity={1} className="cad-image-overlay" />}

        {visibleAssets.map((asset) => (
          <CadAssetShape
            key={asset.id}
            asset={asset}
            selected={selectedAssetId === asset.id}
            hovered={hoveredAssetId === asset.id}
            onSelectAsset={onSelectAsset}
            onHoverAsset={onHoverAsset}
          />
        ))}

        <CadMapClickHandler
          coordinateMode={coordinateMode}
          editMode={editMode}
          selectedAsset={selectedAsset}
          onCoordinate={setLastCoordinate}
          onUpdatePointPosition={(cadPosition) => {
            if (selectedAsset) {
              onUpdatePointPosition(selectedAsset.id, cadPosition)
              setLastCoordinate(cadPosition)
            }
          }}
        />
        <CadMapController
          image={image}
          selectedAsset={selectedAsset}
          resetVersion={resetVersion}
          selectedFocusVersion={selectedFocusVersion}
        />
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[800] max-w-[360px] rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-sm">
        <p className="font-semibold">
          {lastCoordinate ? `cadPosition: [${lastCoordinate[0]}, ${lastCoordinate[1]}]` : 'Bật Lấy tọa độ rồi click lên ảnh CAD'}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCoordinate}
            disabled={!lastCoordinate}
            className="inline-flex items-center rounded-md border border-slate-600 px-2 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Clipboard className="mr-1 size-3" />
            {copyState}
          </button>
          <span className="text-slate-400">Định dạng [y, x]</span>
        </div>
      </div>

      {editMode && (
        <div className="absolute bottom-4 right-4 z-[800] max-w-[320px] rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 shadow-sm">
          {selectedAsset?.geometryType === 'Point'
            ? `Chỉnh vị trí: click lên ảnh để cập nhật ${selectedAsset.name}.`
            : 'Chọn một đối tượng Point trong sidebar để cập nhật vị trí.'}
        </div>
      )}

      {visibleAssets.length === 0 && showInteractionLayer && (
        <div className="pointer-events-none absolute inset-x-6 bottom-20 z-[800] rounded-lg border border-dashed border-slate-600 bg-slate-900/85 p-4 text-center text-sm text-slate-200">
          Chưa có marker CAD đang bật. Hãy bật layer trong sidebar.
        </div>
      )}
    </div>
  )
}
