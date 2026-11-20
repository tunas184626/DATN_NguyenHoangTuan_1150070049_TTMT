import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Droplets,
  ExternalLink,
  Factory,
  FileText,
  Gauge,
  Layers,
  Map as MapIcon,
  MapPin,
  PencilLine,
  Ruler,
  Tag,
  Waves,
} from 'lucide-react'
import type { AssetFeature, AssetType } from '../../types/gis'
import { assetTypeToLayerKey, LAYER_COLORS, mapFeatureTypeLabel } from '../../utils/asset'
import { getAssetStatusMeta } from '../../utils/status'
import { isLocalDraft } from '../../services/localDraftStore'

interface AssetDetailTabsProps {
  asset: AssetFeature
  onUpdate: (asset: AssetFeature) => void
  onReport: (asset: AssetFeature) => void
}

type AssetTab = 'information' | 'history'

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

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: value.includes('T') ? '2-digit' : undefined,
    minute: value.includes('T') ? '2-digit' : undefined,
  }).format(date)
}

export function AssetDetailTabs({ asset, onUpdate, onReport }: AssetDetailTabsProps) {
  const [tab, setTab] = useState<AssetTab>('information')
  const [copiedId, setCopiedId] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)

  const props = asset.properties
  const status = getAssetStatusMeta(props.status)
  const notes = props.notes ?? []
  const accentColor = LAYER_COLORS[assetTypeToLayerKey(props.type)]
  const TypeIcon = TYPE_ICONS[props.type] ?? Layers

  const technicalSpecs = [
    props.capacity ? { key: 'capacity', label: 'Công suất', value: props.capacity, icon: Gauge } : null,
    props.diameter ? { key: 'diameter', label: 'Đường kính', value: props.diameter, icon: Ruler } : null,
    props.material ? { key: 'material', label: 'Vật liệu', value: props.material, icon: Layers } : null,
    props.length ? { key: 'length', label: 'Chiều dài', value: props.length, icon: Ruler } : null,
    props.area ? { key: 'area', label: 'Diện tích', value: props.area, icon: MapIcon } : null,
    props.volume ? { key: 'volume', label: 'Dung tích', value: props.volume, icon: Waves } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const imageUrl = props.imageUrl?.trim() || ''
  const showImage = Boolean(imageUrl && failedImageUrl !== imageUrl)

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(props.id)
      setCopiedId(true)
      window.setTimeout(() => setCopiedId(false), 1500)
    } catch {
      // Clipboard unavailable in restricted contexts.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Colored Asset Summary Header */}
      <div className="shrink-0 border-b border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-water-50/50 px-4 pb-3 pt-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            <TypeIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-slate-900">{props.name}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {mapFeatureTypeLabel(props.type)}
              {props.assetCode ? ` · ${props.assetCode}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={`status-chip ${status.className}`}>{status.label}</span>
          {isLocalDraft(asset) && (
            <span className="status-chip border-amber-200 bg-amber-50 text-amber-700">
              Lưu trên thiết bị
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <Clock3 className="size-3 text-slate-400" />
            {formatDate(props.lastUpdated)}
          </span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div
        className="grid shrink-0 grid-cols-2 border-b border-slate-200 bg-slate-50/60 px-3 pt-1"
        role="tablist"
        aria-label="Chi tiết tài sản"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'information'}
          onClick={() => setTab('information')}
          className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition ${
            tab === 'information'
              ? 'border-water-600 text-water-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="size-3.5" />
          <span>Thông tin</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          onClick={() => setTab('history')}
          className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition ${
            tab === 'history'
              ? 'border-water-600 text-water-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock3 className="size-3.5" />
          <span>Lịch sử &amp; Ghi chú</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              notes.length > 0
                ? 'bg-water-100 text-water-800'
                : 'bg-slate-200/70 text-slate-500'
            }`}
          >
            {notes.length}
          </span>
        </button>
      </div>

      {/* Scrollable Content */}
      {tab === 'information' ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5" role="tabpanel">
          {/* Ảnh minh họa */}
          {showImage && (
            <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
              <img
                src={imageUrl}
                alt={props.name}
                onError={() => setFailedImageUrl(imageUrl)}
                className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg border border-white/40 bg-slate-900/75 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-slate-900"
              >
                Xem ảnh <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          {/* Thông số kỹ thuật nổi bật */}
          {technicalSpecs.length > 0 && (
            <section className="rounded-xl border border-water-200/80 bg-gradient-to-br from-water-50/75 to-white p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-water-900">
                Thông số kỹ thuật
              </p>
              <div className={`grid gap-2 ${technicalSpecs.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {technicalSpecs.map((spec) => {
                  const SpecIcon = spec.icon
                  return (
                    <div
                      key={spec.key}
                      className="rounded-lg border border-water-100 bg-white px-2.5 py-2 shadow-sm"
                    >
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        <SpecIcon className="size-3 text-water-600" />
                        <span>{spec.label}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-bold text-slate-900">{spec.value}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Vị trí & Mô tả */}
          <section className="space-y-2.5 rounded-xl border border-slate-200/80 bg-white p-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <MapPin className="size-3.5 text-water-600" />
                  Vị trí
                </span>
                {props.googleMapsUrl && (
                  <a
                    href={props.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-water-200 bg-water-50 px-2 py-0.5 text-[11px] font-semibold text-water-800 transition hover:bg-water-100"
                  >
                    Google Maps
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {props.address || 'Chưa cập nhật địa chỉ'}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-2.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Mô tả công trình
              </span>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {props.description || 'Chưa có mô tả chi tiết.'}
              </p>
            </div>
          </section>

          {/* Ghi chú gần đây (preview nhanh) */}
          <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Ghi chú gần nhất ({notes.length})
              </span>
              {notes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('history')}
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-800 hover:underline"
                >
                  Xem tất cả <ArrowRight className="size-3" />
                </button>
              )}
            </div>
            {notes.length > 0 ? (
              <div className="space-y-1.5">
                {notes.slice(0, 2).map((note, index) => (
                  <p
                    key={`${props.id}-preview-${index}`}
                    className="rounded-lg border border-amber-100 bg-white px-2.5 py-1.5 text-xs leading-relaxed text-slate-700"
                  >
                    {note}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-800/80">
                Chưa có ghi chú vận hành. Dùng nút Cập nhật bên dưới để bổ sung.
              </p>
            )}
          </section>

          {/* Thông tin kỹ thuật hệ thống */}
          <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-500">
              Thông tin hệ thống
            </summary>
            <dl className="mt-2.5 space-y-2 border-t border-slate-200/70 pt-2.5 text-xs text-slate-600">
              <div className="flex items-center justify-between gap-2">
                <dt className="font-semibold text-slate-500">Mã tài sản</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-[11px] text-slate-700">{props.id}</span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    title="Sao chép mã tài sản"
                    className="rounded border border-slate-200 bg-white p-1 text-slate-500 hover:text-water-700"
                  >
                    {copiedId ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  </button>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="font-semibold text-slate-500">Kiểu hình học</dt>
                <dd className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                  {asset.geometry.type}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="font-semibold text-slate-500">Cập nhật lần cuối</dt>
                <dd className="font-medium text-slate-700">{formatDate(props.lastUpdated)}</dd>
              </div>
            </dl>
          </details>
        </div>
      ) : (
        /* TAB LỊCH SỬ & GHI CHÚ */
        <div className="min-h-0 flex-1 overflow-y-auto p-3.5" role="tabpanel">
          <div className="mb-3 rounded-xl border border-water-200/80 bg-water-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-water-900">
                <Clock3 className="size-3.5 text-water-700" />
                Cập nhật hồ sơ gần nhất
              </span>
              <span className="text-[11px] font-semibold text-water-800">
                {formatDate(props.lastUpdated)}
              </span>
            </div>
          </div>

          {notes.length > 0 ? (
            <ol className="relative ml-2.5 space-y-2.5 border-l-2 border-slate-200 pl-4">
              {notes.map((note, index) => (
                <li key={`${props.id}-${index}`} className="relative">
                  <span
                    className={`absolute -left-[23px] top-2.5 size-3 rounded-full ring-4 ring-white ${
                      index === 0 ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  />
                  <div className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Ghi chú #{notes.length - index}</span>
                      {index === 0 && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
                          Mới nhất
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">{note}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
              <p className="text-sm font-medium text-slate-600">Chưa có ghi chú bảo trì</p>
              <p className="mt-1 text-xs text-slate-500">
                Các ghi chú kiểm tra và bảo dưỡng sẽ được liệt kê theo dòng thời gian tại đây.
              </p>
              <button
                type="button"
                onClick={() => onUpdate(asset)}
                className="ghost-btn mt-3 !py-1.5 !text-xs"
              >
                <PencilLine className="mr-1 size-3.5" />
                Thêm ghi chú ngay
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pinned Action Footer */}
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5">
        <button type="button" onClick={() => onUpdate(asset)} className="primary-btn !py-2">
          <PencilLine className="mr-1.5 size-4" />
          Cập nhật
        </button>
        <button
          type="button"
          onClick={() => onReport(asset)}
          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
          <AlertTriangle className="mr-1.5 size-4" />
          Báo sự cố
        </button>
      </div>
    </div>
  )
}
