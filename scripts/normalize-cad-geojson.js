import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const INPUT_DIR = path.join(projectRoot, 'source-data', 'converted', 'geojson')
const OUTPUT_DIR = path.join(projectRoot, 'public', 'data', 'biwase')
const CAD_SOURCE = 'BIWASE_HIEN TRANG.dwg'

const OUTPUT_FILES = {
  water_plant: 'water-plants.geojson',
  raw_water_lake: 'raw-water-lakes.geojson',
  pipeline: 'pipelines.geojson',
  canal: 'canals.geojson',
  supply_zone: 'supply-zones.geojson',
  boundary: 'boundaries.geojson',
  label: 'labels.geojson',
  pending_data: 'labels.geojson',
}

const ID_PREFIX = {
  water_plant: 'WP',
  raw_water_lake: 'RWL',
  pipeline: 'PL',
  canal: 'CN',
  supply_zone: 'SZ',
  boundary: 'BD',
  label: 'LB',
  pending_data: 'PD',
}

const OUTPUT_TYPES = Object.keys(OUTPUT_FILES)

function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function getProperty(properties, candidates, fallback = '') {
  const entries = Object.entries(properties ?? {})

  for (const candidate of candidates) {
    const exactValue = properties?.[candidate]
    if (exactValue !== undefined && exactValue !== null && String(exactValue).trim()) {
      return String(exactValue).trim()
    }

    const normalizedCandidate = normalizeText(candidate)
    const found = entries.find(([key]) => normalizeText(key) === normalizedCandidate)
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim()) {
      return String(found[1]).trim()
    }
  }

  return fallback
}

function normalizeNotes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function hasAny(haystack, patterns) {
  return patterns.some((pattern) => pattern.test(haystack))
}

function inferType({ fileName, cadLayer, name, geometryType, properties }) {
  const textValue = getProperty(properties, ['TextString', 'TEXT', 'Text', 'text', 'label', 'LABEL'])
  const haystack = normalizeText(`${fileName} ${cadLayer} ${name} ${textValue}`)

  if (hasAny(haystack, [/TEXT/, /MTEXT/, /LABEL/, /NHAN/, /GHI CHU/, /ANNOTATION/]) || textValue) {
    return 'label'
  }

  if (hasAny(haystack, [/KHU VUC CAP NUOC/, /VUNG CAP/, /SUPPLY[_ -]?ZONE/, /CAP NUOC/])) {
    return 'supply_zone'
  }

  if (hasAny(haystack, [/NHA MAY/, /\bNMN\b/, /WATER[_ -]?PLANT/, /TRAM XU LY/])) {
    return 'water_plant'
  }

  if (hasAny(haystack, [/HO CHUA/, /NUOC THO/, /RAW[_ -]?WATER/, /\bLAKE\b/, /\bHO\b/])) {
    return 'raw_water_lake'
  }

  if (hasAny(haystack, [/TUYEN ONG/, /\bONG\b/, /\bPIPE\b/, /PIPELINE/, /\bD[0-9]{2,4}\b/])) {
    return 'pipeline'
  }

  if (hasAny(haystack, [/KENH/, /THUY LOI/, /\bCANAL\b/, /MUA TIEU/])) {
    return 'canal'
  }

  if (hasAny(haystack, [/RANH/, /BOUNDARY/, /QUY HOACH/, /DIA GIOI/])) {
    return 'boundary'
  }

  return geometryType === 'Point' ? 'label' : 'pending_data'
}

function getCadLayer(properties, fileName) {
  return (
    getProperty(properties, [
      'cadLayer',
      'sourceLayer',
      'Layer',
      'LAYER',
      'layer',
      'LayerName',
      'layerName',
      'OGR_LAYER',
    ]) || path.basename(fileName, path.extname(fileName))
  )
}

function extractDiameter(properties, name) {
  const explicit = getProperty(properties, ['diameter', 'Diameter', 'DUONG_KINH', 'DIAMETER', 'DIA'])
  if (explicit) {
    return explicit
  }

  const match = normalizeText(name).match(/\bD[0-9]{2,4}\b/)
  return match?.[0] ?? ''
}

function buildId(type, properties, counters) {
  const existingId = getProperty(properties, ['id', 'ID', 'fid', 'FID', 'objectid', 'OBJECTID'])
  if (existingId) {
    return existingId
  }

  counters[type] = (counters[type] ?? 0) + 1
  return `${ID_PREFIX[type]}-${String(counters[type]).padStart(4, '0')}`
}

