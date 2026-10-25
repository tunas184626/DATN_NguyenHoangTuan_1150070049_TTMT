import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { apiGet } from '../../src/services/apiClient'
import { loadOperationsPage } from '../../src/services/operationsService'
import { matchesWorkQueue } from '../../src/components/manage/workQueues'
import type { IncidentFeature } from '../../src/types/gis'

const query = vi.hoisted(() => vi.fn())
const clientQuery = vi.hoisted(() => vi.fn())
const release = vi.hoisted(() => vi.fn())
vi.mock('./db/pool.js', () => ({ getPool: () => ({ query, connect: async () => ({ query: clientQuery, release }) }) }))
vi.mock('../../src/services/apiClient', () => ({ apiGet: vi.fn() }))

function incident(overrides: Partial<IncidentFeature['properties']> = {}): IncidentFeature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [106.42, 10.88] }, properties: {
    id: 'local-incident', name: 'Rò rỉ', type: 'incident', status: 'new', incidentCode: 'SC-001', incidentType: 'leak', severity: 'high', reportedDate: '2026-10-22', description: '', address: '', notes: [], lastUpdated: '2026-10-22', ...overrides,
  } }
}

beforeEach(() => { query.mockReset(); clientQuery.mockReset(); release.mockReset(); vi.mocked(apiGet).mockReset() })

