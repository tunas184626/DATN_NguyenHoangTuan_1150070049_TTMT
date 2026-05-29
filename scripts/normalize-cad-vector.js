import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const INPUT_DIR = path.join(projectRoot, 'source-data', 'converted', 'geojson')
const OUTPUT_DIR = path.join(projectRoot, 'public', 'data', 'cad-vector')
const SOURCE_FORMAT = 'DWG -> ODA DXF -> QGIS -> GeoJSON'

const SOURCE_GROUPS = [
  {
    filePrefix: 'cad_',
    sourceGroup: 'cad_base',
    sourceName: 'BIWASE_HIEN TRANG.dwg',
    businessGroup: 'Nền CAD hiện trạng',
    idPrefix: 'CAD',
  },
  {
    filePrefix: 'kenh_thuy_loi_',
    sourceGroup: 'irrigation',
    sourceName: 'Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg',
    businessGroup: 'Hệ thống kênh thủy lợi',
    idPrefix: 'IRR',
  },
  {
    filePrefix: 'cong_trinh_chinh_',
    sourceGroup: 'main_works',
    sourceName: 'HTCN PMV.dwg',
    businessGroup: 'Công trình chính',
    idPrefix: 'MW',
  },
]

const POINT_TYPES = new Set(['Point', 'MultiPoint'])
const LINE_TYPES = new Set(['LineString', 'MultiLineString'])
const POLYGON_TYPES = new Set(['Polygon', 'MultiPolygon'])
const LAYOUT_ARTIFACT_TERMS = [
  'khung',
  'frame',
  'layout',
  'title',
  'legend',
  'chu thich',
  'chú thích',
  'bang',
  'bảng',
  'viewport',
  'paper',
  'border',
]
const MOJIBAKE_PATTERN = /(Ä|Æ|Ã|Â|�|Ð|ð|áº|á»|Ă|æ|¤|½|¼|¾)/

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] }
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function safeDisplayText(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback
  }

  return String(value).replace(/\u0000/g, '').trim()
}

function normalizeSearchText(value) {
  return safeDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[^\w\s$.-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getSourceInfo(fileName) {
  const normalizedFileName = fileName.toLowerCase()
  return (
    SOURCE_GROUPS.find((entry) => normalizedFileName.startsWith(entry.filePrefix)) ?? {
      filePrefix: '',
      sourceGroup: 'unknown',
      sourceName: fileName,
      businessGroup: 'Chưa xác định',
      idPrefix: 'CAD',
    }
  )
}

function makeLayerKey(sourceGroup, cadLayer) {
  return `${sourceGroup}::${safeDisplayText(cadLayer, 'UNKNOWN_LAYER')}`
}

function normalizedMatchText(...values) {
  return values
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .join(' ')
}

function inferMainWorkName(haystack) {
  if (!haystack) {
    return ''
  }

  if (/\bnmn\b/.test(haystack) && /kh/.test(haystack)) {
    return 'NMN Hòa Khánh Tây'
  }

  if (/nha.*ma.*y/.test(haystack) && /ho.*a.*3/.test(haystack)) {
    return 'Nhà máy nước Đức Hòa 3'
  }

  if (/nha.*ma.*y/.test(haystack) && /kh/.test(haystack)) {
    return 'Nhà máy nước Hòa Khánh Tây'
  }

  if (/13ha/.test(haystack) || (/ho/.test(haystack) && /my.*ha.*nh/.test(haystack))) {
    return 'Hồ nước thô 13ha Mỹ Hạnh'
  }

  if (/7ha/.test(haystack) || (/ho/.test(haystack) && /ha.*u.*ngh/.test(haystack))) {
    return 'Hồ nước thô 7ha Hậu Nghĩa'
  }

  return ''
}

function isLikelyMojibake(value) {
  const text = safeDisplayText(value)
  if (!text) {
    return false
  }

  const suspiciousMatches = text.match(new RegExp(MOJIBAKE_PATTERN.source, 'g')) ?? []
  return suspiciousMatches.length >= 2 || suspiciousMatches.length / Math.max(text.length, 1) > 0.08
}

function getRawProp(properties, candidates) {
  const entries = Object.entries(properties ?? {})

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(properties ?? {}, candidate)) {
      return properties[candidate]
    }

    const normalizedCandidate = normalizeText(candidate)
    const found = entries.find(([key]) => normalizeText(key) === normalizedCandidate)
    if (found) {
      return found[1]
    }
  }

  return undefined
}

