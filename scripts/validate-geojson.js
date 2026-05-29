import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const DATA_DIR = path.join(projectRoot, 'public', 'data', 'biwase')

const EXPECTED_FILES = [
  'water-plants.geojson',
  'raw-water-lakes.geojson',
  'pipelines.geojson',
  'canals.geojson',
  'supply-zones.geojson',
  'boundaries.geojson',
  'labels.geojson',
]

const REQUIRED_PROPERTIES = ['id', 'name', 'type', 'status']

const ALLOWED_GEOMETRY_BY_TYPE = {
  water_plant: ['Point', 'Polygon', 'MultiPolygon'],
  raw_water_lake: ['Point', 'Polygon', 'MultiPolygon'],
  pipeline: ['LineString', 'MultiLineString'],
  canal: ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'],
  supply_zone: ['Polygon', 'MultiPolygon'],
  boundary: ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'],
  label: ['Point', 'MultiPoint', 'LineString', 'Polygon'],
  pending_data: [
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection',
  ],
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function validateFeature(feature, fileName, index, errors, warnings) {
  const label = `${fileName} feature #${index + 1}`

  if (!feature || feature.type !== 'Feature') {
    errors.push(`${label}: khong phai Feature`)
    return
  }

  if (!feature.geometry || !feature.geometry.type) {
    errors.push(`${label}: thieu geometry`)
    return
  }

  if (!feature.properties || typeof feature.properties !== 'object') {
    errors.push(`${label}: thieu properties`)
    return
  }

  for (const key of REQUIRED_PROPERTIES) {
    if (feature.properties[key] === undefined || feature.properties[key] === null || feature.properties[key] === '') {
      errors.push(`${label}: thieu properties.${key}`)
    }
  }

  const type = feature.properties.type
  const allowedGeometryTypes = ALLOWED_GEOMETRY_BY_TYPE[type]

  if (!allowedGeometryTypes) {
    errors.push(`${label}: type khong hop le (${type})`)
    return
  }

  if (!allowedGeometryTypes.includes(feature.geometry.type)) {
    errors.push(`${label}: geometry ${feature.geometry.type} khong phu hop voi type ${type}`)
  }

  if (!feature.properties.source) {
    warnings.push(`${label}: chua co properties.source`)
  }

  if (type !== 'label' && type !== 'pending_data' && !feature.properties.cadLayer) {
    warnings.push(`${label}: chua co properties.cadLayer`)
  }
}

function main() {
  const errors = []
  const warnings = []

  for (const fileName of EXPECTED_FILES) {
    const filePath = path.join(DATA_DIR, fileName)

    if (!fs.existsSync(filePath)) {
      warnings.push(`${fileName}: file chua ton tai`)
      continue
    }

    let collection
    try {
      collection = readJson(filePath)
    } catch (error) {
      errors.push(`${fileName}: khong doc duoc JSON (${error.message})`)
      continue
    }

    if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
      errors.push(`${fileName}: phai la FeatureCollection`)
      continue
    }

    collection.features.forEach((feature, index) => {
      validateFeature(feature, fileName, index, errors, warnings)
    })

    console.log(`[OK] ${path.relative(projectRoot, filePath)}: ${collection.features.length} features`)
  }

  for (const warning of warnings) {
    console.warn(`[WARN] ${warning}`)
  }

  if (errors.length) {
    for (const error of errors) {
      console.error(`[ERROR] ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log('[OK] GeoJSON validation passed')
}

main()
