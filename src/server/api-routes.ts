/** JSON API for one fan's local UI: read wallet state, send USDt. All server-side (Node + WDK). */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WalletService } from '../wallet/wallet-service.js'
import type { AppConfig } from '../config.js'

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

/**
 * Returns an async handler for /api/* routes. Resolves true if it handled the request,
 * false if the path is not an API route (so the caller can fall through to static files).
 */
export function makeApiHandler(wallet: WalletService, cfg: AppConfig) {
  return async function handle(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    try {
      if (req.method === 'GET' && pathname === '/api/config') {
        sendJson(res, 200, {
          instance: cfg.instance,
          nation: cfg.nation,
          flag: cfg.flag,
          lang: cfg.lang,
          usdtDecimals: cfg.usdtDecimals,
          usdtAddress: cfg.usdtAddress,
        })
        return true
      }
      if (req.method === 'GET' && pathname === '/api/wallet') {
        sendJson(res, 200, await wallet.getInfo())
        return true
      }
      if (req.method === 'POST' && pathname === '/api/send') {
        const body = await readJsonBody(req)
        const to = String(body.to ?? '')
        const amount = String(body.amount ?? '')
        sendJson(res, 200, await wallet.sendUsdt(to, amount))
        return true
      }
      return false
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message })
      return true
    }
  }
}
