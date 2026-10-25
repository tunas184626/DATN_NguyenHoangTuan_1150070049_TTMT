import { useEffect, useRef, useState } from 'react'
import { DomEvent } from 'leaflet'
import { Settings2 } from 'lucide-react'
import { TileLayer, useMapEvents } from 'react-leaflet'

type BaseMapStyle = 'streets' | 'satellite'

function initialStyle(): BaseMapStyle {
  try { return localStorage.getItem('webgis-basemap-v1') === 'satellite' ? 'satellite' : 'streets' }
  catch { return 'streets' }
}

export function GeographicBaseMap({ focusEnabled, onOpenSettings }: { focusEnabled: boolean; onOpenSettings: () => void }) {
  const [style, setStyle] = useState<BaseMapStyle>(initialStyle)
  const [tileError, setTileError] = useState(false)
  const controls = useRef<HTMLDivElement>(null)
  const [googleUrl, setGoogleUrl] = useState('https://www.google.com/maps/@10.8845,106.4255,13z')
  const map = useMapEvents({ moveend: () => {
    const center = map.getCenter().wrap()
    setGoogleUrl(`https://www.google.com/maps/@${center.lat.toFixed(6)},${center.lng.toFixed(6)},${Math.round(map.getZoom())}z`)
  } })

  useEffect(() => {
    if (!controls.current) return
    DomEvent.disableClickPropagation(controls.current)
    DomEvent.disableScrollPropagation(controls.current)
  }, [])

  const changeStyle = (value: BaseMapStyle) => {
    setStyle(value)
    setTileError(false)
    try { localStorage.setItem('webgis-basemap-v1', value) } catch { /* The map works without storage. */ }
  }

  return <>
    <TileLayer key={style}
      url={style === 'streets'
        ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}
      attribution={style === 'streets'
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        : 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community'}
      maxNativeZoom={19} maxZoom={21} updateWhenIdle keepBuffer={2}
      eventHandlers={{ tileerror: () => setTileError(true) }}
    />
    <div ref={controls} className="absolute right-3 top-3 z-[800] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Bản đồ nền">
        {([['streets', 'Đường phố'], ['satellite', 'Vệ tinh']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={style === key} onClick={() => changeStyle(key)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${style === key ? 'bg-water-50 text-water-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            {label}
          </button>
        ))}
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="rounded-md px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100" title="Mở khu vực đang xem trong Google Maps">Google Maps ↗</a>
        <button type="button" onClick={onOpenSettings} aria-label="Thiết lập bản đồ" title="Thiết lập bản đồ" className={`flex items-center gap-1.5 rounded-md border-l border-slate-200 px-2.5 py-2 text-xs font-semibold ${focusEnabled ? 'bg-water-50 text-water-800' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Settings2 className="size-3.5" /><span>{focusEnabled ? 'Focus' : 'Thiết lập'}</span>
        </button>
      </div>
      {tileError && <p role="status" className="max-w-xs rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800">
        Một số ô bản đồ nền chưa tải được. Kiểm tra kết nối hoặc đổi nền.
      </p>}
    </div>
  </>
}
