import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { AssetFeature, CadVectorFeature, CadVectorMetadata, IncidentFeature } from '../../src/types/gis'
import { buildIncidentAnchor, parseIncidentPosition } from '../../src/utils/incidentLocation'
import { cadBlueprintAssets } from '../../src/data/cadBlueprintAssets'
import { loadLocalDrafts, saveLocalDraft } from '../../src/services/localDraftStore'
import { loadApiAssetsForViewport } from '../../src/data/dataService'
import { apiGet } from '../../src/services/apiClient'
import { createIncidentSchema } from './modules/incidents/schemas'

vi.mock('../../src/services/apiClient', () => ({ apiGet: vi.fn() }))

const metadata = JSON.parse(readFileSync(new URL('../../public/data/cad-vector/cad-vector-metadata.json', import.meta.url), 'utf8')) as CadVectorMetadata
// Independent control coordinates from the project's published CRS verification report.
const hauNghia: [number, number] = [569367.108 - metadata.originalBounds.minX, 1205504.175 - metadata.originalBounds.minY]
const ducHoa: [number, number] = [576297.024 - metadata.originalBounds.minX, 1196877.162 - metadata.originalBounds.minY]

function cad(): CadVectorFeature {
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates: hauNghia },
    properties: { id: 'CAD-selected', name: 'Hậu Nghĩa', type: 'water_plant', status: 'active', source: 'CAD', sourceFormat: 'DWG', sourceGroup: 'main_works', sourceName: 'CAD', businessGroup: 'Cấp nước', cadLayer: 'NMN', cadEntityType: 'POINT', geometryType: 'Point', description: '', originalFile: 'CAD', cadSpace: 'model' },
  }
}

function serverAsset(): AssetFeature {
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates: [106.1, 10.2] },
    properties: { id: '11111111-1111-4111-8111-111111111111', assetCode: 'CAD-selected', name: 'Tài sản trên máy chủ', type: 'water_plant', status: 'active', description: '', address: 'Địa chỉ OSM cũ', notes: [], lastUpdated: '2026-10-13', version: 7 },
  }
}

