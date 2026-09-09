import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import proj4 from 'proj4'
import { CAD_SOURCE_CRS, CAD_TARGET_CRS } from './cad-crs-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.join(projectRoot, 'public', 'data', 'cad-vector')
const sourcePath = path.join(dataDir, 'web-map.geojson')
const metadataPath = path.join(dataDir, 'cad-vector-metadata.json')
const outputPath = path.join(dataDir, 'operational-map-wgs84.geojson')
const includedTypes = new Set([
  'water_plant',
  'raw_water_lake',
  'pipeline',
  'canal',
  'irrigation_canal',
  'irrigation_area',
  'supply_zone',
  'boundary',
])

proj4.defs(CAD_SOURCE_CRS.id, CAD_SOURCE_CRS.proj4)

function transformCoordinates(value, offset, bounds) {
  if (!Array.isArray(value)) return value
  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    const rawCoordinate = [value[0] + offset[0], value[1] + offset[1]]
    const coordinate = proj4(CAD_SOURCE_CRS.id, CAD_TARGET_CRS.id, rawCoordinate)
    if (!Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) {
      throw new Error(`Invalid transformed coordinate: ${JSON.stringify(rawCoordinate)}`)
    }
    bounds.minLongitude = Math.min(bounds.minLongitude, coordinate[0])
    bounds.minLatitude = Math.min(bounds.minLatitude, coordinate[1])
    bounds.maxLongitude = Math.max(bounds.maxLongitude, coordinate[0])
    bounds.maxLatitude = Math.max(bounds.maxLatitude, coordinate[1])
    return coordinate.map((number) => Number(number.toFixed(8)))
  }
  return value.map((child) => transformCoordinates(child, offset, bounds))
}

function transformGeometry(geometry, offset, bounds) {
  if (geometry?.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: geometry.geometries.map((child) => transformGeometry(child, offset, bounds)),
    }
  }
  return {
    ...geometry,
    coordinates: transformCoordinates(geometry.coordinates, offset, bounds),
  }
}

function main() {
  const collection = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  if (metadata?.spatialReference?.sourceCrs?.id !== CAD_SOURCE_CRS.id) {
    throw new Error('CAD metadata has not passed EPSG:9210 verification')
  }

  const offset = [metadata.originalBounds.minX, metadata.originalBounds.minY]
  const bounds = {
    minLongitude: Number.POSITIVE_INFINITY,
    minLatitude: Number.POSITIVE_INFINITY,
    maxLongitude: Number.NEGATIVE_INFINITY,
    maxLatitude: Number.NEGATIVE_INFINITY,
  }
  const countsByType = {}
  const features = collection.features
    .filter(
      (feature) =>
        feature?.geometry &&
        feature.properties?.cadSpace !== 'paper' &&
        feature.properties?.layoutArtifact !== true &&
        includedTypes.has(feature.properties?.type),
    )
    .map((feature) => {
      const type = feature.properties.type
      countsByType[type] = (countsByType[type] ?? 0) + 1
      return {
        ...feature,
        geometry: transformGeometry(feature.geometry, offset, bounds),
        properties: {
          ...feature.properties,
          sourceCrs: CAD_SOURCE_CRS.id,
          targetCrs: CAD_TARGET_CRS.id,
          coordinateProvenance: 'EPSG:9210 model-space coordinate reprojected to EPSG:4326',
          referenceOnly: true,
        },
      }
    })

  const output = {
    type: 'FeatureCollection',
    features,
    metadata: {
      sourceCrs: CAD_SOURCE_CRS.id,
      targetCrs: CAD_TARGET_CRS.id,
      axisOrder: ['longitude', 'latitude'],
      featureCount: features.length,
      countsByType,
      bounds,
      excluded: 'paper space, layout artifacts, labels and CAD background',
      referenceOnly: true,
    },
  }

  if (
    bounds.minLongitude < 105 ||
    bounds.maxLongitude > 108 ||
    bounds.minLatitude < 9 ||
    bounds.maxLatitude > 12
  ) {
    throw new Error(`Transformed bounds are outside the expected Long An region: ${JSON.stringify(bounds)}`)
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`, 'utf8')
  console.log(`[PASS] Exported ${features.length} model-space business/reference features`)
  console.log(`Bounds: ${JSON.stringify(bounds)}`)
  console.log(`Output: ${path.relative(projectRoot, outputPath)}`)
}

main()
