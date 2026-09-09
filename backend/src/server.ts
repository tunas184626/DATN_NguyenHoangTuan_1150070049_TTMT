import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { closePool } from './db/pool.js'

const server = createServer(createApp())
server.requestTimeout = 15_000
server.headersTimeout = 20_000
server.keepAliveTimeout = 5_000

server.listen(env.PORT, () => {
  console.log(`WebGIS API listening on http://localhost:${env.PORT}`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal}: shutting down`)
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
