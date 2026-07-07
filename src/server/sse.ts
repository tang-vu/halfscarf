/**
 * Tiny Server-Sent Events hub: pushes P2P events from the local Node process to this fan's
 * browser UI over loopback. One-way server->browser stream (plain HTTP, no socket.io).
 * This is local IPC only — the fan-to-fan transport is Hyperswarm (see PeerLink).
 */

import type { ServerResponse } from 'node:http'

export class SseHub {
  private clients = new Set<ServerResponse>()

  /** Attach a client response as an SSE stream (kept open). */
  add(res: ServerResponse): void {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    this.clients.add(res)
    res.on('close', () => this.clients.delete(res))
  }

  /** Broadcast a named event with a JSON payload to all connected UIs. */
  send(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of this.clients) {
      try {
        res.write(payload)
      } catch {
        this.clients.delete(res)
      }
    }
  }
}
