import type { AssetStatus, IncidentSeverity, IncidentWorkflowStatus } from '../../types/gis'
import {
  getAssetStatusMeta,
  getIncidentSeverityMeta,
  getIncidentStatusMeta,
} from '../../utils/status'

interface AssetStatusBadgeProps {
  status: AssetStatus
}

interface IncidentStatusBadgeProps {
  status: IncidentWorkflowStatus
}

interface IncidentSeverityBadgeProps {
  severity: IncidentSeverity
}

export function AssetStatusBadge({ status }: AssetStatusBadgeProps) {
  const meta = getAssetStatusMeta(status)
  return <span className={`status-chip ${meta.className}`}>{meta.label}</span>
}

export function IncidentStatusBadge({ status }: IncidentStatusBadgeProps) {
  const meta = getIncidentStatusMeta(status)
  return <span className={`status-chip ${meta.className}`}>{meta.label}</span>
}

export function IncidentSeverityBadge({ severity }: IncidentSeverityBadgeProps) {
  const meta = getIncidentSeverityMeta(severity)
  return <span className={`status-chip ${meta.className}`}>{meta.label}</span>
}