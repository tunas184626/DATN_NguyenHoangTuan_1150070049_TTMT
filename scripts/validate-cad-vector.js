import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const DATA_DIR = path.join(projectRoot, 'public', 'data', 'cad-vector')

const OUTPUT_FILES = [
  'entities.geojson',
  'points.geojson',
  'lines.geojson',
  'polygons.geojson',
  'irrigation.geojson',
  'main-works.geojson',
  'web-map.geojson',
  'layer-index.json',
  'business-layer-index.json',
  'cad-vector-metadata.json',
]

function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function formatSize(bytes) {
  if (bytes > 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return `${(bytes / 1024).toFixed(1)} KB`
}

function main() {
  const entitiesPath = path.join(DATA_DIR, 'entities.geojson')
  const exists = fs.existsSync(entitiesPath)
  console.log(`entities.geojson exists: ${exists ? 'yes' : 'no'}`)

  if (!exists) {
    process.exitCode = 1
    return
  }

  const entities = readJson('entities.geojson')
  const metadata = readJson('cad-vector-metadata.json')
  const layerIndex = readJson('layer-index.json') ?? []

  if (entities?.type !== 'FeatureCollection' || !Array.isArray(entities.features)) {
    console.error('[ERROR] entities.geojson khong phai FeatureCollection')
    process.exitCode = 1
    return
  }

  const counts = {
    points: 0,
    lines: 0,
    polygons: 0,
    missingGeometry: 0,
    unknown: 0,
    textFeatures: 0,
    diameterText: 0,
    locationLabels: 0,
    corruptedText: 0,
    irrigation: 0,
    mainWorks: 0,
    modelSpace: 0,
    paperSpace: 0,
  }
  const cadLayers = new Set()

  for (const feature of entities.features) {
    const geometryType = feature?.geometry?.type

    if (!geometryType) {
      counts.missingGeometry += 1
    } else if (geometryType === 'Point' || geometryType === 'MultiPoint') {
      counts.points += 1
    } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      counts.lines += 1
    } else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
      counts.polygons += 1
    }

    if (feature?.properties?.cadLayer) {
      cadLayers.add(feature.properties.cadLayer)
    }

    if (feature?.properties?.type === 'unknown') {
      counts.unknown += 1
    }

    if (feature?.properties?.Text || feature?.properties?.originalText) {
      counts.textFeatures += 1
    }

    if (feature?.properties?.type === 'pipe_diameter_label') {
      counts.diameterText += 1
    }

    if (feature?.properties?.type === 'location_label') {
      counts.locationLabels += 1
    }

    if (feature?.properties?.corruptedText) {
      counts.corruptedText += 1
    }

    if (feature?.properties?.sourceGroup === 'irrigation') {
      counts.irrigation += 1
    }

    if (feature?.properties?.sourceGroup === 'main_works') {
      counts.mainWorks += 1
    }

    if (feature?.properties?.cadSpace === 'paper') {
      counts.paperSpace += 1
    } else {
      counts.modelSpace += 1
    }
  }

  console.log(`total features: ${entities.features.length}`)
  console.log(`Point/MultiPoint: ${counts.points}`)
  console.log(`LineString/MultiLineString: ${counts.lines}`)
  console.log(`Polygon/MultiPolygon: ${counts.polygons}`)
  console.log(`cadLayer count: ${cadLayers.size}`)
  console.log(`missing geometry: ${counts.missingGeometry}`)
  console.log(`unknown features: ${counts.unknown}`)
  console.log(`features with Text: ${metadata?.cadFieldStats?.totalTextFeatures ?? counts.textFeatures}`)
  console.log(`pipe diameter labels: ${metadata?.cadFieldStats?.diameterTextFeatures ?? counts.diameterText}`)
  console.log(`location labels: ${metadata?.cadFieldStats?.locationLabelFeatures ?? counts.locationLabels}`)
  console.log(`corrupted text features: ${metadata?.cadFieldStats?.corruptedTextFeatures ?? counts.corruptedText}`)
  console.log(`irrigation features: ${counts.irrigation}`)
  console.log(`main works features: ${counts.mainWorks}`)
  console.log(
    `cadSpace model/paper: ${(metadata?.cadFieldStats?.cadSpaceCounts?.model ?? counts.modelSpace)}/${(metadata?.cadFieldStats?.cadSpaceCounts?.paper ?? counts.paperSpace)}`,
  )
  console.log(`normalized bounds: ${JSON.stringify(metadata?.normalizedBounds ?? null)}`)
  console.log(`layer-index entries: ${Array.isArray(layerIndex) ? layerIndex.length : 0}`)

  for (const fileName of OUTPUT_FILES) {
    const filePath = path.join(DATA_DIR, fileName)
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] missing output: ${fileName}`)
      continue
    }

    console.log(`${fileName}: ${formatSize(fs.statSync(filePath).size)}`)
  }

  if (counts.missingGeometry > 0) {
    process.exitCode = 1
  }
}

main()
