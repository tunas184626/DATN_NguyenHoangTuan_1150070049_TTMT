import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import proj4 from 'proj4'
import {
  CAD_CRS_EVIDENCE,
  CAD_SOURCE_CRS,
  CAD_TARGET_CRS,
  CRS_VERIFICATION_ANCHORS,
} from './cad-crs-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(projectRoot, 'source-data', 'converted', 'geojson')
const reportPath = path.join(projectRoot, 'public', 'data', 'cad-vector', 'crs-verification-report.json')
const coordinateTolerance = 0.01

proj4.defs(CAD_SOURCE_CRS.id, CAD_SOURCE_CRS.proj4)

function walkCoordinates(value, visitor) {
  if (!Array.isArray(value)) return
  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    visitor(value)
    return
  }
  for (const child of value) walkCoordinates(child, visitor)
}

function featureContainsCoordinate(feature, expected) {
  let found = false
  walkCoordinates(feature?.geometry?.coordinates, ([x, y]) => {
    if (Math.abs(x - expected[0]) <= coordinateTolerance && Math.abs(y - expected[1]) <= coordinateTolerance) {
      found = true
    }
  })
  return found
}

function haversineMetres(left, right) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  const earthRadius = 6371000
  const latitudeDelta = radians(right[1] - left[1])
  const longitudeDelta = radians(right[0] - left[0])
  const leftLatitude = radians(left[1])
  const rightLatitude = radians(right[1])
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function readCollection(fileName) {
  const value = JSON.parse(fs.readFileSync(path.join(sourceDir, fileName), 'utf8'))
  if (value?.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error(`${fileName} is not a GeoJSON FeatureCollection`)
  }
  return value
}

function main() {
  const collections = new Map()
  const anchors = CRS_VERIFICATION_ANCHORS.map((anchor) => {
    if (!collections.has(anchor.sourceFile)) {
      collections.set(anchor.sourceFile, readCollection(anchor.sourceFile))
    }

    const sourceFeatureExists = collections
      .get(anchor.sourceFile)
      .features.some((feature) => featureContainsCoordinate(feature, anchor.rawCoordinate))
    const transformedCoordinate = proj4(CAD_SOURCE_CRS.id, CAD_TARGET_CRS.id, anchor.rawCoordinate)
    const distanceMetres = haversineMetres(transformedCoordinate, anchor.referenceCoordinate)
    const passed = sourceFeatureExists && distanceMetres <= anchor.maximumDistanceMetres

    return {
      ...anchor,
      transformedCoordinate: transformedCoordinate.map((value) => Number(value.toFixed(8))),
      distanceMetres: Number(distanceMetres.toFixed(1)),
      sourceFeatureExists,
      passed,
    }
  })

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    result: anchors.every((anchor) => anchor.passed) ? 'PASS' : 'FAIL',
    evidence: CAD_CRS_EVIDENCE,
    sourceCrs: CAD_SOURCE_CRS,
    targetCrs: CAD_TARGET_CRS,
    anchors,
    notes: [
      'This check identifies the model-space CRS; it does not certify centimetre-level asset accuracy.',
      'Paper-space/layout coordinates are intentionally excluded and remain without a geographic CRS.',
      'GeoJSON coordinates published for web maps must use longitude, latitude order in EPSG:4326.',
    ],
  }

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  for (const anchor of anchors) {
    console.log(
      `[${anchor.passed ? 'PASS' : 'FAIL'}] ${anchor.label}: ` +
        `${anchor.transformedCoordinate.join(', ')}; reference distance=${anchor.distanceMetres} m`,
    )
  }
  console.log(`[${report.result}] ${CAD_SOURCE_CRS.id} ${CAD_SOURCE_CRS.name}`)
  console.log(`Report: ${path.relative(projectRoot, reportPath)}`)

  if (report.result !== 'PASS') process.exitCode = 1
}

main()
