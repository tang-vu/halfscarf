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
- [~] 0.3 Spike A (WDK): wallet + address + native + USDt balance **verified live on Sepolia**;
      code for the transfer is written & type-verified. **Live transfer blocked on testnet gas**
      (RISKS #5) — needs a funded Sepolia wallet from the user or a faucet.
- [ ] 0.4 Spike B (Hyperswarm): two Node procs join a topic, exchange "hello" both ways.
- [ ] 0.5 Spike C (QVAC): install `@qvac/sdk`, read real voice API, fetch models, run one language
      pair (STT -> translate -> TTS/text), measure latency.
- [ ] 0.6 Report back at Phase 0 checkpoint (API shapes, latency, Node-vs-Pear decision, risks).

## Blockers (need user)
- **Spike A live transfer:** need Sepolia testnet gas. Either provide a funded Sepolia seed/key
  (goes in gitignored `.env`), or fund a generated dev address. Read path already proven, so this
  only gates the final tx-hash step. B and C proceed in parallel meanwhile.

## Phase roadmap (after Phase 0 passes)
- [ ] Phase 1 — Payment core: two instances, two wallets, send USDt via UI (Jul 8 safety net).
- [ ] Phase 2 — P2P connection over Hyperswarm (room code / QR).
- [ ] Phase 3 — On-device QVAC voice translation wired into the live P2P session.
- [ ] Phase 4 — Demo polish (two-pane "two fans, two nations" UI, README repro).
