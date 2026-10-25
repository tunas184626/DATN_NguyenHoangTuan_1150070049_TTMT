import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { closePool } from './db/pool.js'
import { refreshIncidentEscalations } from './modules/incidents/repository.js'

const server = createServer(createApp())
server.requestTimeout = 15_000
server.headersTimeout = 20_000
server.keepAliveTimeout = 5_000

server.listen(env.PORT, () => {
  console.log(`WebGIS API listening on http://localhost:${env.PORT}`)
})

const slaTimer = env.DATABASE_URL ? setInterval(() => {
  void refreshIncidentEscalations().catch((error) => {
    console.error('Incident SLA refresh failed', error)
  })
}, 60_000) : undefined
slaTimer?.unref()

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal}: shutting down`)
  if (slaTimer) clearInterval(slaTimer)
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
