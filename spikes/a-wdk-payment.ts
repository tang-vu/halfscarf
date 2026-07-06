/**
 * Spike A — WDK payment (self-custodial USDt on an EVM testnet).
 *
 * Proves the WDK wallet + payment path end-to-end:
 *   load/generate a self-custodial wallet -> read native + USDt balance ->
 *   (when funded) send a tiny USDt transfer -> print the tx hash.
 *
 * The real API below was verified against the installed types in
 * node_modules/@tetherto/wdk and @tetherto/wdk-wallet-evm — not from memory:
 *   WDK.getRandomSeedPhrase()                       -> BIP-39 seed string
 *   new WDK(seed).registerWallet(name, Manager, cfg)-> chainable WDK
 *   await wdk.getAccount('ethereum', index)         -> account
 *   account.getAddress()                            -> Promise<string>
 *   account.getBalance()                            -> Promise<bigint>  (native, wei)
 *   account.getTokenBalance(tokenAddress)           -> Promise<bigint>  (ERC-20 base units)
 *   account.transfer({ token, recipient, amount })  -> Promise<{ hash, fee }>
 *
 * Config is read from .env (see .env.example). A seed is NEVER hardcoded.
 *
 * Diagnostic mode (no WDK_SEED): generate a fresh wallet, hit the live testnet
 * RPC, and print the derived address + balances. This validates the wallet,
 * derivation, and balance-read path against a real network with zero funds.
 */

import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

// --- config from env (Node's built-in loader; no dotenv dependency) ---
try {
  process.loadEnvFile('.env')
} catch {
  // No .env file -> run in diagnostic mode with a generated wallet.
}

const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org'
const SEED = process.env.WDK_SEED?.trim()
const USDT_ADDRESS = process.env.USDT_ADDRESS?.trim()
const USDT_DECIMALS = Number(process.env.USDT_DECIMALS ?? '6')
const RECIPIENT = process.env.RECIPIENT?.trim()
const TRANSFER_AMOUNT = process.env.TRANSFER_AMOUNT?.trim()

const CHAIN = 'ethereum' // registration label (see WDK docs — any string)

/** Format a base-unit bigint as a human decimal string. */
function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n
  const v = neg ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = v / base
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`
}

/** Parse a human decimal string into a base-unit bigint. */
function parseUnits(value: string, decimals: number): bigint {
  const [whole, frac = ''] = value.split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0')
}

async function main() {
  const generated = !SEED
  const seed = SEED ?? WDK.getRandomSeedPhrase()

  console.log('=== Spike A — WDK payment ===')
  console.log('RPC:            ', RPC_URL)
  console.log('Wallet source:  ', generated ? 'GENERATED (diagnostic, unfunded)' : 'WDK_SEED from .env')

  const wdk = new WDK(seed).registerWallet(CHAIN, WalletManagerEvm, { provider: RPC_URL })

  try {
    const account = await wdk.getAccount(CHAIN, 0)
    const address = await account.getAddress()
    console.log('Address:        ', address)

    const native = await account.getBalance()
    console.log('Native balance: ', formatUnits(native, 18), 'ETH', `(${native} wei)`)

    if (USDT_ADDRESS) {
      try {
        const bal = await account.getTokenBalance(USDT_ADDRESS)
        console.log('USDt balance:   ', formatUnits(bal, USDT_DECIMALS), `(token ${USDT_ADDRESS})`)
      } catch (err) {
        console.log('USDt balance:    (could not read —', (err as Error).message, ')')
      }
    } else {
      console.log('USDt balance:    (skipped — set USDT_ADDRESS in .env)')
    }

    // --- transfer step (only when fully configured + funded) ---
    const canTransfer = !generated && USDT_ADDRESS && RECIPIENT && TRANSFER_AMOUNT
    if (canTransfer) {
      if (native === 0n) {
        console.log('\nTransfer skipped: wallet has no native ETH for gas. Fund', address, 'first.')
      } else {
        const amount = parseUnits(TRANSFER_AMOUNT!, USDT_DECIMALS)
        console.log(`\nSending ${TRANSFER_AMOUNT} USDt (${amount} base units) -> ${RECIPIENT} ...`)
        const res = await account.transfer({ token: USDT_ADDRESS!, recipient: RECIPIENT!, amount })
        console.log('✅ Transfer hash:', res.hash)
        console.log('   Fee (wei):   ', res.fee)
        console.log('   Explorer:    ', `https://sepolia.etherscan.io/tx/${res.hash}`)
      }
    } else if (generated) {
      console.log('\nNext: fund', address, 'with testnet ETH (+ the token) and set WDK_SEED to run a real transfer.')
    } else {
      console.log('\nTransfer step skipped: set USDT_ADDRESS, RECIPIENT and TRANSFER_AMOUNT in .env to send.')
    }
  } finally {
    wdk.dispose()
  }
}

main().catch((err) => {
  console.error('Spike A failed:', err)
  process.exit(1)
})
