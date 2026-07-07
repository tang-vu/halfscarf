/** Minimal static + JSON HTTP server for one fan's local UI. No framework (KISS). */

import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { WalletService } from '../wallet/wallet-service.js'
import type { AppConfig } from '../config.js'
import { makeApiHandler } from './api-routes.js'

const WEB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web')
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

export function startServer(wallet: WalletService, cfg: AppConfig): Server {
  const api = makeApiHandler(wallet, cfg)

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${cfg.port}`)

    if (url.pathname.startsWith('/api/')) {
      const handled = await api(req, res, url.pathname)
      if (!handled) {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
      }
      return
    }

    // Static files from src/web, with path-traversal protection.
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '')
    const safe = path.normalize(requested).replace(/^(\.\.[/\\])+/, '')
    try {
      const buf = await readFile(path.join(WEB_DIR, safe))
      res.writeHead(200, { 'content-type': MIME[path.extname(safe)] || 'application/octet-stream' })
      res.end(buf)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found')
    }
  })

  server.listen(cfg.port, () => {
    console.log(`[server] ${cfg.flag} ${cfg.instance} UI -> http://localhost:${cfg.port}`)
  })
  return server
}
