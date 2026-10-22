import http from 'node:http'

export type SseEvent = { event: string; id: number; data: Record<string, unknown> }

// A tiny EventSource for tests: collects parsed events and can be closed to simulate a client dropping off.
export function openSse(url: string) {
  const events: SseEvent[] = []
  const waiters: ((e: SseEvent) => void)[] = []
  let buffer = ''
  let request: http.ClientRequest
  let headers: http.IncomingHttpHeaders = {}

  const opened = new Promise<void>((resolve, reject) => {
    request = http.get(url, { headers: { Accept: 'text/event-stream' } }, (res) => {
      headers = res.headers
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        buffer += chunk
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const parsed = parse(block)
          if (!parsed) continue
          events.push(parsed)
          for (const w of waiters.splice(0)) w(parsed)
        }
      })
      resolve()
    })
    request.on('error', reject)
  })

  function parse(block: string): SseEvent | null {
    let event = 'message', id = 0, data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('id:')) id = Number(line.slice(3).trim())
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return null
    return { event, id, data: JSON.parse(data) as Record<string, unknown> }
  }

  async function next(predicate: (e: SseEvent) => boolean, timeoutMs = 5000): Promise<SseEvent> {
    const existing = events.find(predicate)
    if (existing) return existing
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No SSE event matched within ${timeoutMs}ms. Got: ${JSON.stringify(events)}`)), timeoutMs)
      const check = (e: SseEvent) => {
        if (predicate(e)) {
          clearTimeout(timer)
          resolve(e)
        } else waiters.push(check)
      }
      waiters.push(check)
    })
  }

  return {
    opened,
    events,
    next,
    get headers() {
      return headers
    },
    close: () => request.destroy(),
  }
}
