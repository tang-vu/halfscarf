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
import Hyperswarm from 'hyperswarm'

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

/**
 * Events emitted:
 *   'status'  ({ state: 'joining'|'connected'|'disconnected', room?, peers? })
 *   'message' (WireMessage)  — a parsed message from the peer
 */
export class PeerLink extends EventEmitter {
  private swarm: Hyperswarm | null = null
  private sockets = new Set<Duplex>()
  private inbufs = new Map<Duplex, string>()
  private room = ''

  constructor(private me: PeerIdentity) {
    super()
  }

  get roomCode(): string {
    return this.room
  }
  get peerCount(): number {
    return this.sockets.size
  }

  /** Join (or switch to) a room. Both fans call this with the same code to find each other. */
  async join(roomCode: string): Promise<void> {
    await this.leave()
    this.room = roomCode
    const topic = createHash('sha256').update(roomCode).digest()
    const swarm = new Hyperswarm()
    this.swarm = swarm
    swarm.on('connection', (socket) => this.onConnection(socket))
    swarm.join(topic, { server: true, client: true })
    this.emit('status', { state: 'joining', room: roomCode, peers: 0 })
  }

  private onConnection(socket: Duplex): void {
    this.sockets.add(socket)
    this.inbufs.set(socket, '')

    socket.on('data', (chunk: Buffer) => this.onData(socket, chunk))
    socket.on('error', () => {
      /* ignore teardown races */
    })
    socket.on('close', () => {
      this.sockets.delete(socket)
      this.inbufs.delete(socket)
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
        this.emit('message', JSON.parse(line) as WireMessage)
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
    const swarm = this.swarm
    this.swarm = null
    this.sockets.clear()
    this.inbufs.clear()
    if (swarm) await swarm.destroy().catch(() => {})
  }
}
