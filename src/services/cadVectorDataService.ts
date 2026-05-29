import type {
  CadVectorBusinessLayerIndexItem,
  CadVectorData,
  CadVectorFeatureCollection,
  CadVectorLayerIndexItem,
  CadVectorMetadata,
} from '../types/gis'

const CAD_VECTOR_BASE_URL = '/data/cad-vector'

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${CAD_VECTOR_BASE_URL}/${path}`, {
      cache: 'default',
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as T
  } catch {
    return null
  }
}

function isFeatureCollection(
  value: CadVectorFeatureCollection | null,
): value is CadVectorFeatureCollection {
  return value?.type === 'FeatureCollection' && Array.isArray(value.features)
}

export async function loadFullCadVectorEntities(): Promise<CadVectorFeatureCollection | null> {
  const entities = await fetchJson<CadVectorFeatureCollection>('entities.geojson')
  return isFeatureCollection(entities) ? entities : null
}

export async function loadCadVectorData(): Promise<CadVectorData> {
  const [webMapEntities, layerIndex, businessLayerIndex, metadata] = await Promise.all([
    fetchJson<CadVectorFeatureCollection>('web-map.geojson'),
    fetchJson<CadVectorLayerIndexItem[]>('layer-index.json'),
    fetchJson<CadVectorBusinessLayerIndexItem[]>('business-layer-index.json'),
    fetchJson<CadVectorMetadata>('cad-vector-metadata.json'),
  ])

  const validWebMapEntities = isFeatureCollection(webMapEntities) ? webMapEntities : null
  const fullEntitiesFallback = validWebMapEntities ? null : await fetchJson<CadVectorFeatureCollection>('entities.geojson')
  const validFullEntitiesFallback = isFeatureCollection(fullEntitiesFallback) ? fullEntitiesFallback : null
  const entities = validWebMapEntities ?? validFullEntitiesFallback
  const irrigation: CadVectorFeatureCollection | null = entities
    ? {
        type: 'FeatureCollection',
        features: entities.features.filter((feature) => feature.properties.sourceGroup === 'irrigation'),
      }
    : null
  const mainWorks: CadVectorFeatureCollection | null = entities
    ? {
        type: 'FeatureCollection',
        features: entities.features.filter((feature) => feature.properties.sourceGroup === 'main_works'),
      }
    : null

  return {
    entities,
    points: null,
    lines: null,
    polygons: null,
    irrigation,
    mainWorks,
    layerIndex: Array.isArray(layerIndex) ? layerIndex : [],
    businessLayerIndex: Array.isArray(businessLayerIndex) ? businessLayerIndex : [],
    metadata,
    hasCadVectorData: Boolean(entities?.features.length),
  }
}
