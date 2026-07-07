# halfscarf ⚽🧣

**A football-fan bridge for World Cup 2026.** Two fans who share *no common language, no
common currency, and no reliable network* connect directly, understand each other, and send
each other money — all from their own devices.

Built for the **Tether Developers Cup**, combining all three tracks:

| Leg of the problem | Track | How halfscarf solves it |
| --- | --- | --- |
| No common language | **QVAC** (Local AI) | On-device voice translation. Fan A speaks; fan B hears/reads their own language. All inference on-device — no cloud. |
| No reliable network | **Pears** (P2P) | The two fans connect directly over Hyperswarm. No server, no relay. |
| No common currency | **WDK** (Wallets) | Fans send each other USDt from self-custodial wallets — buy a beer, split a taxi, tip. |

> Status: **Phases 0–4 complete + peer-side TTS — all three tracks integrated and demoable end to
> end; translations are heard, not just read.** See `PROGRESS.md` for the live build state,
> `DECISIONS.md` for the verified SDK APIs + measured latency.

---

## Requirements

- **Node.js ≥ 22.17** (project developed on v24). Check: `node --version`
- **Windows / macOS / Linux.** QVAC on-device inference needs a Vulkan runtime on
  Windows/Linux (Metal on macOS arm64). Check Windows/Linux with `vulkaninfo --summary`.
- A **Sepolia testnet** wallet with a little test ETH (for gas) to try the payment spike.

## Install

```bash
git clone <this-repo>
cd halfscarf
npm install
```

## Run the Phase 0 spikes

Each spike proves one SDK works on your machine before any product code is written.

```bash
npm run spike:wdk     # Spike A — WDK: load wallet, read USDt balance, send a testnet transfer
npm run spike:swarm   # Spike B — Hyperswarm: two peers exchange a message (run in two terminals)
npm run spike:qvac    # Spike C — QVAC: audio in language A -> STT -> translate -> language B out
```

## Run the app — two fans (Phase 1)

1. **Set up a testnet USDt token.** Copy `.env.example` to `.env`, then:
   ```bash
   npx tsx spikes/gen-dev-wallet.ts      # prints a dev address; fund it with Sepolia ETH (faucet)
   npx tsx spikes/deploy-test-usdt.ts    # deploys TestUSDT, writes USDT_ADDRESS into .env
   ```
   (USDt has no canonical contract on Sepolia, so we deploy a 6-decimal ERC-20 stand-in.)

2. **Start two fans in two terminals** — each opens its own two-pane UI:
   ```bash
   INSTANCE=Alice NATION=Argentina FLAG=🇦🇷 LANG_CODE=es PORT=3001 npm start
   INSTANCE=Bob   NATION=England   FLAG=🏴 LANG_CODE=en PORT=3002 npm start
   ```
   Each fan gets a self-custodial wallet (seed in `.data/<name>.seed`, gitignored).

3. **Pair the two fans (Phase 2, over Hyperswarm — no server):** in both UIs type the **same room
   code** (e.g. `worldcup-final`) and hit *Connect over P2P*. They find each other on the Hyperswarm
   DHT, exchange identity, and each other's pane auto-fills. Now you can chat, **request** USDt, and
   **send** USDt — the send goes on-chain and the peer is notified directly over Hyperswarm.

   No typing needed either: one fan taps **🔳 Show QR**, the other taps **📷 Scan QR** (webcam,
   decoded locally by jsQR) — the room code fills in and connects automatically. For scripted
   demos, opening `http://localhost:3001/?room=worldcup-final` auto-connects too.

   > Fund the *sender's* wallet with the token first. `.data/alice.seed` can be set to the deploy
   > wallet (which holds the initial TestUSDT supply) to demo Alice → Bob.

4. **Talk across the language barrier (Phase 3, on-device QVAC):** once paired, **hold the 🎙️ button**
   and speak your language. Your speech is transcribed + translated on-device (no cloud) and the result
   appears on the other fan's screen in *their* language, delivered over Hyperswarm — **and is spoken
   aloud** on their device (on-device TTS, ~2s after the text). Set each fan's language with `LANG_CODE`
   (e.g. `es`, `en`). First utterance loads the models (a few seconds), then it's ~1.3s per phrase.
   Microphone permission is required (works on `http://localhost`).

## The 3-minute demo — and how it maps to the three tracks

Two fans, two nations, one device each:

1. **Connect (Pears / P2P).** One fan shows the room-code **QR**, the other **scans** it (or both
   type the same code) → they pair over **Hyperswarm**. The "🛰️ P2P: connected" badge lights up.
   No server, no relay — just the DHT.
2. **Talk (QVAC / Local AI).** Alice 🇦🇷 holds 🎙️ and speaks Spanish → Bob 🏴 reads it in English on
   his screen **and hears it spoken aloud** (STT + translation on Alice's device, TTS on Bob's —
   all on-device), and vice-versa.
3. **Pay (WDK / Wallets).** Bob taps a **🍺 quick-tip** → USDt moves from his self-custodial wallet to
   Alice's, on-chain, and Alice is notified over the same P2P channel.

| Track | See it in the demo | In the code |
| --- | --- | --- |
| **QVAC** (Local AI) | push-to-talk → translated-speech banner + spoken aloud | `src/voice/`, `POST /api/speak`, `POST /api/hear` |
| **Pears** (P2P) | QR / room-code pairing, "no server" badge, live chat | `src/p2p/peer-link.ts` (Hyperswarm) |
| **WDK** (Wallets) | balances + quick-tip / send / request USDt | `src/wallet/`, `POST /api/send` |

Guarantees: the entire AI path runs on-device (QVAC Bare worker, no cloud); every fan-to-fan byte is
Hyperswarm; wallets are self-custodial (seeds never leave the device).

## Repository layout

```
src/
  wallet/    WDK self-custodial wallet (address, balances, USDt transfer)
  p2p/       Hyperswarm P2P transport (pairing, chat, payments, voice frames)
  voice/     QVAC on-device speech translation (Whisper STT + Bergamot NMT)
  server/    Node HTTP server + JSON API + loopback SSE bridge
  web/       two-pane "two fans, two nations" browser UI (vanilla HTML/CSS/JS)
  config.ts  per-instance config (name, nation, flag, language, wallet seed)
spikes/      Throwaway Phase-0 spikes proving each SDK + the TestUSDT deploy helper
contracts/   TestUSDT.sol — 6-decimal ERC-20 USDt stand-in for Sepolia
PROGRESS.md  What's done / what's next  (resume a session from here)
DECISIONS.md The REAL SDK APIs discovered, versions, runtime choice, measured latency
RISKS.md     Open risks
```

## License

MIT — see [`LICENSE`](./LICENSE).
