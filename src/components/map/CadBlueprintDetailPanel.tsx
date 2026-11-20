import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clock3,
  Compass,
  Copy,
  Droplets,
  Factory,
  FileImage,
  FileText,
  Gauge,
  Layers,
  Map as MapIcon,
  MapPin,
  Move,
  Ruler,
  Tag,
  Waves,
} from 'lucide-react'
import { CAD_BLUEPRINT_CONFIG } from '../../data/cadBlueprintAssets'
import type { AssetType, CadBlueprintAsset } from '../../types/gis'
import { LAYER_COLORS, mapFeatureTypeLabel } from '../../utils/asset'
import { getAssetStatusMeta } from '../../utils/status'

interface CadBlueprintDetailPanelProps {
  asset: CadBlueprintAsset
  cadEditMode: boolean
  onToggleCadEdit: () => void
  onReportIncident: (asset: CadBlueprintAsset) => void
}

const TYPE_ICONS: Record<AssetType, typeof Layers> = {
  water_plant: Factory,
  raw_water_lake: Waves,
  pipeline: Ruler,
  canal: Droplets,
  supply_zone: Layers,
  boundary: MapIcon,
  label: Tag,
  pending_data: Layers,
}

const GEOMETRY_LABELS: Record<CadBlueprintAsset['geometryType'], string> = {
  Point: 'Điểm (Point)',
  LineString: 'Tuyến (Polyline)',
  Polygon: 'Vùng (Polygon)',
}

function getCadAssetCenter(asset: CadBlueprintAsset): [number, number] {
  const coordinates = asset.geometryType === 'Point'
    ? (asset.cadPosition ? [asset.cadPosition] : [])
    : (asset.cadPath ?? [])

  if (!coordinates.length) {
    return [0, 0]
  }

  const sum = coordinates.reduce(
    (total, [y, x]) => ({
      y: total.y + y,
      x: total.x + x,
    }),
    { y: 0, x: 0 },
  )

  return [Math.round(sum.y / coordinates.length), Math.round(sum.x / coordinates.length)]
}

function formatDate(dateIso: string): string {
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) {
    return dateIso
  }
  return date.toLocaleDateString('vi-VN')
}

function isPendingValue(value: string): boolean {
  return value.trim().toLocaleLowerCase('vi').startsWith('chờ')
}

