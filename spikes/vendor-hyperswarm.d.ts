// Minimal ambient types for `hyperswarm` (the package ships no .d.ts).
// Only the surface halfscarf uses — verified against node_modules/hyperswarm/README.md.
declare module 'hyperswarm' {
  import type { Duplex } from 'node:stream'

  export interface PeerInfo {
    publicKey: Buffer
    topics: Buffer[]
    prioritized: boolean
  }

  export interface PeerDiscovery {
    flushed(): Promise<void>
    refresh(opts?: { client?: boolean; server?: boolean }): Promise<void>
    destroy(): Promise<void>
  }

  export interface HyperswarmOptions {
    keyPair?: unknown
    seed?: Buffer
    maxPeers?: number
    firewall?: (remotePublicKey: Buffer) => boolean
    dht?: unknown
  }

  export default class Hyperswarm {
    constructor(opts?: HyperswarmOptions)
    readonly connections: Set<Duplex>
    readonly connecting: number
    join(topic: Buffer, opts?: { server?: boolean; client?: boolean }): PeerDiscovery
    leave(topic: Buffer): Promise<void>
    flush(): Promise<void>
    listen(): Promise<void>
    destroy(): Promise<void>
    on(event: 'connection', cb: (socket: Duplex, info: PeerInfo) => void): this
    on(event: 'update', cb: () => void): this
    on(event: string, cb: (...args: unknown[]) => void): this
  }
}
