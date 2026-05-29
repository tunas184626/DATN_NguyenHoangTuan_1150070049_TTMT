import type { Geometry, Point } from 'geojson'

export type AssetType =
  | 'water_plant'
  | 'raw_water_lake'
  | 'pipeline'
  | 'canal'
  | 'supply_zone'
  | 'boundary'
  | 'label'
  | 'pending_data'

export type AssetStatus =
  | 'active'
  | 'maintenance'
  | 'need_inspection'
  | 'pending_data'

export type IncidentType =
  | 'leak'
  | 'pressure_loss'
  | 'pipe_burst'
  | 'turbid_water'
  | 'need_inspection'

export type IncidentSeverity = 'low' | 'medium' | 'high'

export type IncidentWorkflowStatus = 'new' | 'in_progress' | 'resolved'

export type GeometryInputType = 'Point' | 'LineString' | 'Polygon'

export type StatusFilter = 'all' | AssetStatus

export interface BaseFeatureProperties {
  id: string
  name: string
  type: AssetType | 'incident'
  status: string
  description: string
  address: string
  capacity?: string
  area?: string
  volume?: string
  material?: string
  diameter?: string
  length?: string
  source?: string
  cadLayer?: string
  sourceLayer?: string
  imageUrl?: string
  googleMapsUrl?: string
  lastUpdated: string
  notes: string[]
}

export interface AssetProperties extends BaseFeatureProperties {
  type: AssetType
  status: AssetStatus
}

export interface IncidentProperties
  extends Omit<
    BaseFeatureProperties,
    'type' | 'status' | 'capacity' | 'area' | 'volume' | 'material'
  > {
  type: 'incident'
  status: IncidentWorkflowStatus
  incidentCode: string
  incidentType: IncidentType
  severity: IncidentSeverity
  reportedDate: string
}

export interface GISFeature<
  TProperties extends BaseFeatureProperties,
  TGeometry extends Geometry,
> {
  type: 'Feature'
  geometry: TGeometry
  properties: TProperties
}

export interface GISFeatureCollection<
  TProperties extends BaseFeatureProperties,
  TGeometry extends Geometry,
> {
  type: 'FeatureCollection'
  features: Array<GISFeature<TProperties, TGeometry>>
}

export type AssetFeature = GISFeature<AssetProperties, Geometry>
export type IncidentFeature = GISFeature<IncidentProperties, Point>
export type AnyMapFeature = AssetFeature | IncidentFeature

export type AssetCollection = GISFeatureCollection<AssetProperties, Geometry>
export type WaterPlantCollection = AssetCollection
export type RawWaterLakeCollection = AssetCollection
export type PipelineCollection = AssetCollection
export type CanalCollection = AssetCollection
export type SupplyZoneCollection = AssetCollection
export type BoundaryCollection = AssetCollection
export type LabelCollection = AssetCollection
export type IncidentCollection = GISFeatureCollection<IncidentProperties, Point>

export interface LayerDataState {
  waterPlant: WaterPlantCollection
  rawWaterLakes: RawWaterLakeCollection
  pipelines: PipelineCollection
  canals: CanalCollection
  supplyZones: SupplyZoneCollection
  boundaries: BoundaryCollection
  labels: LabelCollection
  incidents: IncidentCollection
}

export type LayerKey = keyof LayerDataState

export interface LayerConfig {
  key: LayerKey
  label: string
  color: string
  visible: boolean
}

export type DataSourceMode = 'cad' | 'demo'

export type LayerLoadStatus =
  | 'cad_loaded'
  | 'cad_empty'
  | 'cad_missing'
  | 'cad_error'
  | 'mock'

export interface LayerSourceMeta {
  layerKey: LayerKey
  label: string
  source: 'cad' | 'mock'
  status: LayerLoadStatus
  featureCount: number
  url?: string
  message?: string
}

export interface DataSourceState {
  mode: DataSourceMode
  label: string
  usingCad: boolean
  layers: Record<LayerKey, LayerSourceMeta>
}

export interface NewAssetInput {
  name: string
  type: AssetType
  status: AssetStatus
  description: string
  address: string
  capacity?: string
  area?: string
  volume?: string
  material?: string
  diameter?: string
  length?: string
  imageUrl?: string
  googleMapsUrl?: string
  notes: string[]
  geometryType: GeometryInputType
  coordinates: [number, number][]
}

export interface UpdateAssetInput {
  name: string
  status: AssetStatus
  description: string
  address: string
  capacity?: string
  area?: string
  volume?: string
  material?: string
  diameter?: string
  length?: string
  imageUrl?: string
  googleMapsUrl?: string
  notes: string[]
}

export interface NewIncidentInput {
  name: string
  incidentCode: string
  incidentType: IncidentType
  severity: IncidentSeverity
  status: IncidentWorkflowStatus
  description: string
  address: string
  reportedDate: string
  googleMapsUrl?: string
  imageUrl?: string
  notes: string[]
  latitude: number
  longitude: number
}

export interface ObjectListItem {
  id: string
  name: string
  typeLabel: string
  statusLabel: string
  status: string
  layerKey: LayerKey
  meta?: string
}

export interface SearchItem {
  id: string
  label: string
  keywords: string[]
  layerKey: LayerKey
}

export type ViewMode = 'map' | 'manage' | 'report'