export function CadBlueprintDetailPanel({
  asset,
  cadEditMode,
  onToggleCadEdit,
  onReportIncident,
}: CadBlueprintDetailPanelProps) {
  const [copiedKey, setCopiedKey] = useState<'id' | 'coord' | null>(null)

  const statusMeta = getAssetStatusMeta(asset.status)
  const accentColor = LAYER_COLORS[asset.layerKey] ?? '#0284c7'
  const TypeIcon = TYPE_ICONS[asset.type] ?? Layers

  const [coordY, coordX] = asset.geometryType === 'Point' && asset.cadPosition
    ? asset.cadPosition
    : getCadAssetCenter(asset)
  const coordText = `[${coordY}, ${coordX}]`

  const technicalSpecs = [
    asset.capacity ? { key: 'capacity', label: 'Công suất', value: asset.capacity, icon: Gauge } : null,
    asset.diameter ? { key: 'diameter', label: 'Đường kính', value: asset.diameter, icon: Ruler } : null,
    asset.material ? { key: 'material', label: 'Vật liệu', value: asset.material, icon: Layers } : null,
    asset.length ? { key: 'length', label: 'Chiều dài', value: asset.length, icon: Ruler } : null,
    asset.area ? { key: 'area', label: 'Diện tích', value: asset.area, icon: MapIcon } : null,
    asset.volume ? { key: 'volume', label: 'Dung tích', value: asset.volume, icon: Waves } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const notes = asset.notes ?? []

  const handleCopy = async (key: 'id' | 'coord', value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 1300)
    } catch {
      // Clipboard unavailable in restricted contexts.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Colored Header Card */}
      <div className="shrink-0 border-b border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-water-50/55 px-4 pb-3 pt-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            <TypeIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-slate-900">{asset.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-slate-500">{mapFeatureTypeLabel(asset.type)}</span>
              <button
                type="button"
                onClick={() => void handleCopy('id', asset.id)}
                title="Sao chép mã đối tượng"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 transition hover:border-water-300 hover:text-water-800"
              >
                {asset.id}
                {copiedKey === 'id' ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-slate-400" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={`status-chip ${statusMeta.className}`}>{statusMeta.label}</span>
          <span className="status-chip border-teal-200 bg-teal-50 text-teal-800">
            {GEOMETRY_LABELS[asset.geometryType]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <Clock3 className="size-3 text-slate-400" />
            {formatDate(asset.lastUpdated)}
          </span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
        {cadEditMode && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 shadow-sm">
            <p className="font-bold">Chế độ chỉnh vị trí trên ảnh CAD đang bật</p>
            <p className="mt-0.5 leading-relaxed text-amber-800">
              Click trực tiếp lên bản vẽ CAD để cập nhật tọa độ ảnh <code className="font-mono font-bold">[y, x]</code> của đối tượng này.
            </p>
          </div>
        )}

        {/* Highlighted CAD Image Coordinates Card */}
        <section className="overflow-hidden rounded-xl border border-water-200 bg-gradient-to-br from-water-50/85 via-white to-sky-50/40 shadow-sm">
          <div className="flex items-center justify-between border-b border-water-100 bg-water-50/90 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-water-900">
              <Compass className="size-3.5 text-water-600" />
              Tọa độ ảnh CAD [y, x]
            </span>
            <button
              type="button"
              onClick={() => void handleCopy('coord', coordText)}
              className="inline-flex items-center gap-1 rounded-md border border-water-200 bg-white px-2 py-0.5 text-[11px] font-bold text-water-800 transition hover:bg-water-50"
            >
              {copiedKey === 'coord' ? (
                <>
                  <Check className="size-3 text-emerald-600" />
                  Đã copy
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  Copy tọa độ
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 p-2.5">
            <div className="rounded-lg border border-water-100 bg-white px-2.5 py-2">
              <p className="text-[11px] font-medium text-slate-500">Tọa độ Y (dọc)</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-water-900">{coordY}</p>
            </div>
            <div className="rounded-lg border border-water-100 bg-white px-2.5 py-2">
              <p className="text-[11px] font-medium text-slate-500">Tọa độ X (ngang)</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-water-900">{coordX}</p>
            </div>
          </div>

          {asset.geometryType !== 'Point' && asset.cadPath && asset.cadPath.length > 0 && (
            <div className="border-t border-water-100/80 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-water-800">
              Hiển thị tâm hình học từ <span className="font-bold">{asset.cadPath.length}</span> điểm đỉnh trên ảnh CAD.
            </div>
          )}
        </section>

        {/* Technical Specs Grid */}
        {technicalSpecs.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-emerald-200/75 bg-gradient-to-b from-emerald-50/45 to-white">
            <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/75 px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                Thông số công trình
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                {technicalSpecs.length} chỉ tiêu
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2.5">
              {technicalSpecs.map((spec) => {
                const SpecIcon = spec.icon
                const pending = isPendingValue(spec.value)
                return (
                  <div
                    key={spec.key}
                    className={`rounded-lg border px-2.5 py-2 ${
                      pending
                        ? 'border-amber-200/80 bg-amber-50/50'
                        : 'border-emerald-100 bg-white'
                    }`}
                  >
                    <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <SpecIcon className={`size-3 ${pending ? 'text-amber-500' : 'text-emerald-600'}`} />
                      {spec.label}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-bold ${
                        pending ? 'italic text-amber-800' : 'text-slate-900'
                      }`}
                    >
                      {spec.value}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* CAD Blueprint Source & Metadata Table */}
        <section className="overflow-hidden rounded-xl border border-indigo-200/70 bg-white">
          <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/70 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-900">
              <FileImage className="size-3.5 text-indigo-600" />
              Hồ sơ bản vẽ CAD
            </span>
            <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
              {asset.dataType}
            </span>
          </div>

          <dl className="divide-y divide-slate-100 text-xs">
            <div className="grid grid-cols-[108px_1fr] items-center gap-2 px-3 py-2">
              <dt className="font-medium text-slate-500">CAD Layer</dt>
              <dd className="truncate font-mono font-bold text-indigo-900" title={asset.cadLayer}>
                {asset.cadLayer}
              </dd>
            </div>
            <div className="grid grid-cols-[108px_1fr] items-center gap-2 px-3 py-2">
              <dt className="font-medium text-slate-500">Nguồn DWG</dt>
              <dd className="truncate font-semibold text-slate-800" title={asset.source}>
                {asset.source}
              </dd>
            </div>
            <div className="grid grid-cols-[108px_1fr] items-center gap-2 px-3 py-2">
              <dt className="font-medium text-slate-500">Ảnh nền</dt>
              <dd className="truncate font-mono text-[11px] text-slate-700" title={asset.backgroundImage ?? CAD_BLUEPRINT_CONFIG.imageFileName}>
                {asset.backgroundImage ?? CAD_BLUEPRINT_CONFIG.imageFileName}
              </dd>
            </div>
            <div className="grid grid-cols-[108px_1fr] items-start gap-2 px-3 py-2">
              <dt className="flex items-center gap-1 font-medium text-slate-500">
                <MapPin className="size-3 text-slate-400" />
                Vị trí
              </dt>
              <dd className="text-slate-700">{asset.address || 'Chưa cập nhật'}</dd>
            </div>
            {asset.description && (
              <div className="px-3 py-2.5">
                <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <FileText className="size-3" />
                  Mô tả công trình
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                  {asset.description}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* CAD Notes Card */}
        {notes.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/45">
            <div className="flex items-center justify-between border-b border-amber-200/60 bg-amber-50/90 px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Ghi chú CAD
              </span>
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {notes.length} mục
              </span>
            </div>
            <ul className="space-y-1.5 p-2.5">
              {notes.map((note, index) => (
                <li
                  key={`${asset.id}-note-${index}`}
                  className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-white/90 px-2.5 py-2 text-xs leading-relaxed text-slate-700"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{note}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Pinned Footer Actions */}
      <div className="shrink-0 border-t border-slate-200/80 bg-slate-50/95 px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleCadEdit}
            aria-pressed={cadEditMode}
            className={
              cadEditMode
                ? 'inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100'
                : 'primary-btn min-h-10 w-full justify-center gap-1.5 text-xs font-bold'
            }
          >
            <Move className="size-3.5 shrink-0" />
            <span className="truncate">{cadEditMode ? 'Dừng chỉnh vị trí' : 'Chỉnh vị trí'}</span>
          </button>

          <button
            type="button"
            onClick={() => onReportIncident(asset)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            Báo sự cố
          </button>
        </div>
      </div>
    </div>
  )
}