describe('incident locations belong to the explicitly reported object', () => {
  it('undoes CAD normalization and matches the verified WGS84 coordinates with the correct axis order', () => {
    const anchor = buildIncidentAnchor({ kind: 'cadVector', feature: cad() }, metadata, [])
    expect(anchor.position?.[0]).toBeCloseTo(10.90031503, 7)
    expect(anchor.position?.[1]).toBeCloseTo(106.38634541, 7)
    expect(anchor.origin).toMatchObject({ kind: 'cadVector', featureId: 'CAD-selected', coordinateMethod: 'cad_reprojected', sourceCrs: 'EPSG:9210' })
    expect(anchor.origin.cadPosition?.[0]).toBeCloseTo(569367.108, 3)
    expect(anchor.origin.cadPosition?.[1]).toBeCloseTo(1205504.175, 3)
  })

  it('uses the clicked CAD position on a pipeline instead of another endpoint or OSM selection', () => {
    const feature = cad()
    feature.geometry = { type: 'LineString', coordinates: [ducHoa, hauNghia] }
    feature.properties.type = 'pipeline'
    const anchor = buildIncidentAnchor({ kind: 'cadVector', feature }, metadata, [serverAsset()], hauNghia)
    expect(anchor.position?.[0]).toBeCloseTo(10.90031503, 7)
    expect(anchor.position?.[1]).toBeCloseTo(106.38634541, 7)
    expect(anchor.address).toBe('')
    expect(anchor.position).not.toEqual([10.2, 106.1])
  })

  it('uses a point feature position even if the marker click was slightly offset', () => {
    const anchor = buildIncidentAnchor({ kind: 'cadVector', feature: cad() }, metadata, [], ducHoa)
    expect(anchor.position?.[0]).toBeCloseTo(10.90031503, 7)
  })

  it('never reprojects paper-space or layout geometry', () => {
    const paper = cad()
    paper.properties.cadSpace = 'paper'
    const layout = cad()
    layout.properties.layoutArtifact = true
    for (const feature of [paper, layout]) {
      const anchor = buildIncidentAnchor({ kind: 'cadVector', feature }, metadata, [])
      expect(anchor.position).toBeNull()
      expect(anchor.origin.coordinateMethod).toBe('manual')
    }
  })

  it('requires an explicit location if CRS metadata is missing or the display transform is unknown', () => {
    const unknownTransform = { ...metadata, transform: 'unknown transform' }
    for (const meta of [null, unknownTransform]) {
      expect(buildIncidentAnchor({ kind: 'cadVector', feature: cad() }, meta, []).position).toBeNull()
    }
  })

  it('rejects CAD coordinates outside the verified geographic region and invalid geometry', () => {
    const feature = cad()
    feature.geometry = { type: 'Point', coordinates: [300, 500] }
    expect(buildIncidentAnchor({ kind: 'cadVector', feature }, metadata, []).position).toBeNull()
    feature.geometry = { type: 'Point', coordinates: [Number.NaN, Number.POSITIVE_INFINITY] }
    expect(buildIncidentAnchor({ kind: 'cadVector', feature }, metadata, []).position).toBeNull()
  })

  it('keeps image CAD pixels out of WGS84, without silently choosing a default map center', () => {
    const image = cadBlueprintAssets[0]!
    const anchor = buildIncidentAnchor({ kind: 'cadImage', asset: image }, metadata, [serverAsset()])
    expect(anchor.position).toBeNull()
    expect(anchor.assetId).toBeNull()
    expect(anchor.address).toBe('')
    expect(anchor.origin.featureId).toBe(image.id)
    expect(anchor.locationMessage).toContain('Ảnh CAD')
  })

  it('links a CAD source code to the actual server asset ID without copying its unrelated location', () => {
    const server = serverAsset()
    const anchor = buildIncidentAnchor({ kind: 'cadVector', feature: cad() }, metadata, [server])
    expect(anchor.assetId).toBe(server.properties.id)
    expect(anchor.position?.[1]).toBeCloseTo(106.38634541, 7)
    const unrelated = { ...server, properties: { ...server.properties, assetCode: 'other-code', name: 'Hậu Nghĩa' } }
    expect(buildIncidentAnchor({ kind: 'cadVector', feature: cad() }, metadata, [unrelated]).assetId).toBeNull()
  })

  it('preserves explicit OSM/WGS84 reporting and rejects invalid geographic values', () => {
    const feature = serverAsset()
    const anchor = buildIncidentAnchor({ kind: 'asset', feature }, null, [feature])
    expect(anchor.position).toEqual([10.2, 106.1])
    expect(anchor.assetId).toBe(feature.properties.id)
    expect(anchor.address).toBe('Địa chỉ OSM cũ')
    for (const [lat, lng] of [['', ''], [' ', '106'], ['91', '106'], ['10', '181'], ['Infinity', '106'], ['10', 'NaN'], ['1209210', '577180']]) {
      expect(parseIncidentPosition(lat!, lng!)).toBeNull()
    }
    expect(parseIncidentPosition('10.884500', '106.425500')).toEqual([10.8845, 106.4255])
  })

  it('retains source object context through local storage and the API request schema', () => {
    const anchor = buildIncidentAnchor({ kind: 'cadVector', feature: cad() }, metadata, [])
    const record: IncidentFeature = {
      type: 'Feature', geometry: { type: 'Point', coordinates: [anchor.position![1], anchor.position![0]] },
      properties: { id: 'INC-local', name: 'Sự cố', type: 'incident', status: 'new', incidentCode: 'SC-local', incidentType: 'leak', severity: 'low', reportedDate: '2026-10-13', description: '', address: '', notes: [], lastUpdated: '2026-10-13', origin: anchor.origin },
    }
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    saveLocalDraft(record, storage)
    expect((loadLocalDrafts(storage)[0] as IncidentFeature).properties.origin).toEqual(anchor.origin)
    const request = createIncidentSchema.parse({ incidentType: 'leak', severity: 'low', description: 'Rò rỉ', latitude: anchor.position![0], longitude: anchor.position![1], details: { origin: anchor.origin } })
    expect(request.details.origin).toEqual(anchor.origin)
  })

  it('keeps the API asset code and version needed for matching the CAD source object', async () => {
    vi.mocked(apiGet).mockResolvedValue({ type: 'FeatureCollection', features: [serverAsset()], total: 1 })
    const result = await loadApiAssetsForViewport([106, 10, 107, 11], 14)
    const available = result.layers.waterPlant.features
    expect(available[0]?.properties).toMatchObject({ assetCode: 'CAD-selected', version: 7 })
    expect(buildIncidentAnchor({ kind: 'cadVector', feature: cad() }, metadata, available).assetId).toBe(serverAsset().properties.id)
  })
})
