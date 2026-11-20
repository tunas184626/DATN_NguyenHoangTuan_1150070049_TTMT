import { useEffect, useMemo, useRef, useState } from 'react'
import { DomEvent, latLngBounds } from 'leaflet'
import type { Geometry } from 'geojson'
import { LocateFixed, RotateCcw, Trash2 } from 'lucide-react'
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { GeometryInputType } from '../../types/gis'
import { calculateLineLengthKm, type LatLng, type LngLat } from '../../utils/geo'
import { MapResizeController } from './MapResizeController'

interface AssetGeometryPickerProps {
  mode: 'create' | 'update'
  geometryType: GeometryInputType
  coordinates: LngLat[]
  featureGeometry?: Geometry | null
  accentColor: string
  onChangeCoordinates: (coords: LngLat[]) => void
  onResetDefault?: () => void
  className?: string
}

type MiniMapStyle = 'streets' | 'satellite'

const DEFAULT_CENTER: LatLng = [10.8845, 106.4255]

function toLatLng([lng, lat]: LngLat): LatLng {
  return [lat, lng]
}

function formatLengthLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(2)} km`
}

function extractGeometryShapes(geometry: Geometry | null | undefined): {
  points: LatLng[]
  lines: LatLng[][]
  polygons: LatLng[][][]
  allLatLngs: LatLng[]
} {
  const points: LatLng[] = []
  const lines: LatLng[][] = []
  const polygons: LatLng[][][] = []

  if (!geometry) {
    return { points, lines, polygons, allLatLngs: [] }
  }

  const pushCoord = (coord: number[]): LatLng | null => {
    if (coord.length < 2 || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return null
    return [coord[1], coord[0]]
  }

  if (geometry.type === 'Point') {
    const pt = pushCoord(geometry.coordinates)
    if (pt) points.push(pt)
  } else if (geometry.type === 'MultiPoint') {
    for (const coord of geometry.coordinates) {
      const pt = pushCoord(coord)
      if (pt) points.push(pt)
    }
  } else if (geometry.type === 'LineString') {
    const line = geometry.coordinates.map(pushCoord).filter((pt): pt is LatLng => Boolean(pt))
    if (line.length) lines.push(line)
  } else if (geometry.type === 'MultiLineString') {
    for (const part of geometry.coordinates) {
      const line = part.map(pushCoord).filter((pt): pt is LatLng => Boolean(pt))
      if (line.length) lines.push(line)
    }
  } else if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates
      .map((ring) => ring.map(pushCoord).filter((pt): pt is LatLng => Boolean(pt)))
      .filter((ring) => ring.length > 0)
    if (rings.length) polygons.push(rings)
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      const rings = poly
        .map((ring) => ring.map(pushCoord).filter((pt): pt is LatLng => Boolean(pt)))
        .filter((ring) => ring.length > 0)
      if (rings.length) polygons.push(rings)
    }
  }

  const allLatLngs = [
    ...points,
    ...lines.flat(),
    ...polygons.flat(2),
  ]

  return { points, lines, polygons, allLatLngs }
}

function MapClickHandler({
  enabled,
  geometryType,
  coordinates,
  onChangeCoordinates,
}: {
  enabled: boolean
  geometryType: GeometryInputType
  coordinates: LngLat[]
  onChangeCoordinates: (coords: LngLat[]) => void
}) {
  const map = useMapEvents({
    click: (event) => {
      if (!enabled) return
      const wrapped = map.wrapLatLng(event.latlng)
      const nextLng = Number(wrapped.lng.toFixed(6))
      const nextLat = Number(wrapped.lat.toFixed(6))
      const nextPoint: LngLat = [nextLng, nextLat]

      if (geometryType === 'Point') {
        onChangeCoordinates([nextPoint])
      } else {
        onChangeCoordinates([...coordinates, nextPoint])
      }
    },
  })

  return null
}

function MapViewportSync({
  points,
  focusTrigger,
}: {
  points: LatLng[]
  focusTrigger: number
}) {
  const map = useMap()
  const didInitialFit = useRef(false)
  const lastTrigger = useRef(focusTrigger)

  useEffect(() => {
    const isManualFocus = focusTrigger !== lastTrigger.current
    lastTrigger.current = focusTrigger

    if (didInitialFit.current && !isManualFocus) return
    if (points.length === 0) return

    didInitialFit.current = true
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: isManualFocus })
      return
    }

    const bounds = latLngBounds(points)
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17, animate: isManualFocus })
    }
  }, [focusTrigger, map, points])

  return null
}

export function AssetGeometryPicker({
  mode,
  geometryType,
  coordinates,
  featureGeometry,
  accentColor,
  onChangeCoordinates,
  onResetDefault,
  className = '',
}: AssetGeometryPickerProps) {
  const [mapStyle, setMapStyle] = useState<MiniMapStyle>('streets')
  const [focusTrigger, setFocusTrigger] = useState(0)
  const topControlsRef = useRef<HTMLDivElement>(null)
  const bottomControlsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    for (const el of [topControlsRef.current, bottomControlsRef.current]) {
      if (!el) continue
      DomEvent.disableClickPropagation(el)
      DomEvent.disableScrollPropagation(el)
    }
  }, [])

  const editableLatLngs = useMemo(() => coordinates.map(toLatLng), [coordinates])
  const updateShapes = useMemo(
    () => (mode === 'update' ? extractGeometryShapes(featureGeometry) : null),
    [featureGeometry, mode],
  )

  const focusPoints = useMemo(
    () => (mode === 'update' ? updateShapes?.allLatLngs ?? [] : editableLatLngs),
    [editableLatLngs, mode, updateShapes],
  )

  const initialCenter = focusPoints[0] ?? DEFAULT_CENTER

  const lineLengthKm = useMemo(() => {
    if (geometryType !== 'LineString' || coordinates.length < 2) return 0
    return calculateLineLengthKm(coordinates)
  }, [coordinates, geometryType])

  const instructionText = useMemo(() => {
    if (mode === 'update') return 'Hình học hiện tại (chỉ xem)'
    if (geometryType === 'Point') return 'Bấm vào bản đồ để đặt vị trí'
    if (geometryType === 'LineString') {
      return coordinates.length < 2
        ? `Bấm để thêm đỉnh tuyến (${coordinates.length}/2+)`
        : `Đang vẽ tuyến · ${coordinates.length} đỉnh`
    }
    return coordinates.length < 3
      ? `Bấm để vẽ đỉnh vùng (${coordinates.length}/3+)`
      : `Đang vẽ vùng · ${coordinates.length} đỉnh`
  }, [coordinates.length, geometryType, mode])

  const handleUndo = () => {
    if (coordinates.length === 0) return
    onChangeCoordinates(coordinates.slice(0, -1))
  }

  const handleClear = () => {
    onChangeCoordinates([])
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner ${
        mode === 'create' ? 'cursor-crosshair' : ''
      } ${className}`}
      aria-label="Bản đồ định vị đối tượng hạ tầng"
    >
      <MapContainer
        center={initialCenter}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          key={mapStyle}
          url={
            mapStyle === 'streets'
              ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
              : 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          }
          attribution={
            mapStyle === 'streets'
              ? '&copy; OpenStreetMap'
              : '&copy; Esri'
          }
          maxNativeZoom={19}
          maxZoom={21}
        />

        {mode === 'create' ? (
          <>
            {geometryType === 'LineString' && editableLatLngs.length >= 2 && (
              <Polyline
                positions={editableLatLngs}
                pathOptions={{ color: accentColor, weight: 4, opacity: 0.9 }}
              />
            )}

            {geometryType === 'Polygon' && editableLatLngs.length === 2 && (
              <Polyline
                positions={editableLatLngs}
                pathOptions={{ color: accentColor, weight: 2.5, dashArray: '6 5', opacity: 0.8 }}
              />
            )}

            {geometryType === 'Polygon' && editableLatLngs.length >= 3 && (
              <Polygon
                positions={editableLatLngs}
                pathOptions={{
                  color: accentColor,
                  weight: 2.5,
                  fillColor: accentColor,
                  fillOpacity: 0.22,
                }}
              />
            )}

            {geometryType === 'Point' && editableLatLngs[0] && (
              <>
                <CircleMarker
                  center={editableLatLngs[0]}
                  radius={13}
                  pathOptions={{
                    color: accentColor,
                    weight: 1.5,
                    fillColor: accentColor,
                    fillOpacity: 0.16,
                  }}
                />
                <CircleMarker
                  center={editableLatLngs[0]}
                  radius={6}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: accentColor,
                    fillOpacity: 1,
                  }}
                />
              </>
            )}

            {geometryType !== 'Point' &&
              editableLatLngs.map((pos, index) => (
                <CircleMarker
                  key={`${pos[0]}-${pos[1]}-${index}`}
                  center={pos}
                  radius={index === editableLatLngs.length - 1 ? 6 : 4.5}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: index === 0 ? '#0f172a' : accentColor,
                    fillOpacity: 1,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
                    Đỉnh {index + 1}
                  </Tooltip>
                </CircleMarker>
              ))}
          </>
        ) : (
          updateShapes && (
            <>
              {updateShapes.polygons.map((rings, index) => (
                <Polygon
                  key={`poly-${index}`}
                  positions={rings}
                  pathOptions={{
                    color: accentColor,
                    weight: 2.5,
                    fillColor: accentColor,
                    fillOpacity: 0.22,
                  }}
                />
              ))}
              {updateShapes.lines.map((line, index) => (
                <Polyline
                  key={`line-${index}`}
                  positions={line}
                  pathOptions={{ color: accentColor, weight: 4, opacity: 0.92 }}
                />
              ))}
              {updateShapes.points.map((pt, index) => (
                <CircleMarker
                  key={`pt-${index}`}
                  center={pt}
                  radius={7}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: accentColor,
                    fillOpacity: 1,
                  }}
                />
              ))}
            </>
          )
        )}

        <MapClickHandler
          enabled={mode === 'create'}
          geometryType={geometryType}
          coordinates={coordinates}
          onChangeCoordinates={onChangeCoordinates}
        />
        <MapViewportSync points={focusPoints} focusTrigger={focusTrigger} />
        <MapResizeController />
      </MapContainer>

      {/* Top floating bar: instruction + basemap toggle */}
      <div
        ref={topControlsRef}
        className="pointer-events-none absolute inset-x-2.5 top-2.5 z-[600] flex items-start justify-between gap-2"
      >
        <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span>{instructionText}</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-slate-200/90 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
          {(
            [
              ['streets', 'Bản đồ'],
              ['satellite', 'Vệ tinh'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMapStyle(key)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                mapStyle === key
                  ? 'bg-water-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom floating bar: live measurement + quick actions */}
      <div
        ref={bottomControlsRef}
        className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-[600] flex items-end justify-between gap-2"
      >
        <div className="pointer-events-auto">
          {mode === 'create' && geometryType === 'Point' && coordinates[0] && (
            <div className="rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur-sm">
              {coordinates[0][1].toFixed(5)}, {coordinates[0][0].toFixed(5)}
            </div>
          )}
          {mode === 'create' && geometryType === 'LineString' && lineLengthKm > 0 && (
            <div className="rounded-lg border border-water-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-water-800 shadow-sm backdrop-blur-sm">
              Chiều dài ước tính: {formatLengthLabel(lineLengthKm)}
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {focusPoints.length > 0 && (
            <button
              type="button"
              onClick={() => setFocusTrigger((n) => n + 1)}
              title="Căn giữa đối tượng trên bản đồ"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-slate-50"
            >
              <LocateFixed className="size-3.5 text-water-600" />
              Căn giữa
            </button>
          )}

          {mode === 'create' && geometryType !== 'Point' && coordinates.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              title="Hoàn tác đỉnh cuối"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="size-3" />
              Hoàn tác
            </button>
          )}

          {mode === 'create' && coordinates.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              title="Xóa tọa độ hiện tại"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white/95 px-2 py-1 text-[11px] font-semibold text-rose-600 shadow-sm backdrop-blur-sm transition hover:bg-rose-50"
            >
              <Trash2 className="size-3" />
              Xóa
            </button>
          )}

          {mode === 'create' && coordinates.length === 0 && onResetDefault && (
            <button
              type="button"
              onClick={onResetDefault}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1 text-[11px] font-semibold text-water-700 shadow-sm backdrop-blur-sm transition hover:bg-water-50"
            >
              Đặt điểm mẫu
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
