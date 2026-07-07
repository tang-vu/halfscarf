# PROGRESS

> A fresh session should be able to resume from this file + `DECISIONS.md` + `RISKS.md` alone.

## Session handoff (read first if resuming)
- **Git:** branch `main`, working tree clean, all work committed **and pushed** to
  `origin` = https://github.com/tang-vu/halfscarf.git.
- **Build state:** Phases 0–4 complete. The product runs; all three tracks verified end to end.
- **Ephemeral local state NOT in git — already set up, do NOT regenerate:**
  - `.env` → `WDK_SEED` (funded dev wallet #0 = `0xD38e838ccfcFDb072329EfF5F0e0f80659CE4EE9`),
    `USDT_ADDRESS` = `0x6aDf4df836fC3E1DF8613a78e0CE006504AB2Ec2` (deployed TestUSDT), `SEPOLIA_RPC_URL`.
  - `.data/alice.seed` = the funded wallet (Alice, holds ~999,9xx TestUSDT + Sepolia ETH gas);
    `.data/bob.seed` = Bob (holds test USDt from demo runs). These let Alice tip immediately.
  - On a different machine: rerun `spikes/gen-dev-wallet.ts` + `spikes/deploy-test-usdt.ts`, or copy `.env`/`.data`.
- **Run the demo (2 terminals):**
  `INSTANCE=Alice NATION=Argentina FLAG=🇦🇷 LANG_CODE=es PORT=3001 npm start`
  `INSTANCE=Bob NATION=England FLAG=🏴 LANG_CODE=en PORT=3002 npm start`
  → same room code → Connect → hold 🎙️ to talk → 🍺 quick-tip.
- **Stopping servers:** kill by port (TaskStop/npm orphans the node child):
  `netstat -ano | grep :PORT` → `taskkill //F //PID`.
- **Open decisions for the user (not done):** (1) record the 3-min demo video (human step);
  (2) pick an optional stretch if any — peer-side **TTS** (hear vs read) / **QR** pairing / **Pear** packaging.
- **User preference:** replies in Vietnamese (also saved in cross-session memory).

## Now
**Phases 0–4 COMPLETE — full product integrated and demoable.** All three tracks work end to end.
Remaining: record the 3-minute demo video; optional stretches (peer-side TTS "hearing", QR pairing,
Pear packaging). See end of file for phase roadmap.

Phase 4 (polish) added: language labels per fan, quick-tip buttons, a prominent translated-speech
banner, clearer on-device / no-server framing, and a complete README (run steps + 3-min demo script +
track mapping). `node --check` on the UI + `npm run typecheck` (src) both clean.

### Previously (Phase 3)

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
- [x] Phase 4 — Demo polish: two-pane UI, language labels, quick-tips, speech banner, README + demo script. ✅
      (Remaining human step: record the 3-min video. Optional stretches below.)

## Optional stretches (not required by the brief)
- Peer-side **TTS** so the translation is *heard*, not just read (QVAC TTS proven in Spike C).
- **QR code** for the room code (currently a shared text code).
- Package as a **Pear app** (`pear run`) — QVAC already runs under Bare, so likely viable.