function getProp(properties, candidates, fallback = '') {
  const entries = Object.entries(properties ?? {})

  for (const candidate of candidates) {
    if (properties?.[candidate] !== undefined && properties[candidate] !== null && String(properties[candidate]).trim()) {
      return String(properties[candidate]).trim()
    }

    const normalizedCandidate = normalizeText(candidate)
    const found = entries.find(([key]) => normalizeText(key) === normalizedCandidate)
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim()) {
      return String(found[1]).trim()
    }
  }

  return fallback
}

function getCadLayer(properties) {
  return getProp(properties, ['Layer', 'layer', 'LayerName', 'layerName'], 'UNKNOWN_LAYER')
}

function getCadEntityType(properties) {
  const subclasses = getProp(properties, ['SubClasses', 'subclasses'])
  if (subclasses) {
    const parts = subclasses.split(':').map((item) => item.trim()).filter(Boolean)
    return parts.at(-1) ?? subclasses
  }

  return getProp(properties, ['EntityType', 'Type', 'BlockName'], 'UNKNOWN')
}

function getCadSpace(properties) {
  const rawPaperSpace = getRawProp(properties, ['PaperSpace', 'paperspace', 'paperSpace'])
  const value = safeDisplayText(rawPaperSpace)

  if (!value || normalizeText(value) === 'NULL') {
    return 'model'
  }

  return 'paper'
}

function isDiameterLayer(cadLayer) {
  return normalizeText(cadLayer) === 'DIAMETER_TEXT'
}

function isDiameterText(text) {
  return /^(OD|D)\s*[-/]?\s*\d{2,5}\b/.test(normalizeText(text))
}

function isLocationLayer(cadLayer) {
  return normalizeText(cadLayer).includes('CNTV-TEXT')
}

function isLocationText(text) {
  return hasAny(normalizeText(text), [
    /\bXA\b/,
    /PHUONG/,
    /THI TRAN/,
    /\bTT\b/,
    /\bHUYEN\b/,
    /THANH PHO/,
    /\bTP\b/,
    /\bAP\b/,
    /\bTHON\b/,
    /\bKHU\b/,
    /\bVUNG\b/,
  ])
}

function hasAny(haystack, patterns) {
  return patterns.some((pattern) => pattern.test(haystack))
}

function inferType({ sourceGroup, cadLayer, name, text, geometryType }) {
  const haystack = normalizeText(`${cadLayer} ${name} ${text}`)
  const searchHaystack = normalizedMatchText(cadLayer, name, text)

  if (sourceGroup === 'irrigation') {
    if (text) {
      return { type: 'irrigation_label' }
    }

    if (LINE_TYPES.has(geometryType)) {
      return { type: 'irrigation_canal' }
    }

    if (POLYGON_TYPES.has(geometryType)) {
      return { type: 'irrigation_area' }
    }

    if (POINT_TYPES.has(geometryType)) {
      return { type: 'irrigation_point' }
    }

    return { type: 'irrigation_point' }
  }

  if (sourceGroup === 'main_works') {
    const mainWorkName = inferMainWorkName(searchHaystack)
    const isWaterPlant = Boolean(
      mainWorkName.includes('Nhà máy') ||
        mainWorkName.includes('NMN') ||
        /\bnmn\b/.test(searchHaystack) ||
        /nha.*ma.*y/.test(searchHaystack) ||
        /duc.*hoa.*3/.test(searchHaystack) ||
        /ho.*a.*kha.*nh.*ta.*y/.test(searchHaystack),
    )
    const isRawWaterLake = Boolean(
      mainWorkName.includes('Hồ nước thô') ||
        /ho.*nuoc.*tho/.test(searchHaystack) ||
        /ho.*n.*c.*tho/.test(searchHaystack) ||
        /7ha|13ha/.test(searchHaystack) ||
        /ha.*u.*ngh/.test(searchHaystack) ||
        /my.*ha.*nh/.test(searchHaystack),
    )

    if (isWaterPlant) {
      return { type: 'water_plant', name: mainWorkName || 'Công trình nhà máy nước' }
    }

    if (isRawWaterLake) {
      return { type: 'raw_water_lake', name: mainWorkName || 'Hồ nước thô' }
    }

    return { type: 'main_work_candidate' }
  }

  if (isDiameterLayer(cadLayer) || isDiameterText(text)) {
    return { type: 'pipe_diameter_label' }
  }

  if (isLocationLayer(cadLayer) || (text && isLocationText(text))) {
    return { type: 'location_label' }
  }

  if (hasAny(haystack, [/NHA MAY/, /\bNMN\b/, /\bTRAM\b/, /WATER[_ -]?PLANT/])) {
    return { type: 'water_plant' }
  }

  if (hasAny(haystack, [/\bHO\b/, /HO CHUA/, /\bLAKE\b/, /RAW[_ -]?WATER/])) {
    return { type: 'raw_water_lake' }
  }

  if (hasAny(haystack, [/\bONG\b/, /TUYEN ONG/, /\bPIPE\b/, /PIPELINE/, /\bD(300|400|500|600)\b/, /\bOD[0-9]{2,4}\b/])) {
    return { type: 'pipeline' }
  }

  if (hasAny(haystack, [/KENH/, /THUY LOI/, /\bCANAL\b/, /\bSONG\b/])) {
    return { type: 'canal' }
  }

  if (hasAny(haystack, [/RANH/, /BOUNDARY/, /DIA GIOI/, /QUY HOACH/])) {
    return { type: 'boundary' }
  }

  if (hasAny(haystack, [/\bKHU\b/, /\bVUNG\b/, /CAP NUOC/, /\bZONE\b/])) {
    return { type: 'supply_zone' }
  }

  if (hasAny(haystack, [/DUONG/, /GIAO THONG/, /\bNEN\b/, /CAU/, /CONG/])) {
    return { type: 'road_background' }
  }

  if (POINT_TYPES.has(geometryType)) {
    return { type: 'cad_point' }
  }

  if (LINE_TYPES.has(geometryType)) {
    return { type: 'cad_line' }
  }

  if (POLYGON_TYPES.has(geometryType)) {
    return { type: 'cad_polygon' }
  }

  return { type: 'unknown' }
}

