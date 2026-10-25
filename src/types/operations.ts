import type { AnyMapFeature, AssetStatus, AssetType, IncidentWorkflowStatus } from './gis'

export type WorkspaceTab = 'assets' | 'incidents'
export type WorkspaceStatus = 'all' | AssetStatus | IncidentWorkflowStatus
export type IncidentWorkQueue = 'unassigned' | 'overdue' | 'high_priority' | 'in_progress'
export type AssetQualityFilter = 'technical' | 'address' | 'inspection' | 'maintenance'

export interface AssetQualitySummary {
  total: number
  technical: number
  address: number
  inspection: number
  maintenance: number
  generatedAt: string
}

export interface OperationsSummary {
  assets: number
  incidents: number
  openIncidents: number
  overdueIncidents: number
  highPriorityIncidents: number
  unassignedIncidents: number
  inProgressIncidents: number
  generatedAt: string
}

export interface FeaturePage<T = AnyMapFeature> {
  type: 'FeatureCollection'
  features: T[]
  meta: { total: number; limit: number; offset: number }
}

export interface OperationsFilters {
  tab: WorkspaceTab
  search: string
  status: WorkspaceStatus
  type: 'all' | AssetType
  page: number
  pageSize: number
  queue?: IncidentWorkQueue
  quality?: AssetQualityFilter
}
