import type { AnyMapFeature, LayerDataState, LayerKey, SearchItem } from '../types/gis'
import { layerKeyToLabel, mapFeatureTypeLabel } from './asset'

export interface FeatureEnvelope {
  id: string
  feature: AnyMapFeature
  layerKey: LayerKey
}

const LAYER_ORDER: LayerKey[] = [
  'waterPlant',
  'rawWaterLakes',
  'pipelines',
  'canals',
  'supplyZones',
  'boundaries',
  'labels',
  'incidents',
]

export function flattenLayerData(data: LayerDataState): FeatureEnvelope[] {
  return LAYER_ORDER.flatMap((layerKey) => {
    const collection = data[layerKey]
    return collection.features.map((feature) => ({
      id: feature.properties.id,
      feature,
      layerKey,
    }))
  })
}

export function getFeatureById(
  data: LayerDataState,
  featureId: string,
): FeatureEnvelope | null {
  for (const layerKey of LAYER_ORDER) {
    const found = data[layerKey].features.find((feature) => feature.properties.id === featureId)
    if (found) {
      return { id: found.properties.id, feature: found, layerKey }
    }
  }

  return null
}

export function buildSearchItems(data: LayerDataState): SearchItem[] {
  return flattenLayerData(data).map(({ feature, layerKey }) => {
    const lowerName = feature.properties.name.toLowerCase()
    const keywords = [
      lowerName,
      feature.properties.id.toLowerCase(),
      layerKeyToLabel(layerKey).toLowerCase(),
      mapFeatureTypeLabel(feature.properties.type).toLowerCase(),
    ]

    if (feature.properties.type === 'incident') {
      keywords.push(feature.properties.incidentCode.toLowerCase())
    }

    return {
      id: feature.properties.id,
      label: feature.properties.name,
      keywords,
      layerKey,
    }
  })
}

export function featureToObjectTitle(feature: AnyMapFeature): string {
  const typeLabel = mapFeatureTypeLabel(feature.properties.type)
  return `${feature.properties.name} - ${typeLabel}`
}
