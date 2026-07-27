import { serve } from '@hono/node-server'
import { Hono } from 'hono'

// Routes are wired in the API task; healthz proves the skeleton runs.
const app = new Hono()
app.get('/healthz', (c) => c.json({ ok: true }))

const port = Number(process.env.API_PORT ?? 3001)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on :${info.port}`)
})
