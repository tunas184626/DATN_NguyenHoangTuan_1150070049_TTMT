import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { createApp } from '../app.js'
import { closePool, getPool } from './pool.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Integration check failed: ${message}`)
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })
  const body = await response.json() as T
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`)
  return body
}

async function main(): Promise<void> {
  const server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object', 'test server did not start')
  const baseUrl = `http://127.0.0.1:${address.port}/api`
  const marker = randomUUID()
  const assigneeId = marker
  let assetId: string | undefined
  let incidentId: string | undefined

  try {
    const ready = await request<{ status: string }>(baseUrl, '/health/ready')
    assert(ready.status === 'ready', 'database readiness')
    await getPool().query(
      `insert into app_users (auth_user_id, display_name, role)
       values ($1,'Integration technician','technician')`, [assigneeId],
    )

    const pipelines = await request<{ features: unknown[]; meta: { total: number } }>(baseUrl, '/assets?type=pipeline&limit=1')
    assert(pipelines.features.length === 1 && pipelines.meta.total >= 416, 'pipeline import is available through API')

    const viewport = await request<{
      features: unknown[]
      meta: { total: number; zoom: number; simplified: boolean; tolerance: number }
    }>(baseUrl, '/assets?type=pipeline&bbox=106,10,107,12&zoom=10&limit=10')
    assert(viewport.features.length > 0, 'bbox query returns visible pipelines')
    assert(viewport.meta.zoom === 10 && viewport.meta.simplified, 'low zoom geometry is simplified')
    assert(viewport.meta.tolerance > 0, 'simplification tolerance is reported')

    const asset = await request<{ properties: { id: string; version: number } }>(baseUrl, '/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: `Integration asset ${marker}`,
        type: 'water_plant',
        status: 'active',
        description: 'Temporary integration record',
        address: 'Đức Hòa, Long An',
        attributes: { testMarker: marker },
        geometry: { type: 'Point', coordinates: [106.42, 10.88] },
      }),
    })
    assetId = String(asset.properties.id)
    assert(asset.properties.version === 1, 'asset initial version')

    const updatedAsset = await request<{ properties: { version: number } }>(baseUrl, `/assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: `Updated ${marker}`, status: 'maintenance', version: 1 }),
    })
    assert(updatedAsset.properties.version === 2, 'asset optimistic version')

    const incident = await request<{ properties: { id: string; dueAt: string; assetIds: string[] } }>(baseUrl, '/incidents', {
      method: 'POST',
      body: JSON.stringify({
        assetId,
        name: `Integration incident ${marker}`,
        incidentType: 'leak',
        severity: 'high',
        description: 'Temporary integration record',
        address: 'Đức Hòa, Long An',
        latitude: 10.88,
        longitude: 106.42,
        details: { testMarker: marker },
      }),
    })
    incidentId = String(incident.properties.id)
    assert(Boolean(incident.properties.dueAt), 'incident SLA due date')
    assert(incident.properties.assetIds.includes(assetId), 'incident asset link')

    const transitioned = await request<{ properties: { status: string; version: number } }>(baseUrl, `/incidents/${incidentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress', version: 1, note: 'Integration check' }),
    })
    assert(transitioned.properties.status === 'in_progress', 'incident transition')

    const assigned = await request<{ properties: { assignedTo: string; version: number } }>(baseUrl, `/incidents/${incidentId}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId, version: transitioned.properties.version, note: 'Integration assignment' }),
    })
    assert(assigned.properties.assignedTo === 'Integration technician', 'incident assignment')

    await request(baseUrl, `/incidents/${incidentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: 'Integration comment' }),
    })

    const history = await request<{ items: Array<{ eventType: string }> }>(baseUrl, `/incidents/${incidentId}/history`)
    assert(history.items.length === 4, 'incident history entries')
    assert(history.items.some((item) => item.eventType === 'assignment_changed'), 'assignment history')
    assert(history.items.some((item) => item.eventType === 'comment'), 'comment history')
    console.log('Database integration check PASS: bbox/zoom assets + pipeline import + CRUD + incident workflow')
  } finally {
    const database = getPool()
    if (incidentId) await database.query('delete from incidents where id=$1', [incidentId])
    if (assetId) await database.query('delete from assets where id=$1', [assetId])
    await database.query('delete from app_users where auth_user_id=$1', [assigneeId])
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await closePool()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
