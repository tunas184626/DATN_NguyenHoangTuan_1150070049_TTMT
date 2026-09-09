import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { env } from './config/env.js'

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

  it('reports database readiness consistently with its configuration', async () => {
    const response = await request(createApp()).get('/api/health/ready')
    if (env.DATABASE_URL) {
      expect(response.status).toBe(200)
      expect(response.body.status).toBe('ready')
    } else {
      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('DATABASE_NOT_CONFIGURED')
    }
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

  it('exposes the current development identity through the auth boundary', async () => {
    const response = await request(createApp()).get('/api/auth/me')
    expect(response.status).toBe(200)
    expect(response.body.user.id).toBe('development-user')
    expect(response.body.profile.role).toBe('admin')
  })

  it('rejects an attachment request without an image before accessing storage', async () => {
    const response = await request(createApp()).post('/api/incidents/missing/attachments')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('IMAGE_REQUIRED')
  })

  it('rejects a spoofed image MIME type before accessing storage', async () => {
    const response = await request(createApp())
      .post('/api/incidents/missing/attachments')
      .attach('file', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' })
    expect(response.status).toBe(415)
    expect(response.body.error.code).toBe('INVALID_IMAGE_CONTENT')
  })
})