function walkCoordinates(coordinates, visitor) {
  if (!Array.isArray(coordinates)) {
    return
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    visitor(coordinates)
    return
  }

  for (const child of coordinates) {
    walkCoordinates(child, visitor)
  }
}

function collectGeometryBounds(geometry, bounds) {
  if (!geometry) {
    return
  }

  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries ?? []) {
      collectGeometryBounds(child, bounds)
    }
    return
  }

  walkCoordinates(geometry.coordinates, ([x, y]) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return
    }

    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
  })
}

function normalizeCoordinates(coordinates, bounds) {
  if (!Array.isArray(coordinates)) {
    return coordinates
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [
      Number((coordinates[0] - bounds.minX).toFixed(3)),
      Number((coordinates[1] - bounds.minY).toFixed(3)),
      ...coordinates.slice(2),
    ]
  }

  return coordinates.map((child) => normalizeCoordinates(child, bounds))
}

function normalizeGeometry(geometry, bounds) {
  if (!geometry) {
    return null
  }

  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: (geometry.geometries ?? []).map((child) => normalizeGeometry(child, bounds)).filter(Boolean),
    }
  }

  return {
    ...geometry,
    coordinates: normalizeCoordinates(geometry.coordinates, bounds),
  }
}

function getGeometryBounds(geometry) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    pointCount: 0,
    edgePointCount: 0,
  }

  if (!geometry || !('coordinates' in geometry)) {
    return null
  }

  walkCoordinates(geometry.coordinates, ([x, y]) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return
    }

    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
    bounds.pointCount += 1
  })

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return null
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const tolerance = Math.max(width, height) * 0.012

  walkCoordinates(geometry.coordinates, ([x, y]) => {
    const nearVerticalEdge = Math.abs(x - bounds.minX) <= tolerance || Math.abs(x - bounds.maxX) <= tolerance
    const nearHorizontalEdge = Math.abs(y - bounds.minY) <= tolerance || Math.abs(y - bounds.maxY) <= tolerance
    if (nearVerticalEdge || nearHorizontalEdge) {
      bounds.edgePointCount += 1
    }
  })

  return bounds
}

function getCoordinatePair(point) {
  return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    ? [point[0], point[1]]
    : null
}

function getGeometryLineRings(geometry) {
  if (!geometry || !('coordinates' in geometry)) {
    return []
  }

  if (geometry.type === 'LineString') {
    return [geometry.coordinates]
  }

  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
    return geometry.coordinates
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat()
  }

  return []
}

