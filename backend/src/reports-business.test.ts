import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import type { LayerDataState } from '../../src/types/gis'
import type { ReportIncidentRow } from '../../src/types/reports'
import { buildIncidentReportCsv, buildLocalReport, buildReportBusiness, reportCsvCell } from '../../src/utils/reports'
import { apiGet } from '../../src/services/apiClient'
import { loadAllReportIncidents } from '../../src/services/reportService'

const query = vi.hoisted(() => vi.fn())
vi.mock('./db/pool.js', () => ({ getPool: () => ({ query }) }))
vi.mock('../../src/services/apiClient', () => ({ apiGet: vi.fn() }))

const filters = { from: '2026-10-01', to: '2026-10-22', region: 'Đức Hòa' }
function row(id: string, changes: Partial<ReportIncidentRow> = {}): ReportIncidentRow {
  return { id, code: `SC-${id}`, name: 'Rò rỉ', incidentType: 'leak', severity: 'high', status: 'resolved', address: 'Đức Hòa',
    assignedTo: 'Đội 1', reportedAt: '2026-10-01T00:00:00.000Z', dueAt: '2026-10-01T04:00:00.000Z',
    resolvedAt: '2026-10-01T02:00:00.000Z', serviceImpact: 'reduced', ...changes }
}

beforeEach(() => { query.mockReset(); vi.mocked(apiGet).mockReset() })