export type MapMode = 'cadVector' | 'layoutPreview' | 'cadImage' | 'osm'

export type CadVectorType =
  | 'water_plant'
  | 'raw_water_lake'
  | 'pipeline'
  | 'canal'
  | 'irrigation_canal'
  | 'irrigation_area'
  | 'irrigation_point'
  | 'irrigation_label'
  | 'main_work_candidate'
  | 'boundary'
  | 'supply_zone'
  | 'pipe_diameter_label'
  | 'location_label'
  | 'layout_artifact'
  | 'road_background'
  | 'cad_point'
  | 'cad_line'
  | 'cad_polygon'
  | 'unknown'

export type CadVectorSourceGroup = 'cad_base' | 'irrigation' | 'main_works' | 'unknown'

export interface CadVectorProperties {
  id: string
  name: string
  type: CadVectorType
  status: string
  source: string
  sourceFormat: string
  sourceGroup: CadVectorSourceGroup
  sourceName: string
  businessGroup: string
  layerKey?: string
  cadLayer: string
  cadEntityType: string
  geometryType: string
  description: string
  originalFile: string
  cadSpace: 'model' | 'paper'
  Text?: string
  originalText?: string
  normalizedText?: string
  diameterText?: string
  corruptedText?: boolean
  EntityHandle?: string
  SubClasses?: string
  Linetype?: string
  Color?: string | number
  PaperSpace?: string | number | boolean | null
  sourceEntityHandle?: string
  curatedMainWork?: boolean
  curatedMainWorkId?: string
  displayName?: string
  manuallyPositioned?: boolean
  notes?: string[]
  layoutArtifact?: boolean
  isLayoutArtifact?: boolean
  [key: string]: unknown
}

export interface CadVectorFeature {
  type: 'Feature'
  geometry: Geometry
  properties: CadVectorProperties
}

export interface CadVectorFeatureCollection {
  type: 'FeatureCollection'
  features: CadVectorFeature[]
}

export interface CadVectorLayerIndexItem {
  layerKey?: string
  layerName: string
  featureCount: number
  geometryTypes: string[]
  inferredType: CadVectorType
  originalFiles: string[]
  sourceGroup?: CadVectorSourceGroup
  sourceName?: string
  businessGroup?: string
  sourceGroups?: CadVectorSourceGroup[]
  sourceGroupCounts?: Partial<Record<CadVectorSourceGroup, number>>
  businessGroupCounts?: Record<string, number>
  typeCounts?: Partial<Record<CadVectorType, number>>
  textFeatureCount?: number
  sampleTexts?: string[]
  cadSpaceCounts?: {
    model: number
    paper: number
  }
}

export interface CadVectorBusinessLayerIndexItem {
  key: string
  businessGroup: string
  sourceGroup: CadVectorSourceGroup
  sourceName: string
  type: CadVectorType
  featureCount: number
  layerCount: number
  layers: Array<{
    layerKey: string
    layerName: string
    featureCount: number
  }>
}

export interface CadVectorBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface CadVectorMetadata {
  originalBounds: CadVectorBounds
  normalizedBounds: CadVectorBounds
  transform: string
  sourceFiles: string[]
  totalFeatures: number
  skippedMissingGeometry?: number
  cadFieldStats?: {
    totalTextFeatures: number
    diameterTextFeatures: number
    locationLabelFeatures: number
    corruptedTextFeatures?: number
    cadSpaceCounts: {
      model: number
      paper: number
    }
    layerCounts: Array<{ value: string; count: number }>
    textValueCounts: Array<{ value: string; count: number }>
    paperSpaceRawCounts: Array<{ value: string; count: number }>
  }
  sourceGroupStats?: Array<{
    sourceGroup: CadVectorSourceGroup
    sourceName: string
    businessGroup: string
    featureCount: number
  }>
  generatedAt: string
}

export interface CadVectorData {
  entities: CadVectorFeatureCollection | null
  points: CadVectorFeatureCollection | null
  lines: CadVectorFeatureCollection | null
  polygons: CadVectorFeatureCollection | null
  irrigation: CadVectorFeatureCollection | null
  mainWorks: CadVectorFeatureCollection | null
  layerIndex: CadVectorLayerIndexItem[]
  businessLayerIndex: CadVectorBusinessLayerIndexItem[]
  metadata: CadVectorMetadata | null
  hasCadVectorData: boolean
}

export type CadBlueprintGeometryType = 'Point' | 'LineString' | 'Polygon'

export type CadBlueprintDataType =
  | 'CAD point'
  | 'CAD polyline'
  | 'CAD polygon'
  | 'CAD text'

export interface CadBlueprintAsset {
  id: string
  name: string
  type: AssetType
  status: AssetStatus
  layerKey: Exclude<LayerKey, 'incidents'>
  geometryType: CadBlueprintGeometryType
  cadPosition?: [number, number]
  cadPath?: [number, number][]
  source: string
  sourceDwg?: string
  backgroundImage?: string
  cadLayer: string
  dataType: CadBlueprintDataType
  description: string
  address: string
  capacity?: string
  area?: string
  volume?: string
  material?: string
  diameter?: string
  length?: string
  lastUpdated: string
  notes: string[]
}

export interface CadBlueprintConfig {
  sourceDwg: string
  imageFileName: string
  targetImagePath: string
}
