import type { CadVectorFeature, CadVectorType } from '../types/gis'

export interface CadLabelVisibilityOptions {
  showMainWorkLabels: boolean
  showDiameterLabels: boolean
  showIrrigationLabels: boolean
  showLocationLabels: boolean
  showAllLabels: boolean
  hideCorruptedText: boolean
}

const DIAMETER_VALUES = new Set([
  '90',
  '110',
  '150',
  '160',
  '200',
  '225',
  '300',
  '315',
  '400',
  '450',
  '500',
  '560',
  '630',
  '710',
  '800',
  '900',
])

const TEXT_LAYER_PATTERN = /(TEXT|DIMENSION|DIAMETER|LABEL|ANNOTATION|MTEXT)/i
const EXTRA_MOJIBAKE_TOKENS = ['\uFFFD', 'Ã', 'Ä', 'Å', 'Æ', 'Ă', 'Â', 'Ð', 'ð', 'ï¿½', 'áº', 'á»', 'Æ°', 'Æ¡']
const MOJIBAKE_PATTERN = /(Ä|Æ|Ã|Â|�|Ð|ð|áº|á»|Ă|æ|¤|½|¼|¾)/

export function safeDisplayText(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) {
    return fallback
  }

  const text = String(value).replace(/\u0000/g, '').trim()
  return text || fallback
}

export function normalizeSearchText(value: unknown): string {
  return safeDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[^\w\s$.-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function isPipeDiameterText(value: unknown): boolean {
  const text = safeDisplayText(value).toUpperCase().replace(/\s+/g, '')
  const match = text.match(/^(OD|D)[-/]?(\d{2,4})\b/)
  return Boolean(match && DIAMETER_VALUES.has(match[2]))
}

export function isLikelyMojibake(value: unknown): boolean {
  const text = safeDisplayText(value)
  if (!text) {
    return false
  }

  const regexMatches = text.match(new RegExp(MOJIBAKE_PATTERN.source, 'g')) ?? []
  const tokenMatches = EXTRA_MOJIBAKE_TOKENS.reduce(
    (sum, token) => sum + (text.includes(token) ? text.split(token).length - 1 : 0),
    0,
  )
  const suspiciousMatches = regexMatches.length + tokenMatches
  return suspiciousMatches >= 1 || suspiciousMatches / Math.max(text.length, 1) > 0.04
}

export function isValidCadLabel(value: unknown): boolean {
  const text = safeDisplayText(value)
  if (!text) {
    return false
  }

  if (isPipeDiameterText(text)) {
    return true
  }

  return !isLikelyMojibake(text) && text.length <= 80
}

export function getCadFeatureText(feature: CadVectorFeature): string {
  return safeDisplayText(feature.properties.originalText ?? feature.properties.Text)
}

export function isCadTextFeature(feature: CadVectorFeature): boolean {
  const properties = feature.properties
  return Boolean(
    properties.type === 'pipe_diameter_label' ||
      properties.type === 'location_label' ||
      properties.Text ||
      properties.originalText ||
      TEXT_LAYER_PATTERN.test(String(properties.cadLayer ?? '')) ||
      TEXT_LAYER_PATTERN.test(String(properties.cadEntityType ?? '')),
  )
}

export function getFeatureDisplayName(feature: CadVectorFeature): string {
  const text = getCadFeatureText(feature)
  const name = safeDisplayText(feature.properties.name)

  if (
    name &&
    name !== text &&
    !isLikelyMojibake(name) &&
    !/^CAD[-_\s]/i.test(name) &&
    !/^Doi tuong CAD/i.test(normalizeSearchText(name))
  ) {
    return name
  }

  if (text && !isLikelyMojibake(text)) {
    return text
  }

  if (isPipeDiameterText(text)) {
    return text
  }

  if (name && !isLikelyMojibake(name) && name !== text) {
    return name
  }

  return `Đối tượng CAD ${feature.properties.id}`
}

export function shouldRenderCadLabel(
  feature: CadVectorFeature,
  options: CadLabelVisibilityOptions,
): boolean {
  if (!isCadTextFeature(feature)) {
    return true
  }

  const text = getCadFeatureText(feature)
  const isDiameter = feature.properties.type === 'pipe_diameter_label' || isPipeDiameterText(text)
  const isLocation = feature.properties.type === 'location_label'
  const isIrrigation = feature.properties.type === 'irrigation_label'
  const isCuratedMainWork = feature.properties.curatedMainWork === true
  const isMainWork =
    feature.properties.sourceGroup === 'main_works' &&
    (feature.properties.type === 'water_plant' ||
      feature.properties.type === 'raw_water_lake' ||
      feature.properties.type === 'main_work_candidate')
  const corrupted = Boolean(feature.properties.corruptedText) || isLikelyMojibake(text)

  if (isCuratedMainWork) {
    return options.showMainWorkLabels || options.showAllLabels
  }

  if (isMainWork) {
    return options.showMainWorkLabels || options.showAllLabels
  }

  if (corrupted && options.hideCorruptedText && !isDiameter) {
    return false
  }

  if (isDiameter) {
    return options.showDiameterLabels || options.showAllLabels
  }

  if (isLocation) {
    return options.showLocationLabels || options.showAllLabels
  }

  if (isIrrigation) {
    return options.showIrrigationLabels || options.showAllLabels
  }

  if (!options.showAllLabels) {
    return false
  }

  return options.hideCorruptedText ? isValidCadLabel(text) : Boolean(text)
}

export function cadVectorTypePriority(type: CadVectorType, text: unknown): number {
  if (isPipeDiameterText(text) || type === 'pipe_diameter_label') {
    return 0
  }

  if (type === 'water_plant' || type === 'raw_water_lake') {
    return 1
  }

  if (type === 'pipeline' || type === 'irrigation_canal') {
    return 2
  }

  if (type === 'canal' || type === 'boundary' || type === 'supply_zone' || type === 'irrigation_area') {
    return 3
  }

  if (type === 'cad_line' || type === 'cad_polygon' || type === 'cad_point' || type === 'road_background') {
    return 4
  }

  if (type === 'layout_artifact') {
    return 6
  }

  return 5
}
