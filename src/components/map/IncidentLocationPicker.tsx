import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { MapResizeController } from './MapResizeController'

interface Props {
  className?: string
  position: [number, number] | null
  onChange: (position: [number, number]) => void
}

function PickLocation({ onChange }: Pick<Props, 'onChange'>) {
  const map = useMapEvents({ click: (event) => {
    const point = map.wrapLatLng(event.latlng)
    onChange([point.lat, point.lng])
  } })
  return null
}

function CenterLocation({ position }: Pick<Props, 'position'>) {
  const map = useMap()
  const latitude = position?.[0]
  const longitude = position?.[1]
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) map.panTo([latitude, longitude], { animate: false })
  }, [latitude, longitude, map])
  return null
}

export function IncidentLocationPicker({ position, onChange, className = 'h-56' }: Props) {
  return (
    <div className={`${className} overflow-hidden rounded-lg border border-slate-200`} aria-label="Bản đồ chọn vị trí sự cố">
      <MapContainer center={position ?? [10.8845, 106.4255]} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {position && <CircleMarker center={position} radius={7} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.8 }} />}
        <PickLocation onChange={onChange} />
        <CenterLocation position={position} />
        <MapResizeController />
      </MapContainer>
    </div>
  )
}
