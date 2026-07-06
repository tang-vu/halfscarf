/**
 * Spike B — Hyperswarm P2P (the Pears networking building block).
 *
 * Proves two independent Node processes can discover each other over the public
 * Hyperswarm DHT — no server, no signalling — from a shared "room code", and
 * exchange a message BOTH ways.
 *
 * Real API verified against node_modules/hyperswarm/README.md:
 *   const swarm = new Hyperswarm()
 *   const discovery = swarm.join(topic, { server: true, client: true })  // topic = 32-byte Buffer
 *   await discovery.flushed()                                            // announced on the DHT
 *   swarm.on('connection', (socket, peerInfo) => { ... })                // Noise-encrypted duplex
 *   socket.write(buf) / socket.on('data', buf => ...)
 *
 * The room code is hashed to a 32-byte topic with SHA-256 — the exact mechanism
 * Phase 2 will use to turn a short pairing code / QR into a swarm topic.
 *
 * Run in two terminals (same room code):
 *   npm run spike:swarm -- --name Alice --room worldcup2026
 *   npm run spike:swarm -- --name Bob   --room worldcup2026
 */

import { createHash } from 'node:crypto'
import Hyperswarm from 'hyperswarm'

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const name = arg('--name', `peer-${Math.floor(Math.random() * 1000)}`)
const room = arg('--room', 'halfscarf-spike')

// A topic must be exactly 32 bytes; SHA-256 of the room code gives us that deterministically.
const topic = createHash('sha256').update(room).digest()

console.log(`[${name}] room "${room}" -> topic ${topic.toString('hex').slice(0, 16)}…`)

const swarm = new Hyperswarm()
let exchanged = false
let shuttingDown = false

async function shutdown(code: number) {
  if (shuttingDown) return
  shuttingDown = true
  await swarm.destroy()
  console.log(`[${name}] done — ${exchanged ? '✅ exchanged messages both ways' : '⚠️ no peer message received'}`)
  process.exit(code)
}

swarm.on('connection', (socket, info) => {
  const peer = info.publicKey.toString('hex').slice(0, 12)
  console.log(`[${name}] 🔗 connected to peer ${peer}…`)

  // Send our greeting as soon as the encrypted stream opens.
  socket.write(`hello from ${name}`)

  socket.on('data', (data) => {
    console.log(`[${name}] 📩 received: "${data.toString()}"`)
    exchanged = true
    // Let the peer receive our greeting too, then wind down cleanly.
    setTimeout(() => shutdown(0), 1500)
  })

  socket.on('error', () => {
    /* ignore teardown races when a peer disconnects first */
  })
})

const discovery = swarm.join(topic, { server: true, client: true })
discovery
  .flushed()
  .then(() => console.log(`[${name}] announced on the DHT — waiting for a peer…`))
  .catch((err) => console.error(`[${name}] announce error:`, err))

// Safety net: never hang forever if the DHT can't find a peer (e.g. blocked network).
setTimeout(() => {
  if (!exchanged) console.log(`[${name}] timeout — no peer connection within 30s`)
  shutdown(exchanged ? 0 : 1)
}, 30000)