function isClosedAxisAlignedRectangle(ring) {
  const points = ring.map(getCoordinatePair).filter(Boolean)
  if (points.length < 5 || points.length > 8) {
    return false
  }

  const bounds = {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  }
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const maxDimension = Math.max(width, height, 1)
  const tolerance = Math.max(maxDimension * 0.002, 2)

  if (width < 1000 || height < 700) {
    return false
  }

  const first = points[0]
  const last = points[points.length - 1]
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > tolerance) {
    return false
  }

  const axisAligned = points.slice(1).every((point, index) => {
    const previous = points[index]
    return Math.abs(point[0] - previous[0]) <= tolerance || Math.abs(point[1] - previous[1]) <= tolerance
  })
  if (!axisAligned) {
    return false
  }

  return points.every(([x, y]) => {
    const onVerticalEdge = Math.abs(x - bounds.minX) <= tolerance || Math.abs(x - bounds.maxX) <= tolerance
    const onHorizontalEdge = Math.abs(y - bounds.minY) <= tolerance || Math.abs(y - bounds.maxY) <= tolerance
    return onVerticalEdge && onHorizontalEdge
  })
}

function hasClosedAxisAlignedFrame(geometry) {
  return getGeometryLineRings(geometry).some(isClosedAxisAlignedRectangle)
}

function isLikelyLayoutFrame({ geometry, sourceGroup, cadLayer, name, text, cadSpace }, metadataBounds) {
  const haystack = normalizeSearchText(`${cadLayer} ${name} ${text} ${cadSpace}`)
  const hasLayoutTerm = LAYOUT_ARTIFACT_TERMS.some((term) => haystack.includes(normalizeSearchText(term)))

  if (hasLayoutTerm || cadSpace === 'paper') {
    return true
  }

  if (sourceGroup !== 'main_works' && sourceGroup !== 'irrigation') {
    return false
  }

  if (!LINE_TYPES.has(geometry?.type) && !POLYGON_TYPES.has(geometry?.type)) {
    return false
  }

  const featureBounds = getGeometryBounds(geometry)
  if (!featureBounds) {
    return false
  }

  if (hasClosedAxisAlignedFrame(geometry)) {
    return true
  }

  const mapWidth = Math.max(metadataBounds.maxX - metadataBounds.minX, 1)
  const mapHeight = Math.max(metadataBounds.maxY - metadataBounds.minY, 1)
  const width = featureBounds.maxX - featureBounds.minX
  const height = featureBounds.maxY - featureBounds.minY
  const widthRatio = width / mapWidth
  const heightRatio = height / mapHeight
  const edgeRatio = featureBounds.edgePointCount / Math.max(featureBounds.pointCount, 1)
  const rectangularFrame = edgeRatio >= 0.82 && featureBounds.pointCount <= 40

  return rectangularFrame && (widthRatio >= 0.4 || heightRatio >= 0.4)
}

function getGeometryBucket(geometryType) {
  if (POINT_TYPES.has(geometryType)) return 'points'
  if (LINE_TYPES.has(geometryType)) return 'lines'
  if (POLYGON_TYPES.has(geometryType)) return 'polygons'
  return 'unknown'
}

function incrementMap(map, key) {
  const safeKey = safeDisplayText(key)
  if (!safeKey) {
    return
  }

  map.set(safeKey, (map.get(safeKey) ?? 0) + 1)
}

