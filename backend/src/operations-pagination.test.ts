import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'

const query = vi.hoisted(() => vi.fn())
vi.mock('./db/pool.js', () => ({ getPool: () => ({ query }) }))

const assetRow = {
  id: '11111111-1111-4111-8111-111111111111', asset_code: 'TS-001', name: 'Hồ chứa', type: 'raw_water_lake', status: 'maintenance',
  description: '', address: 'Đức Hòa', attributes: {}, geometry: { type: 'Point', coordinates: [106.42, 10.88] }, version: 1, updated_at: new Date('2026-10-13'), total_count: '1507',
}
const incidentRow = {
  id: '22222222-2222-4222-8222-222222222222', incident_code: 'SC-001', name: 'Rò rỉ', incident_type: 'leak', severity: 'high', status: 'new',
  description: '', address: 'Đức Hòa', details: {}, geometry: { type: 'Point', coordinates: [106.42, 10.88] }, version: 1,
  reported_at: new Date('2026-10-13'), updated_at: new Date('2026-10-13'), due_at: new Date('2026-10-14'), escalation_level: 0, asset_ids: [], total_count: '1207',
}

beforeEach(() => { query.mockReset() })

describe('server pagination and global operation totals', () => {
  it('returns an API page and its filtered total instead of the number of loaded rows', async () => {
    query.mockResolvedValueOnce({ rows: [assetRow] })
    const response = await request(createApp()).get('/api/assets?type=raw_water_lake&status=maintenance&search=Đức&limit=20&offset=40&sort=name')
    expect(response.status).toBe(200)
    expect(response.body.features).toHaveLength(1)
    expect(response.body.meta).toMatchObject({ total: 1507, limit: 20, offset: 40 })
    expect(query.mock.calls[0]![0]).toContain('order by name asc, id asc')
    expect(query.mock.calls[0]![0]).toContain('address ilike')
    expect(query.mock.calls[0]![1]).toEqual(['raw_water_lake', 'maintenance', '%Đức%', 20, 40])
  })

  it('keeps the filtered total on an empty asset page, excluding pagination/simplification values from the count query', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '1507' }] })
    const response = await request(createApp()).get('/api/assets?type=pipeline&bbox=106,10,107,11&zoom=10&limit=20&offset=2000')
    expect(response.body.features).toEqual([])
    expect(response.body.meta.total).toBe(1507)
    expect(query.mock.calls[1]![1]).toEqual(['pipeline', 106, 10, 107, 11])
    expect(query.mock.calls[1]![0]).not.toContain('limit')
  })

  it('treats user-entered percent and underscore as literal search characters', async () => {
    query.mockResolvedValueOnce({ rows: [assetRow] })
    await request(createApp()).get('/api/assets').query({ search: '10%_' })
    expect(query.mock.calls[0]![1][0]).toBe('%10\\%\\_%')
  })

  it('returns incidents beyond the original 200-record boundary with deterministic priority ordering', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [incidentRow] })
    const response = await request(createApp()).get('/api/incidents?status=new&search=Rò&limit=20&offset=240&sort=priority')
    expect(response.status).toBe(200)
    expect(response.body.meta).toMatchObject({ total: 1207, limit: 20, offset: 240 })
    expect(response.body.features).toHaveLength(1)
    expect(query.mock.calls[1]![0]).toContain("when i.due_at < now() then 0")
    expect(query.mock.calls[1]![0]).toContain('i.name asc, i.id asc')
    expect(query.mock.calls[1]![1]).toEqual(['new', '%Rò%', 20, 240])
  })

  it('keeps the filtered incident total on an empty page', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '1207' }] })
    const response = await request(createApp()).get('/api/incidents?severity=high&limit=20&offset=2000')
    expect(response.body.features).toEqual([])
    expect(response.body.meta.total).toBe(1207)
    expect(query.mock.calls[2]![1]).toEqual(['high'])
  })

  it('computes global KPI counts from database aggregates independent of pagination', async () => {
    query.mockResolvedValueOnce({ rows: [{ assets: '8400', incidents: '1207', open_incidents: '523', overdue_incidents: '84', high_priority_incidents: '135', unassigned_incidents: '27', in_progress_incidents: '35' }] })
    const response = await request(createApp()).get('/api/operations/summary')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ assets: 8400, incidents: 1207, openIncidents: 523, overdueIncidents: 84, highPriorityIncidents: 135 })
    const sql = query.mock.calls[0]![0] as string
    expect(sql).toContain('deleted_at is null')
    expect(sql).toContain("status <> 'resolved' and due_at < now()")
    expect(sql).not.toContain('limit')
  })

  it('rejects invalid page offsets and sort names before querying the database', async () => {
    for (const path of ['/api/assets?offset=-1', '/api/assets?sort=invalid', '/api/incidents?offset=-1', '/api/incidents?sort=invalid', '/api/incidents?limit=501']) {
      expect((await request(createApp()).get(path)).status).toBe(400)
    }
    expect(query).not.toHaveBeenCalled()
  })
})
