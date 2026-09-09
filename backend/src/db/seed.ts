import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closePool, getPool } from './pool.js'

interface GeoJsonFeature {
  type: 'Feature'
  geometry: object
  properties: Record<string, unknown>
}

async function seed(): Promise<void> {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/data/cad-vector/operational-map-wgs84.geojson')
  const collection = JSON.parse(await readFile(file, 'utf8')) as { features: GeoJsonFeature[] }
  const importTypes = new Set(['water_plant', 'pipeline'])
  const features = collection.features.filter((feature) => importTypes.has(String(feature.properties.type)))
  const counts = new Map<string, number>()
  const client = await getPool().connect()
  try {
    await client.query('begin')
    for (const feature of features) {
      const sourceId = String(feature.properties.id)
      const type = String(feature.properties.type)
      const name = String(feature.properties.name || (type === 'pipeline' ? 'Tuyến ống' : 'Nhà máy nước'))
      counts.set(type, (counts.get(type) ?? 0) + 1)
      await client.query(
        `insert into assets (asset_code, name, type, status, description, attributes, geom)
         values ($1,$2,$3,'pending_data',$4,$5,ST_SetSRID(ST_GeomFromGeoJSON($6::json),4326))
         on conflict (asset_code) do update set name=excluded.name, attributes=excluded.attributes, geom=excluded.geom, updated_at=now()`,
        [sourceId, name, type, String(feature.properties.description ?? ''), JSON.stringify({
          source: feature.properties.sourceName ?? feature.properties.source,
          sourceLayer: feature.properties.cadLayer,
          sourceEntityHandle: feature.properties.sourceEntityHandle,
          importCrs: 'EPSG:9210',
          targetCrs: 'EPSG:4326',
          coordinateProvenance: feature.properties.coordinateProvenance,
          referenceOnly: feature.properties.referenceOnly ?? true,
        }), JSON.stringify(feature.geometry)],
      )
    }
    await client.query('commit')
    console.log(`Seeded ${counts.get('water_plant') ?? 0} water plants and ${counts.get('pipeline') ?? 0} pipelines from WGS84 data`)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

seed().then(closePool).catch(async (error) => {
  console.error(error)
  await closePool()
  process.exitCode = 1
})