function normalizeStatus(properties) {
  const status = getProperty(properties, ['status', 'STATUS'])
  if (['active', 'maintenance', 'need_inspection', 'pending_data'].includes(status)) {
    return status
  }

  return 'pending_data'
}

function normalizeFeature(feature, fileName, index, counters) {
  if (!feature || feature.type !== 'Feature') {
    console.warn(`[WARN] ${fileName} feature #${index + 1}: bo qua vi khong phai Feature`)
    return null
  }

  if (!feature.geometry) {
    console.warn(`[WARN] ${fileName} feature #${index + 1}: thieu geometry, bo qua feature nay`)
    return null
  }

  const properties = feature.properties ?? {}
  const cadLayer = getCadLayer(properties, fileName)
  const fallbackName = `${cadLayer || path.basename(fileName, path.extname(fileName))} ${index + 1}`
  const name =
    getProperty(properties, [
      'name',
      'Name',
      'NAME',
      'TextString',
      'TEXT',
      'Text',
      'label',
      'LABEL',
    ]) || fallbackName
  const type = inferType({
    fileName,
    cadLayer,
    name,
    geometryType: feature.geometry.type,
    properties,
  })

  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: {
      id: buildId(type, properties, counters),
      name,
      type,
      status: normalizeStatus(properties),
      source: CAD_SOURCE,
      cadLayer,
      sourceLayer: cadLayer,
      description: getProperty(properties, ['description', 'Description', 'DESC', 'MoTa', 'MO_TA']),
      address: getProperty(properties, ['address', 'Address', 'LOCATION', 'location', 'DiaChi', 'DIA_CHI']),
      capacity: getProperty(properties, ['capacity', 'Capacity', 'CONG_SUAT', 'CongSuat']),
      area: getProperty(properties, ['area', 'Area', 'DIEN_TICH', 'DienTich']),
      volume: getProperty(properties, ['volume', 'Volume', 'DUNG_TICH', 'DungTich']),
      material: getProperty(properties, ['material', 'Material', 'VAT_LIEU', 'VatLieu']),
      diameter: extractDiameter(properties, name),
      length: getProperty(properties, ['length', 'Length', 'CHIEU_DAI', 'ChieuDai']),
      imageUrl: getProperty(properties, ['imageUrl', 'image_url']),
      googleMapsUrl: getProperty(properties, ['googleMapsUrl', 'google_maps_url']),
      lastUpdated: new Date().toISOString().slice(0, 10),
      notes: normalizeNotes(properties.notes),
    },
  }
}

function readGeoJsonFiles() {
  if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true })
    return []
  }

  return fs
    .readdirSync(INPUT_DIR)
    .filter((fileName) => fileName.toLowerCase().endsWith('.geojson') || fileName.toLowerCase().endsWith('.json'))
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const outputs = Object.fromEntries(
    [...new Set(Object.values(OUTPUT_FILES))].map((fileName) => [fileName, emptyFeatureCollection()]),
  )
  const counters = Object.fromEntries(OUTPUT_TYPES.map((type) => [type, 0]))
  const inputFiles = readGeoJsonFiles()

  if (!inputFiles.length) {
    console.warn(`[WARN] Khong tim thay GeoJSON tho trong ${path.relative(projectRoot, INPUT_DIR)}`)
  }

  for (const fileName of inputFiles) {
    const filePath = path.join(INPUT_DIR, fileName)
    let collection

    try {
      collection = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error) {
      console.warn(`[WARN] Khong doc duoc ${fileName}: ${error.message}`)
      continue
    }

    if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
      console.warn(`[WARN] ${fileName}: khong phai FeatureCollection, bo qua`)
      continue
    }

    for (const [index, feature] of collection.features.entries()) {
      const normalized = normalizeFeature(feature, fileName, index, counters)
      if (!normalized) {
        continue
      }

      const outputFileName = OUTPUT_FILES[normalized.properties.type]
      outputs[outputFileName].features.push(normalized)
    }
  }

  for (const [fileName, collection] of Object.entries(outputs)) {
    const outputPath = path.join(OUTPUT_DIR, fileName)
    fs.writeFileSync(outputPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8')
    console.log(`[OK] ${path.relative(projectRoot, outputPath)}: ${collection.features.length} features`)
  }
}

main()
