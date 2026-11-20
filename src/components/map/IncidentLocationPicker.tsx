import { useEffect, useRef, useState } from 'react'
import { DomEvent } from 'leaflet'
import { Crosshair, LocateFixed } from 'lucide-react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { MapResizeController } from './MapResizeController'

interface Props {
  className?: string
  position: [number, number] | null
  onChange: (position: [number, number]) => void
}

type PickerBasemap = 'streets' | 'satellite'

function PickLocation({ onChange }: Pick<Props, 'onChange'>) {
  const map = useMapEvents({
    click: (event) => {
      const point = map.wrapLatLng(event.latlng)
      onChange([point.lat, point.lng])
    },
  })
  return null
}

function CenterLocation({
  position,
  focusTrigger,
}: {
  position: [number, number] | null
  focusTrigger: number
}) {
  const map = useMap()
  const latitude = position?.[0]
  const longitude = position?.[1]

  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      map.panTo([latitude, longitude], { animate: focusTrigger > 0 })
    }
  }, [latitude, longitude, focusTrigger, map])

  return null
}

export function IncidentLocationPicker({ position, onChange, className = 'h-56' }: Props) {
  const [mapStyle, setMapStyle] = useState<PickerBasemap>('streets')
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [locating, setLocating] = useState(false)
  const [geoMessage, setGeoMessage] = useState('')
  const topControlsRef = useRef<HTMLDivElement>(null)
  const bottomControlsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    for (const el of [topControlsRef.current, bottomControlsRef.current]) {
      if (!el) continue
      DomEvent.disableClickPropagation(el)
      DomEvent.disableScrollPropagation(el)
    }
  }, [])

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage('Trình duyệt không hỗ trợ định vị GPS.')
      return
    }
    setLocating(true)
    setGeoMessage('')
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLocating(false)
        onChange([result.coords.latitude, result.coords.longitude])
        setFocusTrigger((count) => count + 1)
      },
      () => {
        setLocating(false)
        setGeoMessage('Không thể lấy vị trí thiết bị. Hãy bấm trực tiếp trên bản đồ.')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner cursor-crosshair ${className}`}
      aria-label="Bản đồ chọn vị trí sự cố"
    >
      <MapContainer
        center={position ?? [10.8845, 106.4255]}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          key={mapStyle}
          attribution={
            mapStyle === 'streets'
              ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              : '&copy; Esri'
          }
          url={
            mapStyle === 'streets'
              ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              : 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          }
          maxNativeZoom={19}
          maxZoom={21}
        />
        {position && (
          <>
            <CircleMarker
              center={position}
              radius={15}
              pathOptions={{ color: '#dc2626', weight: 1.5, fillColor: '#dc2626', fillOpacity: 0.16 }}
            />
            <CircleMarker
              center={position}
              radius={6.5}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }}
            />
          </>
        )}
        <PickLocation onChange={onChange} />
        <CenterLocation position={position} focusTrigger={focusTrigger} />
        <MapResizeController />
      </MapContainer>

      {/* Top floating bar */}
      <div
        ref={topControlsRef}
        className="pointer-events-none absolute inset-x-2.5 top-2.5 z-[600] flex items-start justify-between gap-2"
      >
        <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
          <span
            className={`size-2 shrink-0 rounded-full ${position ? 'bg-rose-600' : 'bg-amber-500'}`}
          />
          <span>
            {position ? 'Đã ghim vị trí · bấm điểm khác để dời' : 'Bấm trực tiếp vào điểm xảy ra sự cố'}
          </span>
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
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom floating bar */}
      <div
        ref={bottomControlsRef}
        className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-[600] flex items-end justify-between gap-2"
      >
        <div className="pointer-events-auto">
          {geoMessage && (
            <span className="inline-block rounded-lg border border-amber-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-amber-800 shadow-sm backdrop-blur-sm">
              {geoMessage}
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {position && (
            <button
              type="button"
              onClick={() => setFocusTrigger((count) => count + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-slate-50"
            >
              <LocateFixed className="size-3.5 text-teal-700" />
              Căn giữa
            </button>
          )}
          <button
            type="button"
            disabled={locating}
            onClick={handleUseMyLocation}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Crosshair className="size-3.5 text-teal-700" />
            {locating ? 'Đang định vị...' : 'Vị trí GPS'}
          </button>
        </div>
      </div>
    </div>
  )
}
