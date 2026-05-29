import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CadVectorFeature, CadVectorType } from '../../types/gis'
import { getFeatureDisplayName, safeDisplayText } from '../../utils/textUtils'

export interface TooltipMousePosition {
  clientX: number
  clientY: number
}

interface FloatingFeatureTooltipProps {
  feature: CadVectorFeature | null
  mousePosition: TooltipMousePosition | null
  mapContainerRect: DOMRect | null
  visible: boolean
}

const OFFSET = 22
const EDGE_PADDING = 12
const FALLBACK_WIDTH = 240
const FALLBACK_HEIGHT = 82

function typeLabel(type: CadVectorType): string {
  switch (type) {
    case 'water_plant':
      return 'Nhà máy nước'
    case 'raw_water_lake':
      return 'Hồ nước thô'
    case 'pipeline':
      return 'Tuyến ống cấp nước'
    case 'canal':
      return 'Kênh/sông'
    case 'irrigation_canal':
      return 'Kênh thủy lợi'
    case 'irrigation_area':
      return 'Vùng thủy lợi'
    case 'irrigation_point':
      return 'Điểm thủy lợi'
    case 'irrigation_label':
      return 'Nhãn kênh/thủy lợi'
    case 'main_work_candidate':
      return 'Công trình chính'
    case 'boundary':
      return 'Ranh giới'
    case 'supply_zone':
      return 'Khu vực cấp nước'
    case 'pipe_diameter_label':
      return 'Nhãn đường kính ống'
    case 'location_label':
      return 'Nhãn địa danh'
    case 'layout_artifact':
      return 'Khung/layout CAD'
    case 'road_background':
      return 'Đường nền CAD'
    case 'cad_point':
      return 'Điểm CAD'
    case 'cad_line':
      return 'Đường CAD'
    case 'cad_polygon':
      return 'Vùng CAD'
    case 'unknown':
      return 'Chưa phân loại'
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function FloatingFeatureTooltip({
  feature,
  mousePosition,
  mapContainerRect,
  visible,
}: FloatingFeatureTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipSize, setTooltipSize] = useState({ width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT })

  useLayoutEffect(() => {
    if (!tooltipRef.current || !visible) {
      return
    }

    const rect = tooltipRef.current.getBoundingClientRect()
    setTooltipSize({
      width: Math.min(Math.ceil(rect.width), FALLBACK_WIDTH),
      height: Math.ceil(rect.height),
    })
  }, [feature, visible])

  const position = useMemo(() => {
    if (!mousePosition || !mapContainerRect) {
      return { left: EDGE_PADDING, top: EDGE_PADDING }
    }

    const mouseX = mousePosition.clientX - mapContainerRect.left
    const mouseY = mousePosition.clientY - mapContainerRect.top
    let left = mouseX + OFFSET
    let top = mouseY + OFFSET

    if (left + tooltipSize.width > mapContainerRect.width - EDGE_PADDING) {
      left = mouseX - tooltipSize.width - OFFSET
    }

    if (top + tooltipSize.height > mapContainerRect.height - EDGE_PADDING) {
      top = mouseY - tooltipSize.height - OFFSET
    }

    return {
      left: clamp(left, EDGE_PADDING, Math.max(EDGE_PADDING, mapContainerRect.width - tooltipSize.width - EDGE_PADDING)),
      top: clamp(top, EDGE_PADDING, Math.max(EDGE_PADDING, mapContainerRect.height - tooltipSize.height - EDGE_PADDING)),
    }
  }, [mapContainerRect, mousePosition, tooltipSize])

  if (!visible || !feature || !mousePosition || !mapContainerRect) {
    return null
  }

  const title = getFeatureDisplayName(feature)

  return (
    <div
      ref={tooltipRef}
      className="absolute z-[1000] max-w-[240px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-800 shadow-lg backdrop-blur"
      style={{
        left: position.left,
        top: position.top,
        pointerEvents: 'none',
        whiteSpace: 'normal',
      }}
    >
      <p className="mb-1 truncate font-bold text-slate-900">{title}</p>
      <div className="space-y-0.5">
        <p>
          <span className="font-semibold text-slate-500">Loại:</span> {typeLabel(feature.properties.type)}
        </p>
        <p>
          <span className="font-semibold text-slate-500">Layer:</span>{' '}
          {safeDisplayText(feature.properties.cadLayer, 'Không có')}
        </p>
      </div>
    </div>
  )
}
