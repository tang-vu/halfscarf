/**
 * Generate a throwaway TESTNET dev wallet and write it to .env (gitignored).
 *
 * Prints only the addresses to fund — the seed stays in .env, never in the log.
 * Derives account #0 (sender, to be funded) and account #1 (recipient) so Spike A
 * can later do a real USDt self-transfer once the sender holds gas + a test token.
 *
 * Run: npx tsx spikes/gen-dev-wallet.ts
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const ENV_PATH = '.env'
const RPC = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org'

// Never clobber an existing funded seed.
if (existsSync(ENV_PATH) && /^WDK_SEED=\S+/m.test(readFileSync(ENV_PATH, 'utf8'))) {
  console.log('.env already contains WDK_SEED — leaving it untouched. Delete it first to regenerate.')
  process.exit(0)
}

const seed = WDK.getRandomSeedPhrase(12)
const wdk = new WDK(seed).registerWallet('ethereum', WalletManagerEvm, { provider: RPC })
const sender = await (await wdk.getAccount('ethereum', 0)).getAddress()
const recipient = await (await wdk.getAccount('ethereum', 1)).getAddress()
wdk.dispose()

const env = `# halfscarf DEV wallet — TESTNET ONLY, auto-generated ${new Date().toISOString()}. Gitignored.
# Do NOT reuse this seed on mainnet or with real funds.
WDK_SEED=${seed}
SEPOLIA_RPC_URL=${RPC}

# ERC-20 used as "USDt". Left blank; Spike A can deploy a test token once gas arrives.
USDT_ADDRESS=
USDT_DECIMALS=6

# Recipient defaults to this wallet's account #1 (for a self-transfer demo).
RECIPIENT=${recipient}
TRANSFER_AMOUNT=
`
writeFileSync(ENV_PATH, env)

console.log('✅ Wrote .env (gitignored). Seed kept out of this log.')
console.log('')
console.log('👉 FUND THIS ADDRESS on Sepolia (a little test ETH is enough):')
console.log('   ' + sender)
console.log('')
console.log('   Recipient (account #1, for the demo transfer):', recipient)
console.log('   Suggested faucets: https://sepoliafaucet.com  ·  https://www.alchemy.com/faucets/ethereum-sepolia  ·  https://cloud.google.com/application/web3/faucet/ethereum/sepolia')
