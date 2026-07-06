# DECISIONS

The REAL APIs discovered (verified against installed packages / official docs), package
versions, runtime choices, and measured latency. Update as facts are confirmed — mark each
as `verified` (read from installed types/README or ran it) vs `from docs` (not yet run).

## Runtime
- **Node v24.14.1** on Windows 10 Pro. Bun not installed. → Default runtime: **Node**. `verified`
- TypeScript run via **tsx** (no build step for spikes). `from docs`
- QVAC requires Node ≥ v22.17 (met) and a Vulkan runtime on Windows; **Vulkan 1.3.280 present**
  (`vulkaninfo --summary` works, with a benign registry-layer-manifest warning). `verified`

## Package versions (confirmed on npm registry)
| Package | Version | Track |
| --- | --- | --- |
| `@qvac/sdk` | 0.14.1 | QVAC (Local AI) |
| `@tetherto/wdk` | 1.0.0-beta.13 | WDK core orchestrator |
| `@tetherto/wdk-wallet` | 1.0.0-beta.13 | WDK base account interface (dep) |
| `@tetherto/wdk-wallet-evm` | 1.0.0-beta.15 | WDK EVM wallet (built on `ethers@6.17.0`) |
| `hyperswarm` | 4.17.0 | Pears (P2P) |

> WDK is split: `@tetherto/wdk` is only the orchestrator; the chain logic lives in separate
> `@tetherto/wdk-wallet-<chain>` packages. For EVM/Sepolia install `@tetherto/wdk-wallet-evm`.

## Hyperswarm (Pears P2P) — `verified` (Spike B ran on the real public DHT)
- Install: `npm i hyperswarm` (v4.17.0). Ships **no TS types** → local shim `spikes/vendor-hyperswarm.d.ts`.
- `const swarm = new Hyperswarm(opts)` — opts: `keyPair`, `seed`, `maxPeers` (def 64), `firewall`, `dht`.
- Topic is a **32-byte Buffer**. halfscarf derives it from a room code: `sha256(roomCode)` (node:crypto)
  → this is the Phase-2 pairing mechanism (short code / QR → topic).
- `const discovery = swarm.join(topic, { server: true, client: true })` — symmetric peers use both modes.
  `await discovery.flushed()` waits until announced on the DHT; `await swarm.flush()` waits for pending peers.
- `swarm.on('connection', (socket, peerInfo) => { … })` — `socket` is an **E2E (Noise) encrypted duplex**
  stream: `socket.write(buf)`, `socket.on('data', buf => …)`, `socket.end()`. `peerInfo.publicKey` = 32-byte id.
- `await swarm.destroy()` to tear down. `swarm.connections` = Set of live sockets.
- **Verified:** two separate `tsx` processes on this Windows box, same room code, discovered each other over
  the public DHT and exchanged greetings **both ways** — no server involved. Connection latency a few seconds.
- Related building blocks for shared state if needed later: `hypercore`, `autobase`, `hyperbee`, `hyperdht`.

## WDK (Wallets) — `verified` against installed types + a live Sepolia run (Spike A)
- Install: `npm i @tetherto/wdk @tetherto/wdk-wallet-evm`
- Both packages are ESM (`"type":"module"`) and ship a `bare` export → run under Bare/Pears too.
- **Wire-up (verified):**
  ```ts
  import WDK from '@tetherto/wdk'
  import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
  const seed = WDK.getRandomSeedPhrase()                    // static; 12|24 words; also isValidSeed()
  const wdk = new WDK(seed)
    .registerWallet('ethereum', WalletManagerEvm, { provider: 'https://sepolia.drpc.org' })
  const account = await wdk.getAccount('ethereum', 0)       // BIP-44 index; also getAccountByPath
  ```
  `registerWallet(label, Manager, config)` is chainable; `label` is an opaque string.
  `EvmWalletConfig` = `{ provider: string | EIP-1193, transferMaxFee?: bigint }` (RPC url or window.ethereum).
- **Account API (verified — `IWalletAccount` in `@tetherto/wdk-wallet`):**
  - `getAddress(): Promise<string>`
  - `getBalance(): Promise<bigint>` — native (wei)                              ← ran live, returned 0n
  - `getTokenBalance(tokenAddress): Promise<bigint>` — ERC-20 base units        ← ran live, returned 0n
  - `transfer({ token, recipient, amount }): Promise<{ hash, fee }>` — ERC-20 transfer (amount in base units)
  - `sendTransaction({ to, value, ... }): Promise<{ hash, fee }>` — native send
  - `quoteTransfer(opts)` / `quoteSendTransaction(tx)` — fee estimate (result minus `hash`)
  - `approve({ token, spender, amount })`, `sign(msg)`, `verify(msg, sig)`, `dispose()`
  - `wdk.getFeeRates('ethereum') -> { normal, fast }` (EIP-1559, wei)
- **USDt = ERC-20** on EVM: read via `getTokenBalance(addr)`, send via `transfer({ token: addr, ... })`.
  USDt has **6 decimals**. Amounts everywhere are **base-unit `bigint`**.
- **Testnet target for Spike A: Sepolia. FULLY VERIFIED with a live tx.** USDt-on-Sepolia has no
  canonical contract, so we deploy `contracts/TestUSDT.sol` (6-decimal ERC-20, USDt stand-in) via
  `solc` + `ethers` (`spikes/deploy-test-usdt.ts`), then send with WDK's `account.transfer(...)`.
  - Deploy tooling (dev only): `solc` compiles, `ethers.Wallet.fromPhrase(seed)` deploys. ethers'
    default path `m/44'/60'/0'/0/0` == WDK `getAccount('ethereum', 0)` (same address — confirmed).
  - **Live transfer 1.5 USDT (account #0 -> #1):**
    `0xb557ecd4accbcbe688c6e132aa3757d3c5f48b9f9dc7fd8bc9821c80521866a1` (Sepolia). WDK `transfer`
    returned `{ hash, fee }` with a real `fee` (gasUsed×price) => tx mined/confirmed.
  - TestUSDT token: `0x6aDf4df836fC3E1DF8613a78e0CE006504AB2Ec2`. Dev wallet #0 (funded) =
    `0xD38e838ccfcFDb072329EfF5F0e0f80659CE4EE9`; recipient #1 = `0x2F108358C65F883E37BcF244ee3c9c0c70c59BAB`.
- Optional: WDK has a local **PolicyEngine** (`registerPolicy`, default-deny on governed accounts,
  `PolicyViolationError`, `account.simulate.*`) — nice "spend cap" story for a later phase, not needed now.

## QVAC (Local AI) — `from docs`, voice API TBD from installed types/examples
- Install: `npm i @qvac/sdk`
- Text-gen quickstart (confirmed shape):
  `import { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } from '@qvac/sdk'`
  `const modelId = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType: 'llm', onProgress })`
  `const result = completion({ modelId, history, stream: true })` → `for await (token of result.tokenStream)`
  `await unloadModel({ modelId })`
- Voice pipeline capabilities (backends): STT = whisper.cpp / NVIDIA Parakeet; translate = fabric-llm.cpp /
  Bergamot; TTS = ONNX Runtime (Chatterbox / Supertonic). **Exact STT/translate/TTS function names TBD.**
- Models fetched via a distributed registry (download-lifecycle + sharded-models) — fetch before running.

## Measured latency
- QVAC end-to-end (one language pair): _TBD in Spike C._
