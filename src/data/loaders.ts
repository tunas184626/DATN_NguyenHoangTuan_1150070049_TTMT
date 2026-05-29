import type { Geometry } from 'geojson'
import type {
  BaseFeatureProperties,
  GISFeatureCollection,
  LayerDataState,
} from '../types/gis'

const DATASET_URLS = {
  waterPlant: new URL('./waterPlant.geojson', import.meta.url).href,
  rawWaterLakes: new URL('./rawWaterLakes.geojson', import.meta.url).href,
  pipelines: new URL('./pipelines.geojson', import.meta.url).href,
  canals: new URL('./canals.geojson', import.meta.url).href,
  supplyZones: new URL('./supplyZones.geojson', import.meta.url).href,
  incidents: new URL('./incidents.geojson', import.meta.url).href,
}

export function createEmptyFeatureCollection<
  TProperties extends BaseFeatureProperties,
  TGeometry extends Geometry,
>(): GISFeatureCollection<TProperties, TGeometry> {
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

async function fetchGeoJson<
  TProperties extends BaseFeatureProperties,
  TGeometry extends Geometry,
>(url: string): Promise<GISFeatureCollection<TProperties, TGeometry>> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Không thể tải dữ liệu: ${url}`)
  }

  return (await response.json()) as GISFeatureCollection<TProperties, TGeometry>
}

export async function loadMockLayerData(): Promise<LayerDataState> {
  const [waterPlant, rawWaterLakes, pipelines, canals, supplyZones, incidents] =
    await Promise.all([
      fetchGeoJson(DATASET_URLS.waterPlant),
      fetchGeoJson(DATASET_URLS.rawWaterLakes),
      fetchGeoJson(DATASET_URLS.pipelines),
      fetchGeoJson(DATASET_URLS.canals),
      fetchGeoJson(DATASET_URLS.supplyZones),
      fetchGeoJson(DATASET_URLS.incidents),
    ])

  return {
    waterPlant,
    rawWaterLakes,
    pipelines,
    canals,
    supplyZones,
    boundaries: createEmptyFeatureCollection(),
    labels: createEmptyFeatureCollection(),
    incidents,
  } as LayerDataState
}
