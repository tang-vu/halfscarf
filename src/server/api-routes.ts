/** JSON + SSE API for one fan's local UI: wallet state, USDt send, and P2P (Hyperswarm) actions. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WalletService } from '../wallet/wallet-service.js'
import type { AppConfig } from '../config.js'
import type { PeerLink } from '../p2p/peer-link.js'
import type { VoiceService } from '../voice/voice-service.js'
import type { SseHub } from './sse.js'

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('request body too large')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 20_000_000) throw new Error('audio too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

/**
 * Returns an async handler for /api/* routes. Resolves true if it handled the request
 * (including SSE, which stays open), false if the path is not an API route.
 */
export function makeApiHandler(
  wallet: WalletService,
  cfg: AppConfig,
  peer: PeerLink,
  sse: SseHub,
  voice: VoiceService,
) {
  return async function handle(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    try {
      // Server-Sent Events stream for live P2P updates (kept open).
      if (req.method === 'GET' && pathname === '/api/events') {
        sse.add(res)
        return true
      }

      if (req.method === 'GET' && pathname === '/api/config') {
        sendJson(res, 200, {
          instance: cfg.instance,
          nation: cfg.nation,
          flag: cfg.flag,
          lang: cfg.lang,
          usdtDecimals: cfg.usdtDecimals,
          usdtAddress: cfg.usdtAddress,
          room: peer.roomCode,
          peers: peer.peerCount,
        })
        return true
      }

      if (req.method === 'GET' && pathname === '/api/wallet') {
        sendJson(res, 200, await wallet.getInfo())
        return true
      }

      // --- P2P (Hyperswarm) ---
      if (req.method === 'POST' && pathname === '/api/connect') {
        const body = await readJsonBody(req)
        const room = String(body.room ?? '').trim()
        if (!room) throw new Error('room code required')
        await peer.join(room)
        sendJson(res, 200, { ok: true, room })
        return true
      }

      if (req.method === 'POST' && pathname === '/api/message') {
        const body = await readJsonBody(req)
        const text = String(body.text ?? '').slice(0, 2000)
        if (text) peer.broadcast({ type: 'chat', text })
        sendJson(res, 200, { ok: true })
        return true
      }

      if (req.method === 'POST' && pathname === '/api/request') {
        const body = await readJsonBody(req)
        peer.broadcast({ type: 'payment-request', amount: String(body.amount ?? ''), note: String(body.note ?? '') })
        sendJson(res, 200, { ok: true })
        return true
      }

      // --- QVAC on-device voice translation ---
      // Body is raw 16 kHz mono Int16 PCM (captured + downsampled in the browser). We STT +
      // translate on-device into the peer's language, then push the result over Hyperswarm.
      if (req.method === 'POST' && pathname === '/api/speak') {
        const pcm = await readRawBody(req)
        const dstLang = peer.peerIdentity?.lang || cfg.lang
        const { srcText, dstText } = await voice.translateSpeech(pcm, dstLang)
        if (srcText) peer.broadcast({ type: 'voice', srcText, dstText, srcLang: cfg.lang, dstLang })
        sendJson(res, 200, { srcText, dstText, srcLang: cfg.lang, dstLang })
        return true
      }

      // --- payment ---
      if (req.method === 'POST' && pathname === '/api/send') {
        const body = await readJsonBody(req)
        const to = String(body.to ?? '')
        const amount = String(body.amount ?? '')
        const result = await wallet.sendUsdt(to, amount)
        // Tell the peer directly over Hyperswarm that we paid them.
        peer.broadcast({ type: 'payment-sent', hash: result.hash, amount, explorer: result.explorer })
        sendJson(res, 200, result)
        return true
      }

      return false
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message })
      return true
    }
  }
}
