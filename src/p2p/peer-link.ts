/**
 * PeerLink — the Pears/Hyperswarm P2P transport between two fans.
 *
 * Two fans join the same Hyperswarm topic (derived from a shared room code via SHA-256, as
 * verified in Spike B) and talk DIRECTLY — no server, no signalling, no relay. Messages are
 * newline-delimited JSON (NDJSON) framed over the Noise-encrypted duplex stream.
 *
 * This is the only cross-fan transport in the app. The browser never speaks Hyperswarm; it
 * talks to its OWN local Node process over loopback (SSE + POST), which is local IPC, not a
 * relay between the two fans.
 */

import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { Duplex } from 'node:stream'
import Hyperswarm, { type PeerDiscovery } from 'hyperswarm'

export interface PeerIdentity {
  name: string
  nation: string
  flag: string
  lang: string
  address: string
}

/** Messages exchanged over the wire. */
export type WireMessage =
  | ({ type: 'identity' } & PeerIdentity)
  | { type: 'chat'; text: string }
  | { type: 'payment-request'; amount: string; note?: string }
  | { type: 'payment-sent'; hash: string; amount: string; explorer: string }
  | { type: 'voice'; srcText: string; dstText: string; srcLang: string; dstLang: string }

/**
 * Events emitted:
 *   'status'  ({ state: 'joining'|'connected'|'disconnected', room?, peers? })
 *   'message' (WireMessage)  — a parsed message from the peer
 */
export class PeerLink extends EventEmitter {
  private swarm: Hyperswarm | null = null
  private discovery: PeerDiscovery | null = null
  private reannounce: ReturnType<typeof setInterval> | null = null
  private sockets = new Set<Duplex>()
  private inbufs = new Map<Duplex, string>()
  private room = ''
  private peer: PeerIdentity | null = null

  constructor(private me: PeerIdentity) {
    super()
  }

  get roomCode(): string {
    return this.room
  }
  get peerCount(): number {
    return this.sockets.size
  }
  /** The connected peer's identity (incl. their language), captured from their 'identity' frame. */
  get peerIdentity(): PeerIdentity | null {
    return this.peer
  }

  /** Join (or switch to) a room. Both fans call this with the same code to find each other. */
  async join(roomCode: string): Promise<void> {
    await this.leave()
    this.room = roomCode
    const topic = createHash('sha256').update(roomCode).digest()
    const swarm = new Hyperswarm()
    this.swarm = swarm
    swarm.on('connection', (socket) => this.onConnection(socket))
    this.discovery = swarm.join(topic, { server: true, client: true })
    this.emit('status', { state: 'joining', room: roomCode, peers: 0 })

    // DHT discovery can miss on the first announce; re-announce until a peer connects.
    this.reannounce = setInterval(() => {
      if (this.sockets.size === 0) this.discovery?.refresh({ client: true, server: true }).catch(() => {})
    }, 7000)
  }

  private stopReannounce(): void {
    if (this.reannounce) clearInterval(this.reannounce)
    this.reannounce = null
  }

  private onConnection(socket: Duplex): void {
    this.stopReannounce()
    this.sockets.add(socket)
    this.inbufs.set(socket, '')

    socket.on('data', (chunk: Buffer) => this.onData(socket, chunk))
    socket.on('error', () => {
      /* ignore teardown races */
    })
    socket.on('close', () => {
      this.sockets.delete(socket)
      this.inbufs.delete(socket)
      if (this.sockets.size === 0) this.peer = null
      this.emit('status', {
        state: this.sockets.size ? 'connected' : 'disconnected',
        room: this.room,
        peers: this.sockets.size,
      })
    })

    // Greet the peer with who we are so their UI can populate immediately.
    this.write(socket, { type: 'identity', ...this.me })
    this.emit('status', { state: 'connected', room: this.room, peers: this.sockets.size })
  }

  private onData(socket: Duplex, chunk: Buffer): void {
    let buf = (this.inbufs.get(socket) ?? '') + chunk.toString('utf8')
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line) as WireMessage
        if (msg.type === 'identity') this.peer = msg
        this.emit('message', msg)
      } catch {
        /* skip malformed frame */
      }
    }
    this.inbufs.set(socket, buf)
  }

  /** Send a message to the connected peer(s). */
  broadcast(msg: WireMessage): void {
    for (const socket of this.sockets) this.write(socket, msg)
  }

  private write(socket: Duplex, msg: WireMessage): void {
    try {
      socket.write(JSON.stringify(msg) + '\n')
    } catch {
      /* socket may be closing */
    }
  }

  async leave(): Promise<void> {
    this.stopReannounce()
    const swarm = this.swarm
    this.swarm = null
    this.discovery = null
    this.sockets.clear()
    this.inbufs.clear()
    this.peer = null
    if (swarm) await swarm.destroy().catch(() => {})
  }
}