function finalizeCountMap(map) {
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

function buildFeature(rawFeature, context, bounds) {
  const originalProperties = rawFeature.properties && typeof rawFeature.properties === 'object' ? rawFeature.properties : {}
  const geometryType = rawFeature.geometry?.type ?? 'Unknown'
  const sourceInfo = getSourceInfo(context.originalFile)
  const cadLayer = getCadLayer(originalProperties)
  const layerKey = makeLayerKey(sourceInfo.sourceGroup, cadLayer)
  const rawTextValue = getRawProp(originalProperties, ['Text', 'TEXT', 'text'])
  const hasTextField = rawTextValue !== undefined && rawTextValue !== null && safeDisplayText(rawTextValue)
  const text = safeDisplayText(rawTextValue)
  const corruptedText = hasTextField ? isLikelyMojibake(text) : false
  const entityHandle = getProp(originalProperties, ['EntityHandle', 'entityHandle'])
  const existingId = getProp(originalProperties, ['id', 'ID'])
  const sequenceId = String(context.nextId).padStart(6, '0')
  const fileStem = path.basename(context.originalFile, path.extname(context.originalFile)).replace(/[^A-Za-z0-9]+/g, '-')
  const idSeed = safeDisplayText(existingId || entityHandle || sequenceId).replace(/[^A-Za-z0-9_-]+/g, '-')
  const id = `${sourceInfo.idPrefix}-${fileStem}-${idSeed}-${sequenceId}`
  const fallbackName = text || (cadLayer !== 'UNKNOWN_LAYER' ? `${cadLayer} ${id}` : id)
  const inferred = inferType({
    sourceGroup: sourceInfo.sourceGroup,
    cadLayer,
    name: fallbackName,
    text,
    geometryType,
  })
  const normalizedGeometry = normalizeGeometry(rawFeature.geometry, bounds)
  const name = inferred.name || fallbackName
  const description = `CAD layer ${cadLayer}, geometry ${geometryType}, source ${context.originalFile}`
  const cadSpace = getCadSpace(originalProperties)
  const layoutArtifact = isLikelyLayoutFrame(
    {
      geometry: normalizedGeometry,
      sourceGroup: sourceInfo.sourceGroup,
      cadLayer,
      name,
      text,
      cadSpace,
    },
    {
      minX: 0,
      minY: 0,
      maxX: bounds.maxX - bounds.minX,
      maxY: bounds.maxY - bounds.minY,
    },
  )
  const type = layoutArtifact ? 'layout_artifact' : inferred.type

  context.nextId += 1

  return {
    type: 'Feature',
    geometry: normalizedGeometry,
    properties: {
      ...originalProperties,
      id,
      name,
      type,
      status: originalProperties.status || 'active',
      source: sourceInfo.sourceName,
      sourceFormat: SOURCE_FORMAT,
      sourceGroup: sourceInfo.sourceGroup,
      sourceName: sourceInfo.sourceName,
      businessGroup: sourceInfo.businessGroup,
      layerKey,
      cadLayer,
      cadEntityType: getCadEntityType(originalProperties),
      geometryType,
      description,
      originalFile: context.originalFile,
      cadSpace,
      originalText: hasTextField ? String(rawTextValue) : undefined,
      normalizedText: normalizeSearchText(
        `${text || name} ${cadLayer} ${sourceInfo.sourceGroup} ${sourceInfo.sourceName} ${sourceInfo.businessGroup} ${type} ${entityHandle}`,
      ),
      diameterText: type === 'pipe_diameter_label' ? text : undefined,
      corruptedText,
      layoutArtifact,
      isLayoutArtifact: layoutArtifact,
      sourceEntityHandle: entityHandle || undefined,
    },
  }
}

function readInputCollections() {
  if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true })
    return []
  }

  const fileNames = fs
    .readdirSync(INPUT_DIR)
    .filter((fileName) => fileName.toLowerCase().endsWith('.geojson'))

  return fileNames.flatMap((fileName) => {
    const filePath = path.join(INPUT_DIR, fileName)

    try {
      const collection = JSON.parse(fs.readFileSync(filePath, 'utf8'))

      if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
        console.warn(`[WARN] ${fileName}: khong phai FeatureCollection, bo qua`)
        return []
      }

      return [{ fileName, collection }]
    } catch (error) {
      console.warn(`[WARN] ${fileName}: khong doc duoc JSON (${error.message})`)
      return []
    }
  })
}

