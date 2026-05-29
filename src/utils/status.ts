import type {
  AssetStatus,
  IncidentSeverity,
  IncidentType,
  IncidentWorkflowStatus,
} from '../types/gis'

interface BadgeMeta {
  label: string
  className: string
}

export const ASSET_STATUS_META: Record<AssetStatus, BadgeMeta> = {
  active: {
    label: 'Đang hoạt động',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  maintenance: {
    label: 'Bảo trì',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  need_inspection: {
    label: 'Cần kiểm tra',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  pending_data: {
    label: 'Chờ bổ sung dữ liệu',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

export const INCIDENT_STATUS_META: Record<IncidentWorkflowStatus, BadgeMeta> = {
  new: {
    label: 'Mới ghi nhận',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  in_progress: {
    label: 'Đang xử lý',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  resolved: {
    label: 'Đã xử lý',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

export const INCIDENT_SEVERITY_META: Record<IncidentSeverity, BadgeMeta> = {
  low: {
    label: 'Thấp',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  medium: {
    label: 'Trung bình',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  high: {
    label: 'Cao',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  leak: 'Rò rỉ',
  pressure_loss: 'Mất áp',
  pipe_burst: 'Vỡ ống',
  turbid_water: 'Nước đục',
  need_inspection: 'Cần kiểm tra',
}

export function getAssetStatusMeta(status: AssetStatus): BadgeMeta {
  return ASSET_STATUS_META[status]
}

export function getIncidentStatusMeta(status: IncidentWorkflowStatus): BadgeMeta {
  return INCIDENT_STATUS_META[status]
}

export function getIncidentSeverityMeta(severity: IncidentSeverity): BadgeMeta {
  return INCIDENT_SEVERITY_META[severity]
}

export function formatIncidentType(type: IncidentType): string {
  return INCIDENT_TYPE_LABELS[type]
}

export function workflowStatusToAssetStatus(status: IncidentWorkflowStatus): AssetStatus {
  switch (status) {
    case 'new':
      return 'need_inspection'
    case 'in_progress':
      return 'maintenance'
    case 'resolved':
      return 'active'
  }
}
