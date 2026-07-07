/**
 * Per-instance app configuration. Each running instance is one football fan with their own
 * self-custodial wallet. Seeds are stored per instance under .data/ (gitignored) so two
 * instances on one machine have distinct wallets.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import WDK from '@tetherto/wdk'

// Shared settings (RPC, USDt token) come from .env; per-instance settings from process env.
try {
  process.loadEnvFile('.env')
} catch {
  // no .env — rely on process env / defaults
}

export interface AppConfig {
  instance: string // display name, e.g. "Alice"
  nation: string // e.g. "Argentina"
  flag: string // emoji flag, e.g. "🇦🇷"
  lang: string // preferred language code for QVAC (Phase 3), e.g. "es"
  port: number
  rpcUrl: string
  usdtAddress: string
  usdtDecimals: number
  seed: string // BIP-39 seed for this instance's wallet (never sent to the browser)
}

const DATA_DIR = '.data'

/** Resolve this instance's seed: explicit SEED env, else a persisted per-instance seed file. */
function resolveSeed(instance: string): string {
  const fromEnv = process.env.SEED?.trim()
  if (fromEnv) return fromEnv
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const file = path.join(DATA_DIR, `${instance.toLowerCase()}.seed`)
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const seed = WDK.getRandomSeedPhrase(12)
  writeFileSync(file, seed)
  console.log(`[config] generated a new wallet seed for "${instance}" -> ${file}`)
  return seed
}

export function loadConfig(): AppConfig {
  const instance = process.env.INSTANCE?.trim() || 'Fan'
  return {
    instance,
    nation: process.env.NATION?.trim() || 'Nowhere',
    flag: process.env.FLAG?.trim() || '🏳️',
    lang: process.env.LANG_CODE?.trim() || 'en',
    port: Number(process.env.PORT || 3000),
    rpcUrl: process.env.SEPOLIA_RPC_URL?.trim() || 'https://sepolia.drpc.org',
    usdtAddress: process.env.USDT_ADDRESS?.trim() || '',
    usdtDecimals: Number(process.env.USDT_DECIMALS || '6'),
    seed: resolveSeed(instance),
  }
}
