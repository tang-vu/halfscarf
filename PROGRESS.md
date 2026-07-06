# PROGRESS

> A fresh session should be able to resume from this file + `DECISIONS.md` + `RISKS.md` alone.

## Now
**Phase 0 — Recon & de-risking spikes.**

## Done
- [x] 0.1 Fetched QVAC / Pears / WDK docs; confirmed the three packages exist on npm
      (`@qvac/sdk@0.14.1`, `@tetherto/wdk@1.0.0-beta.13`, `hyperswarm@4.17.0`).
- [x] 0.1 Confirmed environment: Node v24.14.1 on Windows 10, Vulkan 1.3.280 present.
- [x] 0.2 Scaffolded repo: `package.json`, `tsconfig.json`, `.gitignore`, MIT `LICENSE`,
      `README.md`, `PROGRESS.md`, `DECISIONS.md`, `RISKS.md`, `spikes/`.

## Next
- [x] 0.2 `npm install` deps; read + verify real WDK APIs from `node_modules` types.
- [x] 0.3 Spike A (WDK): **DONE.** Deployed TestUSDT ERC-20, sent **1.5 USDT live on Sepolia** via
      WDK `account.transfer()`. Tx `0xb557ecd4…1866a1`. Read + write paths fully verified.
- [x] 0.4 Spike B (Hyperswarm): two Node procs discovered each other over the real public DHT and
      exchanged messages **both ways** — verified. Topic = `sha256(roomCode)`.
- [ ] 0.5 Spike C (QVAC): install `@qvac/sdk`, read real voice API, fetch models, run one language
      pair (STT -> translate -> TTS/text), measure latency.
- [ ] 0.6 Report back at Phase 0 checkpoint (API shapes, latency, Node-vs-Pear decision, risks).

## Blockers
- ~~Spike A live transfer needs testnet gas~~ — RESOLVED: user funded dev wallet #0 (0.05 Sepolia ETH),
  transfer executed.
- **Spike C:** `@qvac/sdk` runs inference in a **Bare worker**; first install left `@qvac/translation-nmtcpp`
  incomplete (`ECONNRESET`) → `MODULE_NOT_FOUND`. Force-reinstalling `@qvac` (background). Re-run Spike C after.

## Phase roadmap (after Phase 0 passes)
- [ ] Phase 1 — Payment core: two instances, two wallets, send USDt via UI (Jul 8 safety net).
- [ ] Phase 2 — P2P connection over Hyperswarm (room code / QR).
- [ ] Phase 3 — On-device QVAC voice translation wired into the live P2P session.
- [ ] Phase 4 — Demo polish (two-pane "two fans, two nations" UI, README repro).