function updateLayerIndex(layerMap, feature) {
  const {
    layerKey,
    cadLayer,
    type,
    geometryType,
    originalFile,
    cadSpace,
    originalText,
    Text,
    sourceGroup,
    sourceName,
    businessGroup,
  } = feature.properties
  const indexKey = layerKey || makeLayerKey(sourceGroup, cadLayer)
  const existing = layerMap.get(indexKey) ?? {
    layerKey: indexKey,
    layerName: cadLayer,
    featureCount: 0,
    geometryTypes: new Set(),
    typeCounts: new Map(),
    originalFiles: new Set(),
    sourceGroups: new Set(),
    sourceGroupCounts: new Map(),
    sourceNames: new Set(),
    businessGroups: new Set(),
    businessGroupCounts: new Map(),
    textFeatureCount: 0,
    sampleTexts: new Set(),
    cadSpaceCounts: {
      model: 0,
      paper: 0,
    },
  }

  existing.featureCount += 1
  existing.geometryTypes.add(geometryType)
  existing.typeCounts.set(type, (existing.typeCounts.get(type) ?? 0) + 1)
  existing.originalFiles.add(originalFile)
  existing.sourceGroups.add(sourceGroup)
  existing.sourceGroupCounts.set(sourceGroup, (existing.sourceGroupCounts.get(sourceGroup) ?? 0) + 1)
  existing.sourceNames.add(sourceName)
  existing.businessGroups.add(businessGroup)
  existing.businessGroupCounts.set(businessGroup, (existing.businessGroupCounts.get(businessGroup) ?? 0) + 1)
  existing.cadSpaceCounts[cadSpace === 'paper' ? 'paper' : 'model'] += 1

  const textValue = safeDisplayText(originalText ?? Text)
  if (textValue) {
    existing.textFeatureCount += 1
    if (existing.sampleTexts.size < 12) {
      existing.sampleTexts.add(textValue)
    }
  }

  layerMap.set(indexKey, existing)
}

function finalizeLayerIndex(layerMap) {
  return Array.from(layerMap.values())
    .map((entry) => {
      const sortedTypes = Array.from(entry.typeCounts.entries()).sort((a, b) => b[1] - a[1])

      return {
        layerKey: entry.layerKey,
        layerName: entry.layerName,
        featureCount: entry.featureCount,
        geometryTypes: Array.from(entry.geometryTypes).sort(),
        inferredType: sortedTypes[0]?.[0] ?? 'unknown',
        originalFiles: Array.from(entry.originalFiles).sort(),
        sourceGroup: Array.from(entry.sourceGroups)[0] ?? 'unknown',
        sourceName: Array.from(entry.sourceNames)[0] ?? '',
        businessGroup: Array.from(entry.businessGroups)[0] ?? '',
        sourceGroups: Array.from(entry.sourceGroups).sort(),
        sourceGroupCounts: Object.fromEntries(Array.from(entry.sourceGroupCounts.entries()).sort()),
        businessGroupCounts: Object.fromEntries(Array.from(entry.businessGroupCounts.entries()).sort()),
        typeCounts: Object.fromEntries(sortedTypes),
        textFeatureCount: entry.textFeatureCount,
        sampleTexts: Array.from(entry.sampleTexts),
        cadSpaceCounts: entry.cadSpaceCounts,
      }
    })
    .sort((a, b) => b.featureCount - a.featureCount || a.layerName.localeCompare(b.layerName))
}

function buildBusinessLayerIndex(features) {
  const groups = new Map()

  for (const feature of features) {
    const {
      businessGroup,
      sourceGroup,
      sourceName,
      type,
      layerKey,
      cadLayer,
    } = feature.properties
    const key = `${businessGroup}::${sourceGroup}::${type}`
    const existing = groups.get(key) ?? {
      key,
      businessGroup,
      sourceGroup,
      sourceName,
      type,
      featureCount: 0,
      layers: new Map(),
    }

    existing.featureCount += 1
    const safeLayerKey = layerKey || makeLayerKey(sourceGroup, cadLayer)
    const layer = existing.layers.get(safeLayerKey) ?? {
      layerKey: safeLayerKey,
      layerName: cadLayer,
      featureCount: 0,
    }
    layer.featureCount += 1
    existing.layers.set(safeLayerKey, layer)
    groups.set(key, existing)
  }

  return Array.from(groups.values())
    .map((entry) => ({
      ...entry,
      layerCount: entry.layers.size,
      layers: Array.from(entry.layers.values()).sort(
        (a, b) => b.featureCount - a.featureCount || a.layerName.localeCompare(b.layerName),
      ),
    }))
    .sort((a, b) => b.featureCount - a.featureCount || a.businessGroup.localeCompare(b.businessGroup))
}

function buildSourceGroupStats(features) {
  const stats = new Map()

  for (const feature of features) {
    const { sourceGroup, sourceName, businessGroup } = feature.properties
    const existing = stats.get(sourceGroup) ?? {
      sourceGroup,
      sourceName,
      businessGroup,
      featureCount: 0,
    }
    existing.featureCount += 1
    stats.set(sourceGroup, existing)
  }

  return Array.from(stats.values()).sort((a, b) => b.featureCount - a.featureCount)
}

