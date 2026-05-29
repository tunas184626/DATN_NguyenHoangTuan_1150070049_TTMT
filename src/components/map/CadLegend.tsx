import { Eye, EyeOff } from 'lucide-react'
import type { CadLabelVisibilityOptions } from '../../utils/textUtils'

type CadVisualMode = 'classic' | 'clean' | 'report' | 'water' | 'irrigation' | 'dark'
type LegendShape = 'point-strong' | 'point-water' | 'line-strong' | 'line-canal' | 'line-muted' | 'badge' | 'dash'

interface CadLegendProps {
  visible: boolean
  visibleLayers: Record<string, boolean>
  labelOptions: CadLabelVisibilityOptions
  visualMode?: CadVisualMode
  onToggle: () => void
}

const CAD_BASE_LAYER_KEY = '__baseCadLayer'
const CAD_HTCN_CONTEXT_LAYER_KEY = '__htcnPmvContext'
const CAD_CURATED_MAIN_WORKS_LAYER_KEY = '__curatedMainWorks'
const CAD_LAYOUT_ARTIFACT_LAYER_KEY = '__layoutArtifacts'

const LEGEND_ITEMS: Array<{
  key: string
  label: string
  color: string
  shape: LegendShape
  visible: (layers: Record<string, boolean>, labels: CadLabelVisibilityOptions) => boolean
}> = [
  {
    key: 'waterPlant',
    label: 'Nhà máy nước',
    color: '#f97316',
    shape: 'point-strong',
    visible: (layers) => layers[CAD_CURATED_MAIN_WORKS_LAYER_KEY] !== false,
  },
  {
    key: 'rawWaterLake',
    label: 'Hồ nước thô',
    color: '#38bdf8',
    shape: 'point-water',
    visible: (layers) => layers[CAD_CURATED_MAIN_WORKS_LAYER_KEY] !== false,
  },
  {
    key: 'pipeline',
    label: 'Tuyến ống cấp nước',
    color: '#2563eb',
    shape: 'line-strong',
    visible: (layers) => Object.entries(layers).some(([key, value]) => value !== false && key.toLowerCase().includes('pipe')),
  },
  {
    key: 'irrigation',
    label: 'Kênh/thủy lợi',
    color: '#0891b2',
    shape: 'line-canal',
    visible: (layers) =>
      Object.entries(layers).some(([key, value]) => value !== false && key.toLowerCase().includes('irrigation')),
  },
  {
    key: 'baseCad',
    label: 'Nền CAD gốc',
    color: '#64748b',
    shape: 'line-muted',
    visible: (layers) => layers[CAD_BASE_LAYER_KEY] !== false,
  },
  {
    key: 'diameter',
    label: 'Nhãn đường kính',
    color: '#8b5a91',
    shape: 'badge',
    visible: (_layers, labels) => labels.showDiameterLabels || labels.showAllLabels,
  },
  {
    key: 'htcnRaw',
    label: 'Dữ liệu HTCN gốc',
    color: '#9a6b4f',
    shape: 'line-muted',
    visible: (layers) => layers[CAD_HTCN_CONTEXT_LAYER_KEY] !== false,
  },
  {
    key: 'layoutArtifact',
    label: 'Khung/layout CAD',
    color: '#f59e0b',
    shape: 'dash',
    visible: (layers) => layers[CAD_LAYOUT_ARTIFACT_LAYER_KEY] !== false,
  },
]

const LEGEND_VISUAL_COLORS: Partial<Record<CadVisualMode, Partial<Record<string, string>>>> = {
  classic: {
    pipeline: '#2563eb',
    irrigation: '#0f9f8d',
    baseCad: '#8b9aa7',
  },
  report: {
    pipeline: '#1d4ed8',
    irrigation: '#0891b2',
    baseCad: '#94a3b8',
  },
  water: {
    pipeline: '#2563eb',
    irrigation: '#14b8a6',
    baseCad: '#cbd5e1',
  },
  irrigation: {
    pipeline: '#2563eb',
    irrigation: '#0d9488',
    baseCad: '#cbd5e1',
  },
  dark: {
    waterPlant: '#fb923c',
    rawWaterLake: '#38bdf8',
    pipeline: '#facc15',
    irrigation: '#22d3ee',
    baseCad: '#67e8f9',
  },
}

function getLegendColor(itemKey: string, fallback: string, visualMode: CadVisualMode): string {
  return LEGEND_VISUAL_COLORS[visualMode]?.[itemKey] ?? fallback
}

export function CadLegend({ visible, visibleLayers, labelOptions, visualMode = 'clean', onToggle }: CadLegendProps) {
  const visibleItems = LEGEND_ITEMS.filter((item) => item.visible(visibleLayers, labelOptions))

  return (
    <div className="cad-no-print absolute bottom-4 right-4 z-[800]">
      <button type="button" onClick={onToggle} className="cad-no-print ghost-btn mb-2 h-9 px-3">
        {visible ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
        Chú giải
      </button>

      {visible && (
        <div className="w-[230px] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg">
          <p className="mb-2 font-bold">Chú giải CAD Vector</p>
          <div className="space-y-2">
            {visibleItems.map((item) => {
              const color = getLegendColor(item.key, item.color, visualMode)

              return (
                <div key={item.key} className="flex items-center gap-2">
                  {item.shape === 'point-strong' && (
                    <span
                      className="inline-block size-3 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  {item.shape === 'point-water' && (
                    <span className="inline-block size-3 rounded-full border border-sky-900" style={{ backgroundColor: color }} />
                  )}
                  {item.shape === 'badge' && <span className="text-[10px] font-normal leading-none text-slate-700">OD...</span>}
                  {item.shape === 'line-canal' && <span className="inline-block h-0.5 w-8 rounded-full" style={{ backgroundColor: color }} />}
                  {item.shape === 'line-strong' && <span className="inline-block h-0.5 w-8 rounded-full" style={{ backgroundColor: color }} />}
                  {item.shape === 'line-muted' && <span className="inline-block h-px w-8 opacity-70" style={{ backgroundColor: color }} />}
                  {item.shape === 'dash' && (
                    <span className="inline-block h-0 w-8 border-t" style={{ borderColor: color, borderStyle: 'dashed' }} />
                  )}
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
