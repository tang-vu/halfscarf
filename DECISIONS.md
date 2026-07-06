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
- **Testnet target for Spike A: Sepolia.** Read path proven live. **Live transfer needs Sepolia gas
  (blocker — see RISKS #5).** USDt-on-Sepolia isn't canonical; plan = deploy a 6-decimal "test USDT"
  ERC-20 from a gas-funded wallet, then `transfer` between two derived accounts.
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
