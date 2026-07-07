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

## QVAC (Local AI) — `verified` end-to-end (Spike C ran full en->es voice pipeline)
- Install: `npm i @qvac/sdk` (0.14.1). Pulls ~20 `@qvac/*` native backend subpackages (see RISKS #2).
- **Runs inference in a spawned Bare worker** (`bare:/…`), not the Node main thread. Node app just drives it.
- **All calls reconciled against the SDK's shipped examples** in `node_modules/@qvac/sdk/dist/examples/`.
- Model constants live in `./models/registry`; confirmed: `WHISPER_TINY`, `BERGAMOT_EN_ES`,
  `TTS_MULTILINGUAL_SUPERTONIC3_Q8_0` (plus many more pairs/sizes). `MODEL_TYPES` enumerates types.
- **STT (Whisper):**
  ```ts
  const id = await loadModel({ modelSrc: WHISPER_TINY,
    modelConfig: { language: 'en', n_threads: 4, contextParams: { use_gpu: false } }, onProgress })
  const segs = await transcribe({ modelId: id, audioChunk: '<path.wav>', metadata: true }) // -> {text,startMs,endMs,id}[]
  ```
  Input = **16 kHz mono WAV** (path or buffer). `metadata:false` returns a plain string instead of segments.
- **Translate (Bergamot NMT):**
  ```ts
  const id = await loadModel({ modelSrc: BERGAMOT_EN_ES,
    modelConfig: { engine: 'Bergamot', from: 'en', to: 'es', beamsize: 1, normalize: 1 }, onProgress })
  const r = translate({ modelId: id, text, modelType: 'nmtcpp-translation', stream: false })
  const out = await r.text   // NOTE: translate() returns an object; await its `.text` (not a bare string)
  ```
- **TTS (Supertonic, multilingual, 31 langs):**
  ```ts
  const id = await loadModel({ modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q8_0,
    modelConfig: { ttsEngine: 'supertonic', language: 'es', voice: 'F1', ttsSpeed: 1.05, ttsNumInferenceSteps: 5 }, onProgress })
  const r = textToSpeech({ modelId: id, text, inputType: 'text', stream: false })
  const pcm = await r.buffer // Int16Array PCM @ 44.1 kHz (wrap in a WAV header to play)
  ```
- `unloadModel({ modelId })` frees each; `onProgress({ percentage, downloaded, total })`. Models auto-download
  on first `loadModel` and cache to disk (resumable) — first run is slow, cached runs fast.
- `WHISPER_TINY` config also supports GPU via `contextParams: { use_gpu: true, flash_attn: true, gpu_device: 0 }`
  (Vulkan present). Spike used CPU for a reliable baseline; GPU is a later optimization.
- Streaming variants exist for realtime: `transcribeStream`, `textToSpeechStream`, `translate({stream:true})`.

## Measured latency (Spike C, this machine — Windows, CPU inference, whisper-tiny)
- **STT (Whisper tiny):** ~950–980 ms for a ~6 s clip
- **Translate (Bergamot en->es):** ~350 ms
- **TTS (Supertonic multilingual, es):** ~3640 ms (269k samples @ 44.1 kHz ≈ 6 s of audio)
- **Inference total STT+translate:** ~1.3 s · **incl. TTS:** ~5.0 s
- First run also pays model download (whisper ~tens of MB, bergamot ~37 MB, supertonic ~127 MB); cached after.
- Implication: for the live demo, **STT+translate (~1.3 s) is snappy**; run **TTS async / optional** so text
  appears immediately and speech follows. GPU (Vulkan) should cut these further — later optimization.

## Runtime decision: Node vs Pear/Bare
- **Decision: build the app on Node** (all three SDKs verified working on Node v24, Windows). WDK + Hyperswarm
  are plain Node libs; QVAC self-spawns a **Bare worker** for inference, so the AI path is already Bare-native.
- Because QVAC + WDK both ship `bare` entry points and QVAC's heavy lifting runs under Bare, **full Pear
  packaging (whole app under `pear run`) is a viable Phase 2/3 stretch** — attempt only if friction-free
  (per brief), otherwise stay on Node. No blocker either way.

## Phase 2 architecture (P2P) — `verified`
- **Transport = Hyperswarm only** (guardrail). `src/p2p/peer-link.ts`: room code → `sha256` → 32-byte topic
  → `swarm.join(topic,{server,client})`; on connection, exchange **newline-delimited JSON** frames over the
  Noise duplex. Message types: `identity`, `chat`, `payment-request`, `payment-sent`.
- **Browser ↔ its own Node process = loopback only** (not a fan-to-fan relay): server→browser via **SSE**
  (`/api/events`, `src/server/sse.ts`), browser→server via POST (`/api/connect|message|request|send`).
  No socket.io, no WebRTC, no signalling server — pairing + transport are 100% Hyperswarm.
- On `/api/send`, after the on-chain USDt transfer the server also `broadcast`s a `payment-sent` frame so the
  peer is notified directly over Hyperswarm (no chain polling needed for the "you got paid" UX).
- **Op note:** stopping `npm start` via TaskStop orphans the child `node` (port stays bound → EADDRINUSE on
  restart). Kill by port: `netstat -ano | grep :PORT` → `taskkill //F //PID`.
- **Discovery robustness:** a first `swarm.join` sometimes doesn't find the peer. `PeerLink` re-announces
  (`discovery.refresh({client,server})`) every 7s until connected — makes cold pairing reliable.

## Phase 3 architecture (on-device voice in the P2P session) — `verified`
- **Capture (browser):** push-to-talk → `getUserMedia` → Web Audio `ScriptProcessor` collects Float32 →
  downsample to **16 kHz mono**, convert to Int16 PCM → POST raw bytes to `/api/speak` (loopback).
  No browser speechSynthesis / cloud STT — keeps the AI path 100% QVAC.
- **Translate (server, `src/voice/voice-service.ts`):** wrap PCM in a WAV header → QVAC `transcribe`
  (Whisper, fan's `LANG_CODE`) → QVAC `translate` (Bergamot, fan lang → **peer's** lang from their
  identity frame). Whisper + per-pair NMT models are loaded once and reused; warmed on peer connect.
  Model constant picked dynamically: `BERGAMOT_<FROM>_<TO>` (es↔en both present).
- **Deliver:** server broadcasts a `voice` frame `{srcText,dstText,srcLang,dstLang}` over Hyperswarm; the
  peer's UI shows it in their own language. (`payment`, `chat`, `voice` all share the one P2P channel.)
- **Verified live:** Bob (en) speaks → Alice (es) receives "Hola amigo mío. Bienvenidos a la Copa del
  Mundo. Déjame comprarte una cerveza." Latency (warm, CPU): STT ~1s + translate ~0.35s.
- **TTS (hearing) not wired in** — Phase 3 delivers translated *text* (brief allows "hears or reads").
  QVAC TTS is proven (Spike C) and is a Phase 4 stretch (synthesize peer-side, stream audio to browser).