describe('management work queues', () => {
  it.each([
    ['unassigned', "i.status = 'new' and i.assigned_user_id is null and nullif(trim(i.assigned_to), '') is null"],
    ['overdue', "i.status <> 'resolved' and i.due_at < now()"],
    ['high_priority', "i.status <> 'resolved' and i.severity = 'high'"],
    ['in_progress', "i.status = 'in_progress'"],
  ])('filters %s at the server and preserves the filtered total on an empty page', async (queueName, predicate) => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // escalation refresh
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '37' }] })
    const response = await request(createApp()).get(`/api/incidents?queue=${queueName}&limit=20&offset=100&sort=priority`)
    expect(response.status).toBe(200)
    expect(response.body.meta).toMatchObject({ total: 37, limit: 20, offset: 100 })
    expect(response.body.features).toEqual([])
    expect(query.mock.calls[1]![0]).toContain(predicate)
    expect(query.mock.calls[2]![0]).toContain(predicate)
    expect(query.mock.calls[2]![0]).toContain('i.deleted_at is null')
    expect(query.mock.calls[2]![1]).toEqual([])
  })

  it('aggregates queue totals over all live records with predicates matching the queue lists', async () => {
    query.mockResolvedValueOnce({ rows: [{ assets: '8400', incidents: '1207', open_incidents: '523', overdue_incidents: '84', high_priority_incidents: '135', unassigned_incidents: '27', in_progress_incidents: '35' }] })
    const response = await request(createApp()).get('/api/operations/summary')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ unassignedIncidents: 27, inProgressIncidents: 35, overdueIncidents: 84, highPriorityIncidents: 135 })
    const sql = query.mock.calls[0]![0] as string
    expect(sql).toContain("status = 'new' and assigned_user_id is null and nullif(trim(assigned_to), '') is null")
    expect(sql).toContain("status = 'in_progress'")
    expect(sql).not.toContain('limit')
  })

  it('sends queue, search and pagination to the incident API rather than filtering a bootstrap subset', async () => {
    vi.mocked(apiGet).mockResolvedValue({ type: 'FeatureCollection', features: [], meta: { total: 37, limit: 20, offset: 20 } })
    const page = await loadOperationsPage({ tab: 'incidents', queue: 'overdue', search: ' Hậu Nghĩa ', status: 'all', type: 'all', page: 2, pageSize: 20 })
    const url = new URL(String(vi.mocked(apiGet).mock.calls[0]![0]), 'http://localhost')
    expect(url.pathname).toBe('/incidents')
    expect(Object.fromEntries(url.searchParams)).toEqual({ queue: 'overdue', search: 'Hậu Nghĩa', sort: 'priority', limit: '20', offset: '20' })
    expect(page.meta.total).toBe(37)
  })

  it('rejects unknown queues before any database query', async () => {
    expect((await request(createApp()).get('/api/incidents?queue=everybody')).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('does not classify already assigned legacy records or completed work as awaiting assignment', () => {
    expect(matchesWorkQueue(incident(), 'unassigned')).toBe(true)
    expect(matchesWorkQueue(incident({ assignedTo: '   ' }), 'unassigned')).toBe(true)
    expect(matchesWorkQueue(incident({ assignedTo: 'Đội vận hành 1' }), 'unassigned')).toBe(false)
    expect(matchesWorkQueue(incident({ assignedUserId: 'user-1' }), 'unassigned')).toBe(false)
    expect(matchesWorkQueue(incident({ status: 'resolved' }), 'unassigned')).toBe(false)
  })

  it('does not invent SLA deadlines for local records and excludes resolved incidents from urgent queues', () => {
    expect(matchesWorkQueue(incident({ overdue: true }), 'overdue')).toBe(false)
    expect(matchesWorkQueue(incident({ dueAt: '2000-01-01T00:00:00Z' }), 'overdue')).toBe(true)
    expect(matchesWorkQueue(incident({ status: 'resolved', dueAt: '2000-01-01T00:00:00Z' }), 'overdue')).toBe(false)
    expect(matchesWorkQueue(incident({ status: 'resolved' }), 'high_priority')).toBe(false)
    expect(matchesWorkQueue(incident({ status: 'in_progress', severity: 'low' }), 'in_progress')).toBe(true)
  })
})

describe('versioned incident work actions', () => {
  it('requires a resolution result before touching the database', async () => {
    const response = await request(createApp()).patch('/api/incidents/incident-1/status').send({ status: 'resolved', version: 1, note: '   ' })
    expect(response.status).toBe(400)
    expect(response.body.error.details[0].path).toEqual(['note'])
    expect(clientQuery).not.toHaveBeenCalled()
  })

  it('requires an owner before starting server work and rolls back without a status update', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ status: 'new', version: 1, assigned_to: null, assigned_user_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
    const response = await request(createApp()).patch('/api/incidents/incident-1/status').send({ status: 'in_progress', version: 1, note: 'Kiểm tra tuyến ống' })
    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('INCIDENT_ASSIGNEE_REQUIRED')
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([expect.stringContaining('begin'), expect.stringContaining('for update'), 'rollback'])
    expect(release).toHaveBeenCalledOnce()
  })

  it('preserves conflict checking before workflow changes', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ status: 'in_progress', version: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
    const response = await request(createApp()).patch('/api/incidents/incident-1/status').send({ status: 'resolved', version: 2, note: 'Đã thay khớp nối và kiểm tra kín nước' })
    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('INCIDENT_VERSION_CONFLICT')
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith('update incidents'))).toBe(false)
  })

  it('saves the resolution note in history in the same transaction as the versioned status update', async () => {
    const row = { id: 'incident-1', incident_code: 'SC-001', name: 'Rò rỉ', incident_type: 'leak', severity: 'high', status: 'resolved', description: 'Rò rỉ khớp nối', address: '', details: {}, geometry: { type: 'Point', coordinates: [106.42, 10.88] }, reported_at: new Date('2026-10-22'), updated_at: new Date('2026-10-22'), due_at: new Date('2026-10-23'), version: 2, assigned_to: 'Đội vận hành 1', assigned_user_id: 'owner-1', escalation_level: 0 }
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('select status, version')) return { rows: [{ ...row, status: 'in_progress', version: 1 }] }
      if (sql.startsWith('update incidents')) return { rows: [row] }
      if (sql.startsWith('select resolution_minutes')) return { rows: [{ resolution_minutes: 120 }] }
      return { rows: [] }
    })
    const note = 'Đã thay khớp nối và kiểm tra kín nước'
    const response = await request(createApp()).patch('/api/incidents/incident-1/status').send({ status: 'resolved', version: 1, note })
    expect(response.status).toBe(200)
    expect(response.body.properties).toMatchObject({ status: 'resolved', version: 2 })
    const historyCall = clientQuery.mock.calls.find(([sql]) => String(sql).includes('insert into incident_status_history'))
    expect(historyCall?.[1]).toEqual(['incident-1', 'in_progress', 'resolved', note, 'development-user', 'status_changed', '{}'])
    expect(clientQuery.mock.calls.at(-1)?.[0]).toBe('commit')
    expect(release).toHaveBeenCalledOnce()
  })

  it('requires a reason to reopen a resolved incident', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ status: 'resolved', version: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
    const response = await request(createApp()).patch('/api/incidents/incident-1/status').send({ status: 'in_progress', version: 2, note: '' })
    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('INCIDENT_REOPEN_REASON_REQUIRED')
  })
})
