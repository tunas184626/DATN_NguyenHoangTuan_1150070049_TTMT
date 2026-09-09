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
  const features = collection.features.filter((feature) => feature.properties.type === 'water_plant')
  const client = await getPool().connect()
  try {
    await client.query('begin')
    for (const feature of features) {
      const sourceId = String(feature.properties.id)
      const name = String(feature.properties.name || 'Nhà máy nước')
      await client.query(
        `insert into assets (asset_code, name, type, status, description, attributes, geom)
         values ($1,$2,'water_plant','pending_data',$3,$4,ST_SetSRID(ST_GeomFromGeoJSON($5::json),4326))
         on conflict (asset_code) do update set name=excluded.name, attributes=excluded.attributes, geom=excluded.geom, updated_at=now()`,
        [sourceId, name, String(feature.properties.description ?? ''), JSON.stringify({
          source: feature.properties.sourceName ?? feature.properties.source,
          sourceLayer: feature.properties.cadLayer,
          sourceEntityHandle: feature.properties.sourceEntityHandle,
          importCrs: 'EPSG:9210',
        }), JSON.stringify(feature.geometry)],
      )
    }
    await client.query('commit')
    console.log(`Seeded ${features.length} water plants from verified WGS84 data`)
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
