import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { assetQualityConditions } from './modules/operations/asset-quality.js'
import { assetChecklist, isMissingMetadata, matchesAssetQuality, summarizeAssetQuality } from '../../src/components/manage/assetQuality'
import { loadAssetQualitySummary, loadOperationsPage } from '../../src/services/operationsService'
import { apiGet } from '../../src/services/apiClient'
import type { AssetFeature } from '../../src/types/gis'

const query = vi.hoisted(() => vi.fn())
vi.mock('./db/pool.js', () => ({ getPool: () => ({ query }) }))
vi.mock('../../src/services/apiClient', () => ({ apiGet: vi.fn() }))
const asset = (type: AssetFeature['properties']['type'], attributes: Partial<AssetFeature['properties']> = {}): AssetFeature => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [106.4, 10.9] },
  properties: { id: type, name: type, type, status: 'active', description: '', address: 'Đức Hòa', notes: [], lastUpdated: '2026-10-22', ...attributes },
})
beforeEach(() => { query.mockReset(); vi.mocked(apiGet).mockReset() })

describe('asset metadata quality workflows', () => {
  it('checks technical fields required by the asset type rather than all fields together', () => {
    expect(matchesAssetQuality(asset('pipeline', { diameter: 'DN200', material: 'HDPE', length: '200 m' }), 'technical')).toBe(false)
    expect(matchesAssetQuality(asset('pipeline', { diameter: 'DN200', material: 'HDPE' }), 'technical')).toBe(true)
    expect(matchesAssetQuality(asset('water_plant', { capacity: '1000 m³/ngày' }), 'technical')).toBe(false)
    expect(matchesAssetQuality(asset('raw_water_lake', { area: '20 ha' }), 'technical')).toBe(true)
    expect(matchesAssetQuality(asset('canal', { length: '100 m' }), 'technical')).toBe(false)
    expect(matchesAssetQuality(asset('supply_zone', { area: '5 ha' }), 'technical')).toBe(false)
    expect(matchesAssetQuality(asset('boundary'), 'technical')).toBe(false)
    expect(assetChecklist(asset('water_plant')).map((item) => item.label)).toEqual(['Công suất', 'Địa chỉ / mô tả vị trí'])
  })

  it('treats blank and placeholder values as missing without rejecting populated values with units', () => {
    for (const value of [null, undefined, '', ' \t ', '-', ' — ', 'N/A', 'chưa cập nhật']) expect(isMissingMetadata(value)).toBe(true)
    for (const value of ['DN200', 'HDPE', '10,5 km']) expect(isMissingMetadata(value)).toBe(false)
    expect(matchesAssetQuality(asset('pipeline', { diameter: '-', material: 'PVC', length: '5 m' }), 'technical')).toBe(true)
  })

  it('keeps status queues separate from technical completeness and allows overlapping groups', () => {
    const pendingInspection = asset('water_plant', { status: 'need_inspection', address: '', capacity: '-' })
    const maintenance = asset('pipeline', { status: 'maintenance', diameter: 'DN200', material: 'HDPE', length: '100 m' })
    expect(summarizeAssetQuality([pendingInspection, maintenance])).toMatchObject({ total: 2, technical: 1, address: 1, inspection: 1, maintenance: 1 })
  })

  it('aggregates all nondeleted server assets and uses the same missing-value rules as the list filter', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '1507', technical: '800', address: '120', inspection: '57', maintenance: '18' }] })
    const response = await request(createApp()).get('/api/operations/asset-quality')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ total: 1507, technical: 800, address: 120, inspection: 57, maintenance: 18 })
    const sql = query.mock.calls[0]![0] as string
    expect(sql).toContain(assetQualityConditions.technical)
    expect(sql).toContain(assetQualityConditions.address)
    expect(sql).toContain('deleted_at is null')
    expect(sql).not.toContain('limit')
    expect(sql).toContain("attributes->>'diameter'")
    expect(sql).toContain("attributes->>'capacity'")
    expect(sql).toContain("'', '-', '—', 'n/a'")
  })

  it('filters quality rows before pagination and returns accurate totals for an empty page', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '123' }] })
    const response = await request(createApp()).get('/api/assets?quality=technical&type=pipeline&search=HDPE&limit=20&offset=200&sort=name')
    expect(response.status).toBe(200)
    expect(response.body.meta).toMatchObject({ total: 123, offset: 200, limit: 20 })
    expect(query.mock.calls[0]![0]).toContain(assetQualityConditions.technical)
    expect(query.mock.calls[1]![0]).toContain(assetQualityConditions.technical)
    expect(query.mock.calls[1]![1]).toEqual(['pipeline', '%HDPE%'])
    expect(query.mock.calls[0]![1]).toEqual(['pipeline', '%HDPE%', 20, 200])
  })

  it.each(['address', 'inspection', 'maintenance'] as const)('applies the %s condition on server lists', async (quality) => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] })
    expect((await request(createApp()).get(`/api/assets?quality=${quality}`)).status).toBe(200)
    expect(query.mock.calls[0]![0]).toContain(assetQualityConditions[quality])
  })

  it('rejects an unknown quality group before querying the database', async () => {
    expect((await request(createApp()).get('/api/assets?quality=overdue')).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('sends quality filters and offsets to the API instead of filtering the bootstrap cache', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({ type: 'FeatureCollection', features: [], meta: { total: 123, limit: 20, offset: 100 } })
    await loadOperationsPage({ tab: 'assets', quality: 'technical', page: 6, pageSize: 20, search: '', status: 'all', type: 'pipeline' })
    const url = new URL(String(vi.mocked(apiGet).mock.calls[0]![0]), 'http://localhost')
    expect(url.searchParams.get('quality')).toBe('technical')
    expect(url.searchParams.get('offset')).toBe('100')
    expect(url.searchParams.get('type')).toBe('pipeline')
  })

  it('rejects malformed quality totals rather than substituting the loaded row count', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({ total: 1507, technical: 800, address: 120, inspection: 57 })
    await expect(loadAssetQualitySummary()).rejects.toThrow('không hợp lệ')
  })
})
