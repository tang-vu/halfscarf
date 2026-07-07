/**
 * halfscarf entry point — one running instance = one football fan.
 *
 * Phase 1: each fan has a self-custodial USDt wallet and a local web UI to send USDt.
 * (Phase 2 adds Hyperswarm P2P pairing; Phase 3 adds QVAC voice translation.)
 *
 * Run two fans on one machine (each gets its own wallet seed in .data/<instance>.seed):
 *   INSTANCE=Alice NATION=Argentina FLAG=🇦🇷 LANG_CODE=es PORT=3001 npm start
 *   INSTANCE=Bob   NATION=England   FLAG=🏴 LANG_CODE=en PORT=3002 npm start
 */

import { exec } from 'node:child_process'
import { loadConfig } from './config.js'
import { WalletService } from './wallet/wallet-service.js'
import { startServer } from './server/http-server.js'

function openBrowser(url: string): void {
  if (process.env.NO_OPEN === '1') return
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd, () => {
    /* best-effort; ignore if no browser */
  })
}

const cfg = loadConfig()
if (!cfg.usdtAddress) {
  console.warn('[main] USDT_ADDRESS not set in .env — USDt balance/send disabled until configured.')
}

const wallet = await new WalletService(cfg).init()
const address = await wallet.getAddress()
console.log(`[main] ${cfg.flag} ${cfg.instance} (${cfg.nation}) wallet: ${address}`)

startServer(wallet, cfg)
openBrowser(`http://localhost:${cfg.port}`)
