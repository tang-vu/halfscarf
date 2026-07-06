/**
 * Deploy the TestUSDT ERC-20 (USDt stand-in) to Sepolia from the .env dev wallet,
 * then wire USDT_ADDRESS + TRANSFER_AMOUNT into .env so `npm run spike:wdk` can send
 * a real USDt transfer via the WDK API.
 *
 * Compile: solc (JS). Deploy: ethers ContractFactory (account #0 = m/44'/60'/0'/0/0,
 * the same account WDK derives at index 0). Transfer itself is done by WDK in Spike A.
 *
 * Run: npx tsx spikes/deploy-test-usdt.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// @ts-expect-error - solc ships no type declarations
import solc from 'solc'
import { ethers } from 'ethers'

process.loadEnvFile('.env')
const seed = process.env.WDK_SEED?.trim()
const RPC = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org'
if (!seed) throw new Error('WDK_SEED missing in .env — run gen-dev-wallet first.')

const here = path.dirname(fileURLToPath(import.meta.url))
const SOL_PATH = path.join(here, '..', 'contracts', 'TestUSDT.sol')

// --- compile ---
console.log('Compiling contracts/TestUSDT.sol …')
const input = {
  language: 'Solidity',
  sources: { 'TestUSDT.sol': { content: readFileSync(SOL_PATH, 'utf8') } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
}
const output = JSON.parse(solc.compile(JSON.stringify(input)))
const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === 'error')
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage)
  throw new Error('Solidity compilation failed')
}
const artifact = output.contracts['TestUSDT.sol']['TestUSDT']
const abi = artifact.abi
const bytecode = artifact.evm.bytecode.object

// --- deploy ---
const provider = new ethers.JsonRpcProvider(RPC)
const wallet = ethers.Wallet.fromPhrase(seed).connect(provider) // m/44'/60'/0'/0/0 == WDK account #0
console.log('Deployer (WDK account #0):', wallet.address)

const initialSupply = 1_000_000n * 10n ** 6n // 1,000,000 USDT at 6 decimals
console.log('Deploying TestUSDT (1,000,000 USDT supply) …')
const factory = new ethers.ContractFactory(abi, bytecode, wallet)
const token = await factory.deploy(initialSupply)
await token.waitForDeployment()
const address = await token.getAddress()
const deployTx = token.deploymentTransaction()?.hash
console.log('✅ Deployed at:', address)
console.log('   deploy tx:  ', `https://sepolia.etherscan.io/tx/${deployTx}`)

// --- write config back into .env for the transfer step ---
let env = readFileSync('.env', 'utf8')
env = env.replace(/^USDT_ADDRESS=.*/m, `USDT_ADDRESS=${address}`)
env = env.replace(/^TRANSFER_AMOUNT=.*/m, `TRANSFER_AMOUNT=1.5`)
writeFileSync('.env', env)
console.log('\nUpdated .env: USDT_ADDRESS + TRANSFER_AMOUNT=1.5')
console.log('Next: `npm run spike:wdk` to send 1.5 USDT via the WDK transfer API.')
