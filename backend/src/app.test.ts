import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

describe('health API', () => {
  it('reports the process as live without requiring a database', async () => {
    const response = await request(createApp()).get('/api/health/live')
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.headers['x-request-id']).toBeTruthy()
  })

  it('returns a stable JSON error for unknown routes', async () => {
    const response = await request(createApp()).get('/api/not-found')
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('reports database readiness as unavailable when no connection is configured', async () => {
    const response = await request(createApp()).get('/api/health/ready')
    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('DATABASE_NOT_CONFIGURED')
  })

  it('rejects an invalid incident before accessing the database', async () => {
    const response = await request(createApp()).post('/api/incidents').send({
      incidentType: 'leak',
      severity: 'high',
      description: 'Rò rỉ đường ống',
      latitude: 190,
      longitude: 106.4,
    })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