function shouldIncludeInWebMap(feature) {
  const { sourceGroup, type } = feature.properties

  if (sourceGroup === 'cad_base') {
    return (
      type === 'pipeline' ||
      type === 'pipe_diameter_label' ||
      type === 'boundary' ||
      type === 'supply_zone' ||
      type === 'canal' ||
      type === 'road_background' ||
      type === 'cad_line' ||
      type === 'cad_polygon'
    )
  }

  if (sourceGroup === 'irrigation') {
    return type === 'irrigation_canal' || type === 'irrigation_area'
  }

  if (sourceGroup === 'main_works') {
    if (type === 'water_plant' || type === 'raw_water_lake') {
      return true
    }

    return false
  }

  return false
}

function toWebMapCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) {
    return coordinates
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [coordinates[0], coordinates[1]]
  }

  return coordinates.map(toWebMapCoordinates)
}

function toWebMapFeature(feature) {
  if (!feature?.geometry || !('coordinates' in feature.geometry)) {
    return feature
  }

  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: toWebMapCoordinates(feature.geometry.coordinates),
    },
  }
}

function writeJson(fileName, data, options = {}) {
  const pretty = options.pretty !== false
  const outputPath = path.join(OUTPUT_DIR, fileName)
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, pretty ? 2 : 0)}\n`, 'utf8')
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const inputs = readInputCollections()
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }
  let skippedMissingGeometry = 0

  for (const input of inputs) {
    for (const [index, feature] of input.collection.features.entries()) {
      if (!feature?.geometry) {
        skippedMissingGeometry += 1
        console.warn(`[WARN] ${input.fileName} feature #${index + 1}: thieu geometry, bo qua`)
        continue
      }

      collectGeometryBounds(feature.geometry, bounds)
    }
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    bounds.minX = 0
    bounds.minY = 0
    bounds.maxX = 0
    bounds.maxY = 0
  }

  const entities = emptyFeatureCollection()
  const points = emptyFeatureCollection()
  const lines = emptyFeatureCollection()
  const polygons = emptyFeatureCollection()
  const irrigation = emptyFeatureCollection()
  const mainWorks = emptyFeatureCollection()
  const webMap = emptyFeatureCollection()
  const layerMap = new Map()
  const geometryStats = {
    points: 0,
    lines: 0,
    polygons: 0,
    unknown: 0,
  }
  const cadFieldStats = {
    textFeatureCount: 0,
    diameterTextFeatures: 0,
    locationLabelFeatures: 0,
    corruptedTextFeatures: 0,
    cadSpaceCounts: {
      model: 0,
      paper: 0,
    },
    layerCounts: new Map(),
    textValueCounts: new Map(),
    paperSpaceRawCounts: new Map(),
    sourceGroupCounts: new Map(),
  }
  const context = { nextId: 1, originalFile: '' }

  for (const input of inputs) {
    context.originalFile = input.fileName

    for (const feature of input.collection.features) {
      if (!feature?.geometry) {
        continue
      }

      if (!feature.properties || typeof feature.properties !== 'object') {
        feature.properties = {}
      }

      const normalizedFeature = buildFeature(feature, context, bounds)
      const bucket = getGeometryBucket(normalizedFeature.geometry?.type)
      const properties = normalizedFeature.properties
      const textValue = safeDisplayText(properties.originalText ?? properties.Text)

      entities.features.push(normalizedFeature)
      if (shouldIncludeInWebMap(normalizedFeature)) {
        webMap.features.push(toWebMapFeature(normalizedFeature))
      }
      if (properties.sourceGroup === 'irrigation') {
        irrigation.features.push(normalizedFeature)
      }
      if (properties.sourceGroup === 'main_works') {
        mainWorks.features.push(normalizedFeature)
      }
      updateLayerIndex(layerMap, normalizedFeature)
      incrementMap(cadFieldStats.layerCounts, properties.cadLayer)
      incrementMap(cadFieldStats.sourceGroupCounts, properties.sourceGroup)

      if (textValue) {
        cadFieldStats.textFeatureCount += 1
        incrementMap(cadFieldStats.textValueCounts, textValue)
      }

      if (properties.corruptedText) {
        cadFieldStats.corruptedTextFeatures += 1
      }

      if (properties.type === 'pipe_diameter_label') {
        cadFieldStats.diameterTextFeatures += 1
      }

      if (properties.type === 'location_label') {
        cadFieldStats.locationLabelFeatures += 1
      }

      cadFieldStats.cadSpaceCounts[properties.cadSpace === 'paper' ? 'paper' : 'model'] += 1
      incrementMap(
        cadFieldStats.paperSpaceRawCounts,
        getRawProp(feature.properties, ['PaperSpace', 'paperspace', 'paperSpace']) ?? 'NULL',
      )

      if (bucket === 'points') {
        points.features.push(normalizedFeature)
        geometryStats.points += 1
      } else if (bucket === 'lines') {
        lines.features.push(normalizedFeature)
        geometryStats.lines += 1
      } else if (bucket === 'polygons') {
        polygons.features.push(normalizedFeature)
        geometryStats.polygons += 1
      } else {
        geometryStats.unknown += 1
      }
    }
  }

  const layerIndex = finalizeLayerIndex(layerMap)
  const businessLayerIndex = buildBusinessLayerIndex(entities.features)
  const unknownFeatures = entities.features.filter((feature) => feature.properties.type === 'unknown').length
  const metadata = {
    originalBounds: bounds,
    normalizedBounds: {
      minX: 0,
      minY: 0,
      maxX: bounds.maxX - bounds.minX,
      maxY: bounds.maxY - bounds.minY,
    },
    transform: 'normalizedX = x - minX; normalizedY = y - minY',
    sourceFiles: inputs.map((input) => input.fileName).sort(),
    totalFeatures: entities.features.length,
    skippedMissingGeometry,
    cadFieldStats: {
      totalTextFeatures: cadFieldStats.textFeatureCount,
      diameterTextFeatures: cadFieldStats.diameterTextFeatures,
      locationLabelFeatures: cadFieldStats.locationLabelFeatures,
      corruptedTextFeatures: cadFieldStats.corruptedTextFeatures,
      cadSpaceCounts: cadFieldStats.cadSpaceCounts,
      layerCounts: finalizeCountMap(cadFieldStats.layerCounts),
      sourceGroupCounts: finalizeCountMap(cadFieldStats.sourceGroupCounts),
      textValueCounts: finalizeCountMap(cadFieldStats.textValueCounts),
      paperSpaceRawCounts: finalizeCountMap(cadFieldStats.paperSpaceRawCounts),
    },
    sourceGroupStats: buildSourceGroupStats(entities.features),
    generatedAt: new Date().toISOString(),
  }

  writeJson('entities.geojson', entities)
  writeJson('points.geojson', points)
  writeJson('lines.geojson', lines)
  writeJson('polygons.geojson', polygons)
  writeJson('irrigation.geojson', irrigation)
  writeJson('main-works.geojson', mainWorks)
  writeJson('web-map.geojson', webMap, { pretty: false })
  writeJson('layer-index.json', layerIndex)
  writeJson('business-layer-index.json', businessLayerIndex)
  writeJson('cad-vector-metadata.json', metadata)

  console.log(`[OK] Input GeoJSON files: ${inputs.length}`)
  console.log(`[OK] Total features: ${entities.features.length}`)
  console.log(`[OK] Points: ${geometryStats.points}`)
  console.log(`[OK] Lines: ${geometryStats.lines}`)
  console.log(`[OK] Polygons: ${geometryStats.polygons}`)
  console.log(`[OK] Irrigation features: ${irrigation.features.length}`)
  console.log(`[OK] Main works features: ${mainWorks.features.length}`)
  console.log(`[OK] Web map features: ${webMap.features.length}`)
  console.log(`[OK] CAD layers: ${layerIndex.length}`)
  console.log(`[OK] Business layer groups: ${businessLayerIndex.length}`)
  console.log(`[OK] Text features: ${cadFieldStats.textFeatureCount}`)
  console.log(`[OK] Diameter labels: ${cadFieldStats.diameterTextFeatures}`)
  console.log(`[OK] Location labels: ${cadFieldStats.locationLabelFeatures}`)
  console.log(`[OK] Corrupted text features: ${cadFieldStats.corruptedTextFeatures}`)
  console.log(`[OK] CAD space: model=${cadFieldStats.cadSpaceCounts.model}, paper=${cadFieldStats.cadSpaceCounts.paper}`)
  console.log(`[OK] Unknown features: ${unknownFeatures + geometryStats.unknown}`)
  console.log(`[OK] Output folder: ${path.relative(projectRoot, OUTPUT_DIR)}`)
}

main()
