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
  let assetId: string | undefined
  let incidentId: string | undefined

  try {
    const ready = await request<{ status: string }>(baseUrl, '/health/ready')
    assert(ready.status === 'ready', 'database readiness')

    const pipelines = await request<{ features: unknown[]; meta: { total: number } }>(baseUrl, '/assets?type=pipeline&limit=1')
    assert(pipelines.features.length === 1 && pipelines.meta.total >= 416, 'pipeline import is available through API')

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

    const incident = await request<{ properties: { id: string } }>(baseUrl, '/incidents', {
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

    const transitioned = await request<{ properties: { status: string; version: number } }>(baseUrl, `/incidents/${incidentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress', version: 1, note: 'Integration check' }),
    })
    assert(transitioned.properties.status === 'in_progress', 'incident transition')

    const assigned = await request<{ properties: { assignedTo: string; version: number } }>(baseUrl, `/incidents/${incidentId}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ assignee: 'integration@example.test', version: transitioned.properties.version, note: 'Integration assignment' }),
    })
    assert(assigned.properties.assignedTo === 'integration@example.test', 'incident assignment')

    await request(baseUrl, `/incidents/${incidentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: 'Integration comment' }),
    })

    const history = await request<{ items: Array<{ eventType: string }> }>(baseUrl, `/incidents/${incidentId}/history`)
    assert(history.items.length === 4, 'incident history entries')
    assert(history.items.some((item) => item.eventType === 'assignment_changed'), 'assignment history')
    assert(history.items.some((item) => item.eventType === 'comment'), 'comment history')
    console.log('Database integration check PASS: pipeline import + assets CRUD + complete incident workflow')
  } finally {
    const database = getPool()
    if (incidentId) await database.query('delete from incidents where id=$1', [incidentId])
    if (assetId) await database.query('delete from assets where id=$1', [assetId])
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await closePool()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
