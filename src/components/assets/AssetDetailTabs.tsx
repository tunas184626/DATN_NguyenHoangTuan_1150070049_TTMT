import { useState } from 'react'
import { AlertTriangle, Clock3, MapPin, PencilLine } from 'lucide-react'
import type { AssetFeature } from '../../types/gis'
import { mapFeatureTypeLabel } from '../../utils/asset'
import { getAssetStatusMeta } from '../../utils/status'
import { isLocalDraft } from '../../services/localDraftStore'

interface AssetDetailTabsProps {
  asset: AssetFeature
  onUpdate: (asset: AssetFeature) => void
  onReport: (asset: AssetFeature) => void
}

type AssetTab = 'information' | 'history'

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
  const status = getAssetStatusMeta(asset.properties.status)
  const notes = asset.properties.notes ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <p className="truncate text-lg font-bold text-slate-800">{asset.properties.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">{mapFeatureTypeLabel(asset.properties.type)}</span>
          <span className={`status-chip ${status.className}`}>{status.label}</span>
          {isLocalDraft(asset) && <span className="status-chip border-amber-200 bg-amber-50 text-amber-700">Lưu trên thiết bị</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-slate-200 px-4" role="tablist" aria-label="Chi tiết tài sản">
        {([
          ['information', 'Thông tin'],
          ['history', 'Lịch sử'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${
              tab === value
                ? 'border-water-600 text-water-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'information' ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4" role="tabpanel">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vị trí</dt>
              <dd className="mt-1 text-slate-700">{asset.properties.address || 'Chưa cập nhật'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mô tả</dt>
              <dd className="mt-1 leading-relaxed text-slate-700">{asset.properties.description || 'Chưa có mô tả'}</dd>
            </div>
            {asset.properties.capacity && <div><dt className="text-xs font-semibold text-slate-400">CÔNG SUẤT</dt><dd className="mt-1 text-slate-700">{asset.properties.capacity}</dd></div>}
            {asset.properties.area && <div><dt className="text-xs font-semibold text-slate-400">DIỆN TÍCH</dt><dd className="mt-1 text-slate-700">{asset.properties.area}</dd></div>}
            {asset.properties.volume && <div><dt className="text-xs font-semibold text-slate-400">DUNG TÍCH</dt><dd className="mt-1 text-slate-700">{asset.properties.volume}</dd></div>}
            {asset.properties.diameter && <div><dt className="text-xs font-semibold text-slate-400">ĐƯỜNG KÍNH</dt><dd className="mt-1 text-slate-700">{asset.properties.diameter}</dd></div>}
            {asset.properties.material && <div><dt className="text-xs font-semibold text-slate-400">VẬT LIỆU</dt><dd className="mt-1 text-slate-700">{asset.properties.material}</dd></div>}
            {asset.properties.length && <div><dt className="text-xs font-semibold text-slate-400">CHIỀU DÀI</dt><dd className="mt-1 text-slate-700">{asset.properties.length}</dd></div>}
          </dl>

          {asset.properties.imageUrl && (
            <img src={asset.properties.imageUrl} alt={asset.properties.name} className="h-44 w-full rounded-xl object-cover" />
          )}

          {asset.properties.googleMapsUrl && (
            <a
              href={asset.properties.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-sm font-semibold text-water-700 hover:underline"
            >
              <MapPin className="mr-1 size-4" /> Mở vị trí trên bản đồ
            </a>
          )}

          <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-600">Thông tin bổ sung</summary>
            <dl className="mt-3 space-y-2 text-xs text-slate-600">
              <div><dt className="inline font-semibold">Mã tài sản: </dt><dd className="inline break-all">{asset.properties.id}</dd></div>
              <div><dt className="inline font-semibold">Cập nhật: </dt><dd className="inline">{formatDate(asset.properties.lastUpdated)}</dd></div>
              <div><dt className="inline font-semibold">Kiểu vị trí: </dt><dd className="inline">{asset.geometry.type}</dd></div>
            </dl>
          </details>

          <div className="sticky bottom-0 flex flex-wrap gap-2 bg-white py-2">
            <button type="button" onClick={() => onUpdate(asset)} className="primary-btn">
              <PencilLine className="mr-1 size-4" /> Cập nhật
            </button>
            <button type="button" onClick={() => onReport(asset)} className="ghost-btn">
              <AlertTriangle className="mr-1 size-4" /> Báo sự cố
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4" role="tabpanel">
          <ol className="relative ml-2 border-l border-water-100 pl-5">
            <li className="relative pb-5">
              <span className="absolute -left-[29px] top-0.5 flex size-4 items-center justify-center rounded-full bg-water-100 ring-4 ring-white">
                <Clock3 className="size-2.5 text-water-700" />
              </span>
              <p className="text-sm font-semibold text-slate-700">Cập nhật thông tin tài sản</p>
              <p className="mt-0.5 text-xs text-slate-400">{formatDate(asset.properties.lastUpdated)}</p>
            </li>
            {notes.map((note, index) => (
              <li key={`${asset.properties.id}-${index}`} className="relative pb-5 last:pb-0">
                <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-slate-300 ring-4 ring-white" />
                <p className="text-sm leading-relaxed text-slate-700">{note}</p>
              </li>
            ))}
          </ol>
          {notes.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              Chưa có ghi chú bảo trì. Các lần cập nhật tiếp theo sẽ xuất hiện tại đây.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
