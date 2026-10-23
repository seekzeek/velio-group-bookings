// Opens one SSE stream per load activity and records when every availability event arrives, on the same clock as k6.
// Usage: node listen.mjs [seconds]   (default 90). Writes out/listener.ndjson.

import { createWriteStream, mkdirSync, readFileSync } from 'node:fs'

const fixture = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'))
const seconds = Number(process.argv[2] ?? 90)
mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
const out = createWriteStream(new URL('./out/listener.ndjson', import.meta.url))

let connected = 0
const controllers = []

async function listen(activityId) {
  const controller = new AbortController()
  controllers.push(controller)
  const res = await fetch(`${fixture.apiBase}/activities/${activityId}/stream`, { headers: { Accept: 'text/event-stream' }, signal: controller.signal })
  if (!res.ok || !res.body) throw new Error(`stream ${activityId}: ${res.status}`)
  connected += 1
  if (connected === fixture.activities.length) console.log(`listening on ${connected} streams for ${seconds}s`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = ''
  let data = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, '')
      buffer = buffer.slice(newline + 1)
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
      else if (line === '') {
        if (event === 'availability' && data) {
          const payload = JSON.parse(data)
          out.write(`${JSON.stringify({ t: Date.now(), activityId, version: payload.version, spotsTaken: payload.spotsTaken })}\n`)
        }
        event = ''
        data = ''
      }
      newline = buffer.indexOf('\n')
    }
  }
}

Promise.all(fixture.activities.map((id) => listen(id).catch((err) => console.error(err.message)))).catch(() => undefined)

setTimeout(() => {
  for (const c of controllers) c.abort()
  out.end(() => process.exit(0))
}, seconds * 1000)
