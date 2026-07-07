# PROGRESS

> A fresh session should be able to resume from this file + `DECISIONS.md` + `RISKS.md` alone.

## Now
**Phase 3 COMPLETE — on-device voice translation wired into the live P2P session.** Next: Phase 4 (demo polish).

Push-to-talk in the browser → capture mic, downsample to 16 kHz PCM → `/api/speak` → QVAC STT (fan's
language) + Bergamot translate (→ peer's language), all on-device (Bare worker) → the translated text is
pushed to the peer over Hyperswarm as a `voice` frame. Verified end-to-end: Bob 🏴 speaks English →
Alice 🇦🇷 receives "Hola amigo mío. Bienvenidos a la Copa del Mundo…" over the P2P channel. Language
pair driven by each fan's `LANG_CODE` (es↔en both verified present). Added a re-announce loop to make
Hyperswarm discovery reliable (first join can miss otherwise). `npm run typecheck` clean for `src/`.

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
- [x] 0.5 Spike C (QVAC): **DONE.** Full en->es voice pipeline on-device (Whisper STT -> Bergamot NMT ->
      Supertonic TTS). Latency: STT ~0.95s, translate ~0.35s, TTS ~3.6s (inference; CPU). See DECISIONS.md.
- [x] 0.6 Phase 0 checkpoint delivered.

## Blockers
- None. (Spike A gas — resolved by user funding. Spike C `@qvac` partial install — fixed via `--force` reinstall.)

## Runtime decision
- Build on **Node**; QVAC self-spawns a Bare worker for AI. Full Pear packaging is an optional Phase 2/3 stretch.

## Phase roadmap
- [x] Phase 0 — Recon & de-risking spikes (WDK, Hyperswarm, QVAC all verified).
- [x] Phase 1 — Payment core: two instances, two wallets, send USDt via UI (Jul 8 safety net). ✅
- [x] Phase 2 — P2P connection over Hyperswarm (room code). Chat + payment requests + payments, no server. ✅
- [x] Phase 3 — On-device QVAC voice translation wired into the live P2P session (push-to-talk → STT+translate → peer). ✅
- [ ] Phase 4 — Demo polish (two-pane "two fans, two nations" UI, README repro, 3-min video).