describe('reporting business scope, completeness and export', () => {
  it('calculates on-time completion and average duration only from valid resolved records', () => {
    const metrics = buildReportBusiness([
      row('ontime'), row('late', { resolvedAt: '2026-10-01T06:00:00Z' }),
      row('missing', { resolvedAt: null }), row('invalid', { resolvedAt: '2026-09-30T22:00:00Z' }),
      row('open', { status: 'new', assignedTo: null, resolvedAt: null }),
      row('no-deadline', { status: 'in_progress', assignedTo: ' ', dueAt: null, resolvedAt: null }),
    ], new Date('2026-10-02').getTime())
    expect(metrics).toMatchObject({ resolvedOnTime: 1, resolvedLate: 1, resolvedSlaEligible: 2, resolvedMissingTiming: 2,
      resolutionSample: 2, averageResolutionMinutes: 240, slaOnTimeRate: 50, overdueOpen: 1, unassignedOpen: 2,
      highPriorityOpen: 2, openMissingDeadline: 1 })
  })

  it('shows unavailable SLA as null rather than a misleading zero percent', () => {
    expect(buildReportBusiness([row('legacy', { resolvedAt: null })])).toMatchObject({ slaOnTimeRate: null,
      averageResolutionMinutes: null, resolutionSample: 0, resolvedMissingTiming: 1 })
    expect(buildReportBusiness([]).slaOnTimeRate).toBeNull()
  })

  it('does not substitute lastUpdated for missing completion time in local data', () => {
    const empty = { type: 'FeatureCollection' as const, features: [] }
    const data: LayerDataState = { waterPlant: empty, rawWaterLakes: empty, pipelines: empty, canals: empty,
      supplyZones: empty, boundaries: empty, labels: empty,
      incidents: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [106.4, 10.9] },
        properties: { id: 'legacy', type: 'incident', name: 'Sự cố', incidentCode: 'SC-1', incidentType: 'leak', severity: 'low',
          status: 'resolved', address: 'Đức Hòa', description: '', notes: [], reportedDate: '2026-10-01', lastUpdated: '2026-10-02', dueAt: '2026-10-03' } }] } }
    const report = buildLocalReport(data, filters)
    expect(report.trace.source).toBe('local')
    expect(report.business.slaOnTimeRate).toBeNull()
    expect(report.serviceImpact).toEqual([{ key: 'unknown', value: 1 }])
  })

  it('uses Vietnam calendar days and months for actual timestamps near midnight', () => {
    const empty = { type: 'FeatureCollection' as const, features: [] }
    const makeIncident = (id: string, reportedAt: string) => ({ type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [106.4, 10.9] },
      properties: { id, type: 'incident' as const, name: 'Sự cố', incidentCode: id, incidentType: 'leak' as const,
        severity: 'low' as const, status: 'new' as const, address: '', description: '', notes: [],
        reportedAt, reportedDate: reportedAt.slice(0, 10), lastUpdated: reportedAt } })
    const data: LayerDataState = { waterPlant: { type: 'FeatureCollection', features: [{ type: 'Feature',
      geometry: { type: 'Point', coordinates: [106.4, 10.9] }, properties: { id: 'asset', name: 'Nhà máy', type: 'water_plant',
        status: 'active', description: '', address: '', notes: [], lastUpdated: '2026-09-30T18:30:00Z' } }] },
      rawWaterLakes: empty, pipelines: empty, canals: empty, supplyZones: empty, boundaries: empty, labels: empty,
      incidents: { type: 'FeatureCollection', features: [makeIncident('inside', '2026-09-30T18:30:00Z'), makeIncident('outside', '2026-10-01T18:00:00Z')] } }
    const report = buildLocalReport(data, { from: '2026-10-01', to: '2026-10-01', region: '' })
    expect(report.summary).toMatchObject({ assets: 1, incidents: 1 })
    expect(report.trend).toEqual([{ month: '2026-10', incidents: 1 }])
    expect(buildReportBusiness([row('date-only', { reportedAt: '2026-10-01' })]).resolutionSample).toBe(0)
  })

  it('returns full filtered report totals and SLA denominators from database aggregates', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('as overdue_open')) return { rows: [{ overdue_open: '3', unassigned_open: '2', high_priority_open: '4', open_missing_deadline: '1',
        resolved_on_time: '6', resolved_late: '2', resolved_sla_eligible: '8', resolved_missing_timing: '3', resolution_sample: '9', average_resolution_minutes: '126.5' }] }
      if (sql.includes('as latest_asset_update')) return { rows: [{ assets: '901', incidents: '20', open_incidents: '9', resolved_incidents: '11', latest_asset_update: null, latest_incident_update: null }] }
      if (sql.includes('with months')) return { rows: [{ month: '2026-10', incidents: '20' }] }
      return { rows: [] }
    })
    const response = await request(createApp()).get('/api/reports/summary').query(filters)
    expect(response.status).toBe(200)
    expect(response.body.summary).toMatchObject({ assets: 901, incidents: 20 })
    expect(response.body.business).toMatchObject({ slaOnTimeRate: 75, averageResolutionMinutes: 126.5, resolvedMissingTiming: 3 })
    const businessSql = query.mock.calls.find(([sql]) => String(sql).includes('as overdue_open'))![0] as string
    expect(businessSql).toContain('resolved_at >= reported_at')
    expect(businessSql).toContain("at time zone 'Asia/Ho_Chi_Minh'")
    expect(businessSql).not.toContain('resolved_at - updated_at')
    for (const [sql, values] of query.mock.calls) {
      expect(sql).toContain('deleted_at is null')
      expect(values).toEqual(['2026-10-01', '2026-10-22', 'Đức Hòa'])
    }
  })

  it('paginates detail rows with the same period/region and retains total on an empty page', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '517' }] })
    const response = await request(createApp()).get('/api/reports/incidents').query({ ...filters, region: '10%_', limit: 20, offset: 600 })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ rows: [], meta: { total: 517, limit: 20, offset: 600 } })
    expect(query.mock.calls[0]![0]).toContain('order by reported_at desc, id asc limit $4 offset $5')
    expect(query.mock.calls[0]![1]).toEqual(['2026-10-01', '2026-10-22', '10\\%\\_', 20, 600])
    expect(query.mock.calls[1]![1]).toEqual(['2026-10-01', '2026-10-22', '10\\%\\_'])
  })

  it('rejects impossible dates, too wide periods and malformed page limits before querying', async () => {
    for (const params of [{ ...filters, from: '2026-02-30' }, { ...filters, from: '2010-01-01' }, { ...filters, offset: -1 }, { ...filters, limit: 501 }]) {
      expect((await request(createApp()).get('/api/reports/incidents').query(params)).status).toBe(400)
    }
    expect(query).not.toHaveBeenCalled()
  })

  it('exports all matching API pages instead of just the visible table page', async () => {
    const all = Array.from({ length: 1207 }, (_, index) => row(String(index)))
    vi.mocked(apiGet).mockImplementation(async (path) => {
      const params = new URL(path, 'http://local').searchParams
      const offset = Number(params.get('offset'))
      expect(params.get('region')).toBe('Đức Hòa')
      return { rows: all.slice(offset, offset + 500), meta: { total: all.length, limit: 500, offset } }
    })
    expect(await loadAllReportIncidents(filters)).toHaveLength(1207)
    expect(vi.mocked(apiGet).mock.calls.map(([path]) => new URL(path, 'http://local').searchParams.get('offset'))).toEqual(['0', '500', '1000'])
  })

  it('refuses a partial CSV if a later page is missing, duplicated or the result count changes', async () => {
    for (const next of [
      { rows: [], meta: { total: 2 } },
      { rows: [row('1')], meta: { total: 2 } },
      { rows: [row('2')], meta: { total: 3 } },
    ]) {
      vi.mocked(apiGet).mockReset().mockResolvedValueOnce({ rows: [row('1')], meta: { total: 2 } }).mockResolvedValueOnce(next)
      await expect(loadAllReportIncidents(filters)).rejects.toThrow()
    }
  })

  it('escapes CSV cells, neutralizes spreadsheet formulas and includes the UTF-8 BOM', () => {
    const csv = buildIncidentReportCsv([row('1', { name: '=HYPERLINK("bad")', address: 'Đức Hòa, "khu 1"\nNgõ 2' })])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
    expect(csv).toContain('"Đức Hòa, ""khu 1""\nNgõ 2"')
    expect(reportCsvCell('\t+cmd')).toBe('"\'\t+cmd"')
    expect(reportCsvCell('Bình thường')).toBe('"Bình thường"')
  })
})
